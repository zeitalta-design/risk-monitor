/**
 * 危険度バッジコンポーネント
 * level: "low" | "medium" | "high" | "critical"
 */
export default function RiskBadge({ score, level, label, showScore = false, size = "sm" }) {
  const colorMap = {
    low:      "bg-gray-100 text-gray-600 border-gray-200",
    medium:   "bg-yellow-50 text-yellow-700 border-yellow-200",
    high:     "bg-orange-50 text-orange-700 border-orange-200",
    critical: "bg-red-50 text-red-700 border-red-200",
  };
  const cls = colorMap[level] || colorMap.low;
  const sizeClass = size === "lg" ? "px-3 py-1 text-sm font-semibold" : "px-2 py-0.5 text-xs font-medium";

  return (
    <span className={`inline-flex items-center gap-1 rounded border ${cls} ${sizeClass}`}>
      <span>危険度: {label}</span>
      {showScore && <span className="opacity-60">({score})</span>}
    </span>
  );
}
