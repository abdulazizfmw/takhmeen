/*
  يرفع الصور إلى Cloudflare R2 مستخدماً الروابط المحلولة مسبقاً في ../config.js
  (يتجنّب إعادة الاستعلام من واجهة ويكيميديا). ينزّل كل صورة، يحسّنها (sharp)،
  يرفعها إلى R2 تحت المجلد المحدّد، ثم — إن توفّر R2_PUBLIC_URL — يعيد كتابة config.js
  ليقرأ من R2 بدل الروابط المباشرة.

  التشغيل:
    cd tools
    R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
    R2_BUCKET=fahad-games R2_PREFIX=guess_game/ [R2_PUBLIC_URL=https://pub-xxxx.r2.dev] \
    node upload-from-config.js
*/

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { S3Client, PutObjectCommand, HeadObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONFIG_PATH = join(ROOT, "config.js");

// وكيل وصفي متوافق مع سياسة ويكيميديا — الوكلاء العامّون (المتصفح/الافتراضي) يُخنقون بـ429
const UA = "Fahad3GuessGame/1.0 (educational guessing game; image asset builder)";
const MAX_WIDTH = 1400;
const JPEG_QUALITY = 82;
const CONCURRENCY = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, ""),
  prefix: (function (p) {
    p = (p || "").replace(/^\/+|\/+$/g, "");
    return p ? p + "/" : "";
  })(process.env.R2_PREFIX),
  force: process.env.FORCE === "1",
};

function requireEnv() {
  const miss = [];
  if (!env.accountId) miss.push("R2_ACCOUNT_ID");
  if (!env.accessKeyId) miss.push("R2_ACCESS_KEY_ID");
  if (!env.secretAccessKey) miss.push("R2_SECRET_ACCESS_KEY");
  if (!env.bucket) miss.push("R2_BUCKET");
  if (miss.length) {
    console.error("\n✗ متغيّرات ناقصة: " + miss.join(", ") + "\n");
    process.exit(1);
  }
}

function parseConfig(txt) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(txt, ctx);
  if (!ctx.window.GAME_CONFIG) throw new Error("لم يُعثر على GAME_CONFIG في config.js");
  return ctx.window.GAME_CONFIG;
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
});

// فشل سريع: محاولات قليلة وتراجع قصير — نعتمد على تمريرات متعددة تتخطّى الناجح
async function fetchRetry(url, tries = 3) {
  let last;
  for (let a = 0; a < tries; a++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://commons.wikimedia.org/" } });
      if (res.status === 429 || res.status === 503) {
        await sleep(Math.min(1000 * 2 ** a, 5000) + Math.floor(Math.random() * 500));
        continue;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      last = e;
      await sleep(Math.min(700 * 2 ** a, 4000));
    }
  }
  throw last || new Error("فشل التنزيل");
}

async function optimizeImage(buf, isFlag) {
  let img = sharp(buf, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const target = isFlag ? 1000 : MAX_WIDTH;
  if (meta.width && meta.width > target) img = img.resize({ width: target });
  return img.flatten({ background: "#ffffff" }).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
}

async function exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: env.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function pool(items, size, worker) {
  const out = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const c = i++;
      out[c] = await worker(items[c], c);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return out;
}

function renderConfig(base, cats, imgVersion) {
  const body = cats
    .map((c) => {
      const imgs = c.images
        .map((im) => {
          const u = im.url ? `, url: ${JSON.stringify(im.url)}` : "";
          return `        { n: ${im.n}, name: ${JSON.stringify(im.name)}${u} }`;
        })
        .join(",\n");
      return (
        `    {\n      key: ${JSON.stringify(c.key)}, labelAr: ${JSON.stringify(c.labelAr)}, ` +
        `emoji: ${JSON.stringify(c.emoji)}, ext: ${JSON.stringify(c.ext)},\n      images: [\n${imgs}\n      ]\n    }`
      );
    })
    .join(",\n");
  return (
    `/* مُولَّد بواسطة tools/upload-from-config.js — الصور من Cloudflare R2. */\n` +
    `window.GAME_CONFIG = {\n  R2_PUBLIC_URL: ${JSON.stringify(base)},\n  IMG_VERSION: ${imgVersion},\n\n  CATEGORIES: [\n${body}\n  ]\n};\n`
  );
}

async function main() {
  requireEnv();

  // تحميل config الحالي (يحوي روابط ويكيميديا المحلولة)
  const cfg = parseConfig(await readFile(CONFIG_PATH, "utf8"));

  // فحص الاتصال بالـ bucket مبكراً
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.bucket }));
    console.log(`✓ الاتصال بالـ bucket ناجح: ${env.bucket}`);
  } catch (e) {
    console.error(`✗ فشل الاتصال بالـ bucket (${env.bucket}): ${e.name || e.message}`);
    console.error(`  تحقّق من Account ID والمفاتيح واسم الـ bucket.`);
    process.exit(1);
  }

  const only = process.env.ONLY;
  const targets = only ? cfg.CATEGORIES.filter((c) => c.key === only) : cfg.CATEGORIES;

  const outByKey = new Map();
  let uploaded = 0, skipped = 0, failed = 0;

  for (const cat of targets) {
    const isFlag = cat.key === "flag";
    console.log(`\n=== ${cat.labelAr} (${cat.key}) ===`);
    const results = await pool(cat.images, CONCURRENCY, async (im) => {
      // صورة بلا رابط = موجودة أصلاً في R2 → نمرّرها كما هي دون معالجة
      if (!im.url) return { n: im.n, name: im.name };
      const key = `${env.prefix}${cat.key}-${im.n}.${cat.ext || "jpg"}`;
      try {
        if (!env.force && (await exists(key))) {
          skipped++;
          console.log(`  ↷ ${key} موجود — تخطّي (${im.name})`);
          return { n: im.n, name: im.name };
        }
        // مباعدة خفيفة قبل كل تنزيل فعلي
        await sleep(150 + Math.floor(Math.random() * 250));
        const raw = await fetchRetry(im.url);
        const body = await optimizeImage(raw, isFlag);
        await s3.send(
          new PutObjectCommand({
            Bucket: env.bucket,
            Key: key,
            Body: body,
            ContentType: "image/jpeg",
            CacheControl: "public, max-age=31536000, immutable",
          })
        );
        uploaded++;
        console.log(`  ✓ ${key}  ← ${im.name}`);
        return { n: im.n, name: im.name }; // في R2 → يُبنى من الرابط الأساسي (بلا url)
      } catch (e) {
        failed++;
        console.log(`  ✗ ${im.name}: ${e.message}`);
        // فشل الرفع → نُبقي رابط ويكيميديا كاحتياطي (يظهر في اللعبة ويُعاد رفعه لاحقاً)
        return { n: im.n, name: im.name, url: im.url };
      }
    });
    // نُبقي كل العناصر: الناجحة تقرأ من R2، والفاشلة تحتفظ برابط احتياطي
    outByKey.set(cat.key, { key: cat.key, labelAr: cat.labelAr, emoji: cat.emoji, ext: cat.ext || "jpg", images: results.filter(Boolean) });
  }
  // نحافظ على ترتيب config.js الأصلي؛ التصنيفات خارج ONLY تمرّ دون تغيير
  const outCats = cfg.CATEGORIES.map((c) => outByKey.get(c.key) || c);

  console.log(`\n— رُفع: ${uploaded} · تُخطّي: ${skipped} · فشل: ${failed}`);

  if (env.publicUrl) {
    const base = (env.publicUrl + "/" + env.prefix).replace(/\/+$/, "");
    const prevVersion = parseInt(cfg.IMG_VERSION, 10) || 1;
    const imgVersion = process.env.BUMP_VERSION === "1" ? prevVersion + 1 : prevVersion;
    await writeFile(CONFIG_PATH, renderConfig(base, outCats, imgVersion), "utf8");
    console.log(`✔ حُدّث config.js ليقرأ من R2: ${base} (IMG_VERSION=${imgVersion})`);
  } else {
    console.log(`\nℹ لم يُضبط R2_PUBLIC_URL — لم أغيّر config.js.`);
    console.log(`  فعّل Public Access ثم أعد التشغيل مع R2_PUBLIC_URL لعرض الصور من R2.`);
  }
  console.log("\n✔ اكتمل الرفع.");
}

main().catch((e) => {
  console.error("\n✗ خطأ غير متوقّع:", e);
  process.exit(1);
});
