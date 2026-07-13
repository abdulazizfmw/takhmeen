/*
  يجلب صوراً حرّة من ويكيبيديا/ويكيميديا كومنز، يحسّنها، يرفعها إلى Cloudflare R2،
  ثم يولّد ../config.js و ./manifest.json.

  التشغيل:
    cd tools
    npm install
    R2_ACCOUNT_ID=...  R2_ACCESS_KEY_ID=...  R2_SECRET_ACCESS_KEY=... \
    R2_BUCKET=...       R2_PUBLIC_URL=https://images.example.com \
    node fetch-and-upload.js

  خيارات إضافية عبر البيئة:
    FORCE=1        إعادة رفع الصور حتى لو كانت موجودة.
    ONLY=animal    معالجة تصنيف واحد فقط (بمفتاحه).
    MAX_WIDTH=1400 أقصى عرض للصورة.
*/

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { CATEGORIES } from "./subjects.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const UA = "GuessGameImageFetcher/1.0 (educational game asset builder)";
const MAX_WIDTH = parseInt(process.env.MAX_WIDTH || "1400", 10);
const JPEG_QUALITY = 82;
// ويكيميديا حسّاسة للطلبات المتسارعة (429)؛ نبقي التزامن منخفضاً مع إعادة محاولة.
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "2", 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ===== التحقق من متغيّرات البيئة =====
const env = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, ""),
  // مجلد (بادئة مفتاح) اختياري داخل الـ bucket، مثل guess_game/ → يُطبَّع إلى "guess_game/"
  prefix: (function (p) {
    p = (p || "").replace(/^\/+|\/+$/g, "");
    return p ? p + "/" : "";
  })(process.env.R2_PREFIX),
};

function requireEnv() {
  const missing = [];
  if (!env.accountId) missing.push("R2_ACCOUNT_ID");
  if (!env.accessKeyId) missing.push("R2_ACCESS_KEY_ID");
  if (!env.secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");
  if (!env.bucket) missing.push("R2_BUCKET");
  if (!env.publicUrl) missing.push("R2_PUBLIC_URL");
  if (missing.length) {
    console.error("\n✗ متغيّرات بيئة ناقصة: " + missing.join(", "));
    console.error("  راجع التعليقات أعلى هذا الملف لطريقة التشغيل.\n");
    process.exit(1);
  }
}

const s3 = () =>
  new S3Client({
    region: "auto",
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
  });

// ===== جلب مع إعادة محاولة وتراجع تصاعدي (يعالج 429/5xx) =====
async function fetchRetry(url, opts = {}, tries = 5) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { ...opts, headers: { "User-Agent": UA, ...(opts.headers || {}) } });
      if (res.status === 429 || res.status === 503) {
        const ra = parseInt(res.headers.get("retry-after") || "0", 10);
        const wait = ra > 0 ? ra * 1000 : Math.min(1000 * 2 ** attempt, 15000) + Math.floor(Math.random() * 500);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      await sleep(Math.min(800 * 2 ** attempt, 8000));
    }
  }
  throw lastErr || new Error("فشل الجلب بعد عدة محاولات");
}

// ===== أدوات ويكيميديا =====
async function apiGet(url) {
  const res = await fetchRetry(url, { headers: { Accept: "application/json" } });
  return res.json();
}

// صورة المقال الرئيسية من ويكيبيديا (thumbnail أو original)
async function fromWiki(lang, title) {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&prop=pageimages&piprop=original|thumbnail&pithumbsize=${MAX_WIDTH}` +
    `&redirects=1&titles=${encodeURIComponent(title)}`;
  const data = await apiGet(url);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.thumbnail?.source || page.original?.source || null;
}

// ملف محدّد على كومنز (يُصيَّر SVG إلى PNG بعرض محدّد)
async function fromCommonsFile(title, width) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&prop=imageinfo&iiprop=url|mime&iiurlwidth=${width}` +
    `&titles=${encodeURIComponent("File:" + title)}`;
  const data = await apiGet(url);
  const page = data?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!info || page.missing) return null;
  return info.thumburl || info.url || null;
}

// بحث في كومنز عن أول صورة نقطية مناسبة
async function fromCommonsSearch(term, width) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=10` +
    `&prop=imageinfo&iiprop=url|mime&iiurlwidth=${width}`;
  const data = await apiGet(url);
  const pages = data?.query?.pages || [];
  // نفضّل JPEG/PNG على SVG وملفات غير الصور
  const ranked = pages
    .map((p) => p.imageinfo?.[0])
    .filter(Boolean)
    .filter((i) => /^image\/(jpeg|png|webp)$/.test(i.mime) || (i.thumburl && /\.(jpe?g|png)/i.test(i.thumburl)));
  const info = ranked[0] || pages[0]?.imageinfo?.[0];
  return info?.thumburl || info?.url || null;
}

async function resolveImageUrl(item, isFlag) {
  const width = isFlag ? 1000 : MAX_WIDTH;
  for (const q of item.queries) {
    try {
      let src = null;
      if (q.kind === "wiki") src = await fromWiki(q.lang, q.title);
      else if (q.kind === "commonsFile") src = await fromCommonsFile(q.title, width);
      else if (q.kind === "commonsSearch") src = await fromCommonsSearch(q.term, width);
      if (src) return { src, via: q.kind };
    } catch (e) {
      // نتابع للاستعلام التالي
    }
  }
  return null;
}

// ===== تنزيل + تحسين =====
async function downloadAndProcess(src, isFlag) {
  const res = await fetchRetry(src, {});
  const buf = Buffer.from(await res.arrayBuffer());
  let img = sharp(buf, { failOn: "none" }).rotate(); // احترام EXIF
  const meta = await img.metadata();
  const targetW = isFlag ? 1000 : MAX_WIDTH;
  if (meta.width && meta.width > targetW) img = img.resize({ width: targetW });
  // دمج على خلفية بيضاء لتفادي سواد الشفافية عند التحويل إلى JPEG
  return img.flatten({ background: "#ffffff" }).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
}

// ===== الرفع =====
async function objectExists(client, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: env.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function upload(client, key, body) {
  await client.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      Body: body,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

// ===== حوض تزامن بسيط =====
async function pool(tasks, size, worker) {
  const results = new Array(tasks.length);
  let idx = 0;
  async function run() {
    while (idx < tasks.length) {
      const cur = idx++;
      results[cur] = await worker(tasks[cur], cur);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, run));
  return results;
}

// ===== المعالجة الرئيسية =====
async function processCategory(client, cat, force) {
  const isFlag = cat.key === "flag";
  console.log(`\n=== ${cat.labelAr} (${cat.key}) ===`);
  const outcomes = await pool(cat.items, CONCURRENCY, async (item, i) => {
    await sleep(150 * (i % CONCURRENCY) + Math.floor(Math.random() * 200)); // مباعدة لطيفة
    try {
      const resolved = await resolveImageUrl(item, isFlag);
      if (!resolved) {
        console.log(`  ✗ ${item.name}: لم يُعثر على صورة`);
        return { name: item.name, ok: false };
      }
      return { name: item.name, ok: true, src: resolved.src, via: resolved.via };
    } catch (e) {
      console.log(`  ✗ ${item.name}: ${e.message}`);
      return { name: item.name, ok: false };
    }
  });

  // ترقيم تسلسلي للناجحين فقط ثم رفعهم
  const succeeded = outcomes.filter((o) => o.ok);
  const images = [];
  let n = 0;
  for (const o of succeeded) {
    n += 1;
    const key = `${env.prefix}${cat.key}-${n}.${cat.ext}`;
    try {
      if (!force && (await objectExists(client, key))) {
        console.log(`  ↷ ${key} موجود — تخطّي (${o.name})`);
      } else {
        const body = await downloadAndProcess(o.src, isFlag);
        await upload(client, key, body);
        console.log(`  ✓ ${key}  ← ${o.name}  [${o.via}]`);
      }
      images.push({ n, name: o.name });
    } catch (e) {
      console.log(`  ✗ ${o.name}: فشل الرفع/المعالجة — ${e.message}`);
    }
  }
  console.log(`  الإجمالي: ${images.length}/${cat.items.length} نجحت`);
  return { key: cat.key, labelAr: cat.labelAr, emoji: cat.emoji, ext: cat.ext, images };
}

function renderConfig(publicUrl, cats) {
  const body = cats
    .map((c) => {
      const imgs = c.images.map((im) => `        { n: ${im.n}, name: ${JSON.stringify(im.name)} }`).join(",\n");
      return (
        `    {\n` +
        `      key: ${JSON.stringify(c.key)}, labelAr: ${JSON.stringify(c.labelAr)}, ` +
        `emoji: ${JSON.stringify(c.emoji)}, ext: ${JSON.stringify(c.ext)},\n` +
        `      images: [\n${imgs}\n      ]\n` +
        `    }`
      );
    })
    .join(",\n");
  return (
    `/* مُولَّد تلقائياً بواسطة tools/fetch-and-upload.js — يمكن تعديله يدوياً. */\n` +
    `window.GAME_CONFIG = {\n` +
    `  R2_PUBLIC_URL: ${JSON.stringify(publicUrl)},\n\n` +
    `  CATEGORIES: [\n${body}\n  ]\n};\n`
  );
}

async function main() {
  requireEnv();
  const force = process.env.FORCE === "1";
  const only = process.env.ONLY;
  const client = s3();

  const targets = only ? CATEGORIES.filter((c) => c.key === only) : CATEGORIES;
  if (only && targets.length === 0) {
    console.error(`✗ لا يوجد تصنيف بالمفتاح: ${only}`);
    process.exit(1);
  }

  const results = [];
  for (const cat of targets) {
    results.push(await processCategory(client, cat, force));
  }

  // عند معالجة تصنيف واحد فقط: ادمج مع config.js الحالي حتى لا نفقد البقية
  let finalCats = results;
  if (only) {
    finalCats = CATEGORIES.map((c) => {
      const updated = results.find((r) => r.key === c.key);
      return updated || null;
    }).filter(Boolean);
    console.log("\n(ملاحظة: ONLY فعّال — أعِد التشغيل لكامل التصنيفات لتوليد config.js كاملاً.)");
  }

  await writeFile(join(__dirname, "manifest.json"), JSON.stringify(results, null, 2), "utf8");
  // الرابط في config يشمل المجلد ليبني app: {publicUrl}/{prefix}{key}-{n}.jpg
  const configBase = (env.publicUrl + "/" + env.prefix).replace(/\/+$/, "");
  const cfg = renderConfig(configBase, finalCats);
  await writeFile(join(ROOT, "config.js"), cfg, "utf8");

  const total = results.reduce((s, r) => s + r.images.length, 0);
  const expected = targets.reduce((s, c) => s + c.items.length, 0);
  console.log(`\n✔ اكتمل. رُفعت/سُجّلت ${total}/${expected} صورة.`);
  console.log(`✔ حُدّث config.js بالرابط: ${env.publicUrl}`);
  console.log(`✔ التفاصيل في tools/manifest.json`);
  if (total < expected) {
    console.log(`\n⚠ بعض العناصر فشلت — عدّل tools/subjects.js لتلك العناصر وأعِد التشغيل.`);
  }
}

main().catch((e) => {
  console.error("\n✗ خطأ غير متوقّع:", e);
  process.exit(1);
});
