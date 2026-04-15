"use client";

/**
 * 汎用 検索フォーム
 *
 * フィールド定義を渡すだけで、国交省ネガティブ情報検索風の検索UIを構築できる。
 * 行政処分DB / 産廃DB / 補助金DB など 6DB 横断で再利用する想定。
 *
 * Props:
 *   - fields: [{ type, name, label, ... }]  フィールド定義
 *   - values: { [name]: value }             各フィールドの入力値
 *   - onChange: (name, value) => void       個別更新
 *   - onSearch: () => void                  🔍 検索ボタン押下
 *   - onReset: () => void                   リセット
 *   - sortOptions: [{ key, label }]         並び替え選択肢
 *   - sort: string                          現在のソート
 *   - onSortChange: (key) => void           ソート変更
 *   - submitLabel: string (default "🔍 検索")
 *
 * フィールドタイプ:
 *   - text: テキスト入力（placeholder, fullWidth）
 *   - select: セレクトボックス（options: [{value, label, icon?}], emptyOption: {value, label}）
 *   - dateRange: 日付範囲（name は配列 [fromKey, toKey] で指定）
 */

export default function SearchForm({
  fields = [],
  values = {},
  onChange,
  onSearch,
  onReset,
  sortOptions = [],
  sort = "",
  onSortChange,
  submitLabel = "🔍 検索",
}) {
  const onEnter = (e) => {
    if (e.key === "Enter") onSearch?.();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => (
          <FieldRenderer
            key={Array.isArray(f.name) ? f.name.join("-") : f.name}
            field={f}
            values={values}
            onChange={onChange}
            onEnter={onEnter}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onSearch}
            className="px-6 py-2 bg-[#1F6FB2] text-white font-bold text-sm rounded-lg hover:bg-[#1B5F99] transition-colors"
          >
            {submitLabel}
          </button>
          <button
            onClick={onReset}
            className="px-5 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            リセット
          </button>
        </div>
        {sortOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">並び替え</label>
            <select
              value={sort}
              onChange={(e) => onSortChange?.(e.target.value)}
              className="text-xs border rounded-lg px-2.5 py-1.5 bg-white"
            >
              {sortOptions.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 個別フィールド ──────────────────────

function FieldRenderer({ field, values, onChange, onEnter }) {
  const { type, name, label, colSpan } = field;
  const wrapperClass = colSpan === "full" ? "md:col-span-2" : "";

  if (type === "text") {
    return (
      <div className={wrapperClass}>
        <Label>{label}</Label>
        <input
          type="text"
          value={values[name] || ""}
          onChange={(e) => onChange?.(name, e.target.value)}
          onKeyDown={onEnter}
          placeholder={field.placeholder || ""}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>
    );
  }

  if (type === "select") {
    const emptyOption = field.emptyOption || { value: "", label: "指定なし" };
    return (
      <div className={wrapperClass}>
        <Label>{label}</Label>
        <select
          value={values[name] || ""}
          onChange={(e) => onChange?.(name, e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value={emptyOption.value}>{emptyOption.label}</option>
          {(field.options || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.icon ? `${o.icon} ${o.label}` : o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "dateRange") {
    const [fromKey, toKey] = name;
    return (
      <div className={wrapperClass}>
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={values[fromKey] || ""}
            onChange={(e) => onChange?.(fromKey, e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-gray-400 text-sm">〜</span>
          <input
            type="date"
            value={values[toKey] || ""}
            onChange={(e) => onChange?.(toKey, e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>
    );
  }

  return null;
}

function Label({ children }) {
  return (
    <label className="block text-xs font-semibold text-gray-600 mb-1.5">{children}</label>
  );
}
