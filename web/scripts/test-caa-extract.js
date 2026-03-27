#!/usr/bin/env node
/**
 * 消費者庁 detail.php の Quill JSON 抽出テスト
 */

async function main() {
  const url = "https://www.recall.caa.go.jp/result/detail.php?rcl=00000035078&screenkbn=06";
  const res = await fetch(url);
  const html = await res.text();

  // contentsText = '{"ops":[{"insert":"..."}]}'; のパターンを抽出
  // 引用符はエスケープされている: {\"ops\":[{\"insert\":\"...\"}]}
  const blocks = extractQuillBlocks(html);

  console.log(`Quill ブロック: ${blocks.length}件\n`);
  blocks.forEach((block, i) => {
    console.log(`=== Block ${i + 1} (${block.length} chars) ===`);
    console.log(block.substring(0, 250));
    console.log("");
  });

  // ブロック内容を分類
  if (blocks.length >= 4) {
    console.log("=== 構造化抽出結果 ===");
    console.log("連絡先:", blocks[0]?.substring(0, 150));
    console.log("\n対応方法:", blocks[1]?.substring(0, 150));
    console.log("\n対象特定:", blocks[2]?.substring(0, 150));
    console.log("\n回収理由:", blocks[3]?.substring(0, 150));
  }
}

function extractQuillBlocks(html) {
  const blocks = [];
  // contentsText = '...' のパターンで、{\"ops\" を含むものを抽出
  let pos = 0;
  while (true) {
    const marker = "contentsText = '";
    const idx = html.indexOf(marker, pos);
    if (idx === -1) break;
    const start = idx + marker.length;
    const end = html.indexOf("'", start);
    if (end === -1) break;
    const raw = html.substring(start, end);
    pos = end + 1;

    if (!raw || raw.length < 10) continue;
    if (!raw.includes("ops")) continue;

    // JSON パース: エスケープされた引用符を戻す
    try {
      const jsonStr = raw.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\t/g, "\t");
      const quill = JSON.parse(jsonStr);
      const text = quill.ops.map(op => typeof op.insert === "string" ? op.insert : "").join("");
      if (text.trim().length > 0) blocks.push(text.trim());
    } catch {
      // フォールバック: insert値を直接抽出
      const insertRegex = /\\"insert\\":\\"((?:[^\\"]|\\\\[^"])*)\\"/g;
      let m;
      const parts = [];
      while ((m = insertRegex.exec(raw)) !== null) {
        parts.push(m[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t"));
      }
      if (parts.length > 0) blocks.push(parts.join("").trim());
    }
  }
  return blocks;
}

main().catch(console.error);
