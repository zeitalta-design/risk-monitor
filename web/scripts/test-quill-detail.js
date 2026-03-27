#!/usr/bin/env node
import { fetchHtml } from "../lib/core/automation/fetch-helper.js";

const url = "https://www.recall.caa.go.jp/result/detail.php?rcl=00000035069&screenkbn=06";
const result = await fetchHtml(url);
const html = result.html;

// HTMLの中のcontentsTextの生データを確認
const idx = html.indexOf('contentsText');
let count = 0;
let pos = 0;
while (true) {
  const i = html.indexOf("contentsText = '", pos);
  if (i === -1) break;
  count++;
  const start = i + 16; // "contentsText = '" の長さ
  // raw の最初の20文字を確認
  console.log(`[${count}] raw start: ${JSON.stringify(html.substring(start, start + 60))}`);
  pos = start + 1;
}
console.log(`Total contentsText: ${count}`);

// 実際のデリミタ確認: ' で閉じてるか？ それとも '; ？
const firstDataIdx = html.indexOf("contentsText = '{", 0);
if (firstDataIdx !== -1) {
  const dataStart = firstDataIdx + 16;
  // 次の '; を探す
  const dataEnd = html.indexOf("';", dataStart);
  if (dataEnd !== -1) {
    const raw = html.substring(dataStart, dataEnd);
    console.log(`\nFirst data block length: ${raw.length}`);
    console.log(`First 100 chars: ${raw.substring(0, 100)}`);

    // \" を " に置換してJSON parse
    const cleaned = raw.replace(/\\"/g, '"');
    console.log(`\nAfter unescape: ${cleaned.substring(0, 100)}`);

    try {
      const quill = JSON.parse(cleaned);
      const text = quill.ops.map(op => typeof op.insert === "string" ? op.insert : "").join("");
      console.log(`\nParsed text: ${text.substring(0, 200)}`);
    } catch (e) {
      console.log(`\nJSON parse failed: ${e.message}`);

      // insert の値を直接正規表現で (エスケープ済みJSON内)
      const insertRegex = /\\"insert\\":\\"((?:[^\\"\\\\]|\\\\.)*)\\"/g;
      let m;
      const parts = [];
      while ((m = insertRegex.exec(raw)) !== null) {
        let t = m[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t");
        parts.push(t);
      }
      console.log(`Fallback parts: ${parts.length}`);
      if (parts.length > 0) console.log(`First part: ${parts[0].substring(0, 100)}`);
    }
  }
}
