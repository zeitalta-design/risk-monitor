"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * 管理画面共通フォームコンポーネント
 *
 * @param {Object} props
 * @param {string} props.title - ページタイトル
 * @param {string} props.apiPath - API パス (e.g. "/api/admin/sanpai")
 * @param {string} props.basePath - 管理画面パス (e.g. "/admin/sanpai")
 * @param {number|null} [props.itemId] - 編集時の ID（null なら新規作成）
 * @param {Array<{key: string, label: string, type?: string, required?: boolean, options?: Array, placeholder?: string}>} props.fields
 * @param {Object} [props.defaults] - 新規作成時のデフォルト値
 */
export default function AdminFormPage({ title, apiPath, basePath, itemId, fields, defaults = {} }) {
  const router = useRouter();
  const isEdit = !!itemId;
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    async function load() {
      try {
        const res = await fetch(`${apiPath}/${itemId}`);
        if (!res.ok) { setError("データが見つかりません"); setLoading(false); return; }
        const data = await res.json();
        setForm(data.item || {});
      } catch { setError("読み込みに失敗しました"); }
      finally { setLoading(false); }
    }
    load();
  }, [isEdit, itemId, apiPath]);

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // 必須チェック
    for (const field of fields) {
      if (field.required && !form[field.key] && form[field.key] !== 0) {
        setError(`${field.label} は必須です`);
        return;
      }
    }

    setSaving(true);
    try {
      const url = isEdit ? `${apiPath}/${itemId}` : apiPath;
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存に失敗しました");
        return;
      }
      setSuccess("保存しました");
      if (!isEdit && data.id) {
        setTimeout(() => router.push(`${basePath}/${data.id}/edit`), 500);
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-8"><div className="card p-8 animate-pulse"><div className="h-32 bg-gray-100 rounded" /></div></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.type === "select" ? (
              <select
                value={form[field.key] || ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {(field.options || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                value={form[field.key] || ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder || ""}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            ) : field.type === "checkbox" ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.checked ? 1 : 0)}
                  className="rounded"
                />
                <span className="text-sm">{field.checkLabel || "有効"}</span>
              </label>
            ) : (
              <input
                type={field.type || "text"}
                value={form[field.key] ?? ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder || ""}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-3 pt-4 border-t">
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? "保存中..." : isEdit ? "更新" : "作成"}
          </button>
          <Link href={basePath} className="text-sm text-gray-500 hover:underline">
            キャンセル
          </Link>
        </div>
      </form>

      <div className="mt-4">
        <Link href={basePath} className="text-sm text-gray-500 hover:underline">← 一覧に戻る</Link>
      </div>
    </div>
  );
}
