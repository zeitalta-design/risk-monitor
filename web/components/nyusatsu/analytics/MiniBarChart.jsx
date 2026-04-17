/**
 * シンプルな HTML/CSS の横棒チャート（依存なし）
 *
 * props:
 *   items: [{ label, value, sub? }]  // sub は下段に表示する副情報（金額等）
 *   max:   number|undefined           // 指定なしなら items 内の最大値
 *   barColor: Tailwind クラス
 */
export default function MiniBarChart({ items, max, barColor = "bg-[#2F9FD3]" }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-gray-500">データなし</p>;
  }
  const maxVal = max ?? Math.max(...items.map((i) => i.value ?? 0));
  if (maxVal <= 0) {
    return <p className="text-sm text-gray-500">データなし</p>;
  }
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const pct = Math.max(1, Math.round(((item.value ?? 0) / maxVal) * 100));
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-20 text-right text-[#4B5563] tabular-nums flex-shrink-0">
              {item.label}
            </span>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden relative">
              <div
                className={`h-full ${barColor} transition-all`}
                style={{ width: `${pct}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-xs text-[#333]">
                {item.sub || item.value?.toLocaleString() || "—"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
