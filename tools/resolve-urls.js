/*
  معاينة فورية بصور حقيقية — دون R2 ودون تثبيت مكتبات.
  يجلب روابط صور حرّة من ويكيبيديا/ويكيميديا كومنز ويكتبها مباشرة في ../config.js
  (كل عنصر يحصل على حقل url مباشر). مفيد لرؤية اللعبة بصور حقيقية قبل ربط R2.

  التشغيل:
    node tools/resolve-urls.js

  لاحقاً — لنقل الصور إلى R2 (المعمارية المقصودة) استخدم fetch-and-upload.js.
*/

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CATEGORIES } from "./subjects.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const UA = "GuessGameImageFetcher/1.0 (educational game preview)";
const MAX_WIDTH = 1400;
const CONCURRENCY = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function renderConfig(cats) {
  const body = cats
    .map((c) => {
      const imgs = c.images
        .map((im) => `        { n: ${im.n}, name: ${JSON.stringify(im.name)}, url: ${JSON.stringify(im.url)} }`)
        .join(",\n");
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
    `/* مُولَّد بواسطة tools/resolve-urls.js — صور مباشرة من ويكيميديا (معاينة بدون R2). */\n` +
    `window.GAME_CONFIG = {\n  R2_PUBLIC_URL: "",\n\n  CATEGORIES: [\n${body}\n  ]\n};\n`
  );
}

async function main() {
  const cats = [];
  for (const cat of CATEGORIES) {
    const isFlag = cat.key === "flag";
    console.log(`\n=== ${cat.labelAr} ===`);
    const resolved = await pool(cat.items, CONCURRENCY, async (item, i) => {
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
    console.log(`  الإجمالي: ${images.length}/${cat.items.length}`);
    cats.push({ key: cat.key, labelAr: cat.labelAr, emoji: cat.emoji, ext: cat.ext, images });
  }
  await writeFile(join(ROOT, "config.js"), renderConfig(cats), "utf8");
  const total = cats.reduce((s, c) => s + c.images.length, 0);
  console.log(`\n✔ كُتب config.js بـ ${total}/100 صورة حقيقية مباشرة من ويكيميديا.`);
  console.log(`✔ حدّث الصفحة في المتصفح لرؤية الصور.`);
}

main().catch((e) => {
  console.error("✗ خطأ:", e);
  process.exit(1);
});
