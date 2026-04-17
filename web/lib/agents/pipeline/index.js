/**
 * Pipeline レイヤーのエントリ集約。
 * ドメイン別モジュールをここから再エクスポートする。
 */
export {
  // KKJ
  runKkjPipeline,
  processKkjRecords,
  // 中央省庁6省庁
  processCentralMinistries,
  // 調達ポータル 落札結果
  processPPortalResults,
} from "./nyusatsu.js";
