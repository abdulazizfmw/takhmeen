/*
  يُرحّل صور فاكهة محدّدة إلى R2 مستخدماً curl (وكيل وصفي متوافق مع سياسة ويكيميديا)
  بدل fetch الخاص بـ Node (الذي يُخنق بـ429). يعيد المحاولة عبر فترة تهدئة، ثم عند النجاح
  يزيل حقل url من ../config.js لتلك العناصر (فتقرأ من R2).

  التشغيل:
    R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
    R2_BUCKET=fahad-games R2_PREFIX=guess_game/ node fix-fruit-r2.js
*/
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "..", "config.js");
const UA = "Fahad3GuessGame/1.0 (educational guessing game; image asset builder)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TARGETS = [
  { key: "fruit", n: 17, name: "جوز الهند", url: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Coconuts_-_single_and_cracked_open.jpg" },
];

const env = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  prefix: (process.env.R2_PREFIX || "").replace(/^\/+|\/+$/g, "") + "/",
};
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
});

// تنزيل عبر curl (يتجاوز خنق undici) — يعيد Buffer أو يرمي عند فشل/429
async function curlGet(url) {
  const { stdout } = await execFileP(
    "curl",
    ["-sS", "--fail", "-A", UA, "--max-time", "60", url],
    { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }
  );
  if (!stdout || stdout.length < 5000) throw new Error("رد صغير/غير صالح (" + (stdout ? stdout.length : 0) + " بايت)");
  return stdout;
}

async function optimize(buf) {
  let img = sharp(buf, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  if (meta.width && meta.width > 1400) img = img.resize({ width: 1400 });
  return img.flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

async function main() {
  const done = new Set();
  const maxRounds = 12;
  for (let round = 1; round <= maxRounds && done.size < TARGETS.length; round++) {
    console.log(`\n=== الجولة ${round} (اكتمل ${done.size}/${TARGETS.length}) ===`);
    for (const t of TARGETS) {
      if (done.has(t.n)) continue;
      const key = `${env.prefix}${t.key}-${t.n}.jpg`;
      try {
        const raw = await curlGet(t.url);
        const body = await optimize(raw);
        await s3.send(new PutObjectCommand({
          Bucket: env.bucket, Key: key, Body: body, ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
        }));
        done.add(t.n);
        console.log(`  ✓ ${key}  ← ${t.name}`);
      } catch (e) {
        console.log(`  ✗ ${t.name}: ${String(e.message || e).slice(0, 80)}`);
      }
      await sleep(2000);
    }
    if (done.size < TARGETS.length) { console.log("  … تهدئة 90ث"); await sleep(90000); }
  }

  // إزالة url من config.js للعناصر التي نجحت
  let txt = await readFile(CONFIG_PATH, "utf8");
  for (const t of TARGETS) {
    if (!done.has(t.n)) continue;
    const re = new RegExp(`(\\{ n: ${t.n}, name: "${t.name}"), url: "[^"]*" \\}`);
    txt = txt.replace(re, "$1 }");
  }
  await writeFile(CONFIG_PATH, txt, "utf8");
  console.log(`\n✔ اكتمل: ${done.size}/${TARGETS.length} في R2. المتبقّي كاحتياطي: ${TARGETS.length - done.size}`);
}
main().catch((e) => { console.error("✗", e); process.exit(1); });
