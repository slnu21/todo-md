/**
 * 스크린샷 여러 장을 한 장으로 — 일그러짐을 한눈에 비교하려고.
 *   node scripts/contact-sheet.mjs <out.png> <a.png> <b.png> ...  [--cols 4] [--scale 0.6]
 * 파일 이름이 각 칸 아래 캡션으로 붙는다.
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const cols = Number(opt("--cols", 4));
const scale = Number(opt("--scale", 0.6));
const [out, ...files] = args;
if (!out || files.length === 0) throw new Error("usage: contact-sheet.mjs <out.png> <img...>");

const cells = files.map((f) => {
  const b64 = readFileSync(f).toString("base64");
  return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${basename(f)}</figcaption></figure>`;
}).join("");
const html = `<html><body style="margin:0;background:#888;font:12px sans-serif">
<div style="display:grid;grid-template-columns:repeat(${cols},max-content);gap:10px;padding:10px;width:max-content">${cells}</div>
<style>figure{margin:0;background:#fff;padding:4px}img{display:block;zoom:${scale}}figcaption{padding:3px 0 0}</style></body></html>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
await p.setContent(html);
await p.locator("div").first().screenshot({ path: out });
await b.close();
console.log(out);
