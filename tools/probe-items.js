/*
  يحلّ روابط مرشّحة لعناصر محدّدة (كل استعلام على حدة) للمعاينة والاختيار اليدوي —
  دون كتابة أي شيء. يُستخدم للتحقق البصري قبل الرفع.

  التشغيل:
    node tools/probe-items.js "saudi-food:جريش" "saudi-food:مرقوق" "animal:نسر"
*/

import { fileURLToPath } from "node:url";
import { CATEGORIES } from "./subjects.js";

const UA = "GuessGameImageFetcher/1.0 (educational game preview)";
const MAX_WIDTH = 1400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url, tries = 6) {
  let lastErr;
  for (let a = 0; a < tries; a++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.status === 429 || res.status === 503) { await sleep(Math.min(1000 * 2 ** a, 12000)); continue; }
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    } catch (e) { lastErr = e; await sleep(Math.min(800 * 2 ** a, 6000)); }
  }
  throw lastErr || new Error("فشل الجلب");
}
async function fromWiki(lang, title) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=pageimages&piprop=original|thumbnail&pithumbsize=${MAX_WIDTH}&redirects=1&titles=${encodeURIComponent(title)}`;
  const d = await fetchRetry(url); const p = d?.query?.pages?.[0];
  if (!p || p.missing) return null; return p.thumbnail?.source || p.original?.source || null;
}
async function fromCommonsFile(title, width) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|mime&iiurlwidth=${width}&titles=${encodeURIComponent("File:" + title)}`;
  const d = await fetchRetry(url); const info = d?.query?.pages?.[0]?.imageinfo?.[0]; return info?.thumburl || info?.url || null;
}
async function fromCommonsSearch(term, width) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|mime&iiurlwidth=${width}`;
  const d = await fetchRetry(url); const pages = d?.query?.pages || [];
  const ranked = pages.map((p) => p.imageinfo?.[0]).filter(Boolean).filter((i) => /^image\/(jpeg|png|webp)$/.test(i.mime));
  const info = ranked[0] || pages[0]?.imageinfo?.[0]; return info?.thumburl || info?.url || null;
}
async function resolveOne(q, isFlag) {
  const width = isFlag ? 1000 : MAX_WIDTH;
  if (q.kind === "wiki") return { label: `wiki:${q.lang}:${q.title}`, url: await fromWiki(q.lang, q.title) };
  if (q.kind === "commonsFile") return { label: `file:${q.title}`, url: await fromCommonsFile(q.title, width) };
  if (q.kind === "commonsSearch") return { label: `search:${q.term}`, url: await fromCommonsSearch(q.term, width) };
  return { label: "?", url: null };
}

async function main() {
  const targets = process.argv.slice(2).map((s) => { const i = s.indexOf(":"); return { key: s.slice(0, i), name: s.slice(i + 1) }; });
  for (const t of targets) {
    const cat = CATEGORIES.find((c) => c.key === t.key);
    const item = cat && cat.items.find((it) => it.name === t.name);
    console.log(`\n=== ${t.key} / ${t.name} ===`);
    if (!item) { console.log("  (لم يُعثر على العنصر)"); continue; }
    for (const q of item.queries) {
      try { const r = await resolveOne(q, t.key === "flag"); console.log(`  [${r.label}]\n    ${r.url || "—"}`); }
      catch (e) { console.log(`  خطأ: ${e.message}`); }
      await sleep(120);
    }
  }
}
main().catch((e) => { console.error("✗", e); process.exit(1); });
