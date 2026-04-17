/**
 * concentration_score (HHI [0..1]) をラベル付きバッジとして表示。
 *   >= 0.70 : 高依存 (red)
 *   0.40-0.70: やや偏り (amber)
 *   < 0.40 : 分散型 (green)
 */
export default function ConcentrationBadge({ score, label = "発注機関集中度" }) {
  if (score == null || Number.isNaN(score)) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  let text, cls;
  if (score >= 0.7) {
    text = "高依存";
    cls = "bg-red-100 text-red-700 border-red-300";
  } else if (score >= 0.4) {
    text = "やや偏り";
    cls = "bg-amber-100 text-amber-700 border-amber-300";
  } else {
    text = "分散型";
    cls = "bg-green-100 text-green-700 border-green-300";
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${cls}`}
      title={`${label}: HHI=${score.toFixed(3)}`}
    >
      <span>{text}</span>
      <span className="text-[10px] opacity-70">({score.toFixed(2)})</span>
    </span>
  );
}
