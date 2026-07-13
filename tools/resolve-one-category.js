/*
  يحلّ روابط ويكيميديا لتصنيف واحد فقط ويدمجها في ../config.js دون المساس بباقي
  التصنيفات (تبقى كما هي — تقرأ من R2). يُستخدم لإصلاح تصنيف واحد (مثل ترقيم مختل)
  دون إعادة تشغيل السلسلة الكاملة.

  التشغيل:
    node tools/resolve-one-category.js saudi-food
*/

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { CATEGORIES } from "./subjects.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONFIG_PATH = join(ROOT, "config.js");

const UA = "GuessGameImageFetcher/1.0 (educational game preview)";
const MAX_WIDTH = 1400;
const CONCURRENCY = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targetKey = process.argv[2];
if (!targetKey) {
  console.error("استخدم: node tools/resolve-one-category.js <category-key>");
  process.exit(1);
}

async function fetchRetry(url, tries = 6) {
  let lastErr;
  for (let a = 0; a < tries; a++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.status === 429 || res.status === 503) {
        const ra = parseInt(res.headers.get("retry-after") || "0", 10);
        await sleep(ra > 0 ? ra * 1000 : Math.min(1000 * 2 ** a, 15000) + Math.floor(Math.random() * 500));
        continue;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    } catch (e) {
      lastErr = e;
      await sleep(Math.min(800 * 2 ** a, 8000));
    }
  }
  throw lastErr || new Error("فشل الجلب");
}
async function fromWiki(lang, title) {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&prop=pageimages&piprop=original|thumbnail&pithumbsize=${MAX_WIDTH}&redirects=1` +
    `&titles=${encodeURIComponent(title)}`;
  const d = await fetchRetry(url);
  const p = d?.query?.pages?.[0];
  if (!p || p.missing) return null;
  return p.thumbnail?.source || p.original?.source || null;
}
async function fromCommonsFile(title, width) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&prop=imageinfo&iiprop=url|mime&iiurlwidth=${width}&titles=${encodeURIComponent("File:" + title)}`;
  const d = await fetchRetry(url);
  const info = d?.query?.pages?.[0]?.imageinfo?.[0];
  return info?.thumburl || info?.url || null;
}
async function fromCommonsSearch(term, width) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2` +
    `&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=10` +
    `&prop=imageinfo&iiprop=url|mime&iiurlwidth=${width}`;
  const d = await fetchRetry(url);
  const pages = d?.query?.pages || [];
  const ranked = pages
    .map((p) => p.imageinfo?.[0])
    .filter(Boolean)
    .filter((i) => /^image\/(jpeg|png|webp)$/.test(i.mime));
  const info = ranked[0] || pages[0]?.imageinfo?.[0];
  return info?.thumburl || info?.url || null;
}
async function resolve(item, isFlag) {
  const width = isFlag ? 1000 : MAX_WIDTH;
  for (const q of item.queries) {
    try {
      let src = null;
      if (q.kind === "wiki") src = await fromWiki(q.lang, q.title);
      else if (q.kind === "commonsFile") src = await fromCommonsFile(q.title, width);
      else if (q.kind === "commonsSearch") src = await fromCommonsSearch(q.term, width);
      if (src) return src;
    } catch {}
  }
  return null;
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

function parseConfig(txt) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(txt, ctx);
  return ctx.window.GAME_CONFIG;
}

function renderConfig(cfg) {
  const body = cfg.CATEGORIES.map((c) => {
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
  }).join(",\n");
  return (
    `/* مُولَّد بواسطة tools/upload-from-config.js — الصور من Cloudflare R2. */\n` +
    `window.GAME_CONFIG = {\n  R2_PUBLIC_URL: ${JSON.stringify(cfg.R2_PUBLIC_URL || "")},\n  IMG_VERSION: ${parseInt(cfg.IMG_VERSION, 10) || 1},\n\n  CATEGORIES: [\n${body}\n  ]\n};\n`
  );
}

async function main() {
  const cfg = parseConfig(await readFile(CONFIG_PATH, "utf8"));
  const subjectCat = CATEGORIES.find((c) => c.key === targetKey);
  if (!subjectCat) {
    console.error(`✗ لا يوجد تصنيف بالمفتاح: ${targetKey}`);
    process.exit(1);
  }
  const isFlag = targetKey === "flag";
  console.log(`\n=== حلّ روابط: ${subjectCat.labelAr} (${targetKey}) ===`);
  const resolved = await pool(subjectCat.items, CONCURRENCY, async (item, i) => {
    await sleep(120 * (i % CONCURRENCY) + Math.floor(Math.random() * 150));
    const url = await resolve(item, isFlag);
    console.log((url ? "  ✓ " : "  ✗ ") + item.name + (url ? "" : "  (لم يُعثر على صورة)"));
    return { name: item.name, url };
  });
  let n = 0;
  const images = [];
  for (const r of resolved) {
    if (!r.url) continue;
    n += 1;
    images.push({ n, name: r.name, url: r.url });
  }
  console.log(`  الإجمالي: ${images.length}/${subjectCat.items.length}`);

  // دمج: التصنيف الهدف فقط يحصل على urls جديدة، الباقي يبقى كما هو (يقرأ من R2)
  cfg.CATEGORIES = cfg.CATEGORIES.map((c) =>
    c.key === targetKey
      ? { key: c.key, labelAr: c.labelAr, emoji: c.emoji, ext: c.ext, images }
      : c
  );
  await writeFile(CONFIG_PATH, renderConfig(cfg), "utf8");
  console.log(`\n✔ حُدّث config.js — تصنيف "${subjectCat.labelAr}" فقط بروابط جديدة، الباقي دون تغيير.`);
}

main().catch((e) => {
  console.error("✗ خطأ:", e);
  process.exit(1);
});
