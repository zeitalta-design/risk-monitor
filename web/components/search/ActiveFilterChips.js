"use client";

/**
 * 適用中のフィルタ条件をチップで表示するコンポーネント
 *
 * Props:
 *   - chipDefs: [{ key, label, resolve?(value) => string }]
 *   - filters: { [key]: value }
 *   - onRemove: (key, value) => void   チップを×で解除（value="" を渡す）
 */
export default function ActiveFilterChips({ chipDefs = [], filters = {}, onRemove }) {
  const chips = chipDefs
    .filter((d) => filters[d.key])
    .map((d) => ({
      key: d.key,
      label: d.label,
      displayValue: d.resolve ? d.resolve(filters[d.key]) : filters[d.key],
    }));

  if (chips.length === 0) return null;

  const clearAll = () => {
    chipDefs.forEach((d) => onRemove?.(d.key, ""));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <span className="text-[11px] text-gray-400 shrink-0">適用中:</span>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1 max-w-[240px]"
        >
          <span className="text-blue-400 font-medium shrink-0">{chip.label}:</span>
          <span className="truncate" title={chip.displayValue}>{chip.displayValue}</span>
          <button
            onClick={() => onRemove?.(chip.key, "")}
            className="ml-0.5 shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-700 transition-colors"
            aria-label={`${chip.label}の条件を解除`}
          >
            ×
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button
          onClick={clearAll}
          className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
        >
          すべて解除
        </button>
      )}
    </div>
  );
}
