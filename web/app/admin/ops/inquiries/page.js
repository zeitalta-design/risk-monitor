"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/**
 * Phase228: 問い合わせ管理ページ
 * - 一覧表示 / 絞り込み / 検索
 * - ステータス変更 / 担当者メモ
 * - 詳細パネル / 返信履歴の土台
 */

const TYPE_LABELS = {
  general: "一般問い合わせ",
  listing_request: "公開依頼",
  correction: "情報修正依頼",
  deletion: "削除依頼",
  bug_report: "不具合報告",
  organizer_apply: "データソース登録申請",
};

const STATUS_OPTIONS = [
  { value: "open", label: "未対応", style: "bg-red-100 text-red-800 border-red-200" },
  { value: "in_progress", label: "対応中", style: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "resolved", label: "対応済み", style: "bg-green-100 text-green-800 border-green-200" },
  { value: "on_hold", label: "保留", style: "bg-gray-100 text-gray-700 border-gray-200" },
];

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "緊急", style: "text-red-600" },
  { value: "high", label: "高", style: "text-orange-600" },
  { value: "normal", label: "通常", style: "text-gray-600" },
  { value: "low", label: "低", style: "text-gray-400" },
];

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState([]);
  const [summary, setSummary] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  // フィルター
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterType) params.set("type", filterType);
    if (searchQ) params.set("q", searchQ);

    try {
      const res = await fetch(`/api/admin/ops/inquiries?${params}`);
      const data = await res.json();
      setInquiries(data.inquiries || []);
      setSummary(data.summary || {});
      setTotal(data.total || 0);
    } catch {
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType, searchQ]);

  useEffect(() => { fetchInquiries(); }, [fetchInquiries]);

  async function updateInquiry(id, updates) {
    try {
      const res = await fetch("/api/admin/ops/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        const data = await res.json();
        setInquiries((prev) => prev.map((inq) => inq.id === id ? { ...inq, ...data.inquiry } : inq));
        if (selected?.id === id) setSelected((prev) => ({ ...prev, ...data.inquiry }));
      }
    } catch {}
  }

  async function deleteInquiry(id) {
    try {
      const res = await fetch("/api/admin/ops/inquiries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setInquiries((prev) => prev.filter((inq) => inq.id !== id));
        setTotal((prev) => prev - 1);
        if (selected?.id === id) setSelected(null);
        // サマリーを再取得
        fetchInquiries();
      } else {
        const data = await res.json();
        alert(data.error || "削除に失敗しました");
      }
    } catch {
      alert("削除に失敗しました");
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">問い合わせ管理</h1>
        <p className="text-sm text-gray-500 mt-1">
          全 {total} 件 · 未対応 {summary.open || 0} 件 · 対応中 {summary.in_progress || 0} 件
        </p>
      </div>

      {/* ステータスサマリー */}
      <div className="flex flex-wrap gap-2 mb-6">
        <SummaryChip
          label="すべて"
          count={total}
          active={!filterStatus}
          onClick={() => setFilterStatus("")}
        />
        {STATUS_OPTIONS.map((s) => (
          <SummaryChip
            key={s.value}
            label={s.label}
            count={summary[s.value] || 0}
            active={filterStatus === s.value}
            onClick={() => setFilterStatus(filterStatus === s.value ? "" : s.value)}
          />
        ))}
      </div>

      {/* フィルター・検索 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">種別：すべて</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="件名・氏名・メールで検索…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
      </div>

      {/* メインコンテンツ: テーブル + 詳細パネル */}
      <div className="flex gap-6">
        {/* テーブル */}
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${selected ? "flex-1 min-w-0" : "w-full"}`}>
          {loading ? (
            <div className="p-8 text-center text-gray-400">読み込み中…</div>
          ) : inquiries.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-500 font-bold">問い合わせはありません</p>
              <p className="text-gray-400 text-sm mt-1">
                {filterStatus || filterType || searchQ
                  ? "フィルター条件に一致する問い合わせがありません"
                  : "まだ問い合わせが届いていません"}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-extrabold text-gray-600 text-xs">ID</th>
                  <th className="text-left px-4 py-3 font-extrabold text-gray-600 text-xs">状態</th>
                  <th className="text-left px-4 py-3 font-extrabold text-gray-600 text-xs">緊急度</th>
                  <th className="text-left px-4 py-3 font-extrabold text-gray-600 text-xs">種別</th>
                  <th className="text-left px-4 py-3 font-extrabold text-gray-600 text-xs">件名</th>
                  <th className="text-left px-4 py-3 font-extrabold text-gray-600 text-xs">氏名</th>
                  <th className="text-left px-4 py-3 font-extrabold text-gray-600 text-xs">受信日時</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inq) => {
                  const statusOpt = STATUS_OPTIONS.find((s) => s.value === inq.status);
                  const prioOpt = PRIORITY_OPTIONS.find((p) => p.value === inq.priority);
                  return (
                    <tr
                      key={inq.id}
                      onClick={() => setSelected(inq)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        selected?.id === inq.id ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">#{inq.id}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${statusOpt?.style || ""}`}>
                          {statusOpt?.label || inq.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${prioOpt?.style || ""}`}>
                          {prioOpt?.label || inq.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {TYPE_LABELS[inq.inquiry_type] || inq.inquiry_type}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-800 max-w-[200px] truncate">
                        {inq.subject}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{inq.name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(inq.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 詳細パネル */}
        {selected && (
          <DetailPanel
            inquiry={selected}
            onClose={() => setSelected(null)}
            onUpdate={updateInquiry}
            onDelete={deleteInquiry}
          />
        )}
      </div>
    </div>
  );
}

function DetailPanel({ inquiry, onClose, onUpdate, onDelete }) {
  const [memo, setMemo] = useState(inquiry.admin_memo || "");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveMemo() {
    setSaving(true);
    await onUpdate(inquiry.id, { admin_memo: memo });
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete(inquiry.id);
    setDeleting(false);
    setShowDeleteConfirm(false);
  }

  return (
    <div className="w-96 shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-y-auto max-h-[80vh]">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <h3 className="font-extrabold text-gray-900">問い合わせ #{inquiry.id}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* メタ情報 */}
        <div className="space-y-2">
          <InfoRow label="種別" value={TYPE_LABELS[inquiry.inquiry_type] || inquiry.inquiry_type} />
          <InfoRow label="氏名" value={inquiry.name} />
          <InfoRow label="メール" value={inquiry.email} />
          <InfoRow label="受信日時" value={formatDateTime(inquiry.created_at)} />
          {inquiry.event_title && (
            <InfoRow label="対象リスク情報" value={inquiry.event_title} />
          )}
          {inquiry.target_url && (
            <InfoRow label="対象URL" value={
              <a href={inquiry.target_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs break-all">
                {inquiry.target_url}
              </a>
            } />
          )}
        </div>

        {/* 件名・本文 */}
        <div>
          <h4 className="text-xs font-extrabold text-gray-500 uppercase mb-1">件名</h4>
          <p className="text-sm font-bold text-gray-900">{inquiry.subject}</p>
        </div>
        <div>
          <h4 className="text-xs font-extrabold text-gray-500 uppercase mb-1">内容</h4>
          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {inquiry.body}
          </div>
        </div>

        {/* ステータス変更 */}
        <div>
          <h4 className="text-xs font-extrabold text-gray-500 uppercase mb-2">ステータス変更</h4>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => onUpdate(inquiry.id, { status: s.value })}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                  inquiry.status === s.value
                    ? s.style + " ring-2 ring-offset-1 ring-blue-400"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 緊急度変更 */}
        <div>
          <h4 className="text-xs font-extrabold text-gray-500 uppercase mb-2">緊急度</h4>
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => onUpdate(inquiry.id, { priority: p.value })}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                  inquiry.priority === p.value
                    ? "bg-blue-50 border-blue-300 text-blue-800"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 担当者メモ */}
        <div>
          <h4 className="text-xs font-extrabold text-gray-500 uppercase mb-2">担当者メモ</h4>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none"
            placeholder="対応メモを記録…"
          />
          <button
            onClick={saveMemo}
            disabled={saving}
            className="mt-2 w-full bg-blue-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中…" : "メモを保存"}
          </button>
        </div>

        {/* 返信履歴（土台） */}
        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs font-extrabold text-gray-500 uppercase mb-2">返信履歴</h4>
          <div className="text-center py-4">
            <p className="text-xs text-gray-400">返信機能は次期フェーズで実装予定です</p>
          </div>
        </div>

        {/* 削除 */}
        <div className="border-t border-gray-100 pt-4">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-xs text-red-400 hover:text-red-600 py-2 transition-colors"
            >
              この問い合わせを削除
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-bold text-red-800 mb-2">この問い合わせを削除しますか？</p>
              <p className="text-xs text-red-600 mb-1">この操作は元に戻せません。</p>
              <div className="text-xs text-gray-600 mb-3 space-y-0.5">
                <p>件名: {inquiry.subject}</p>
                <p>氏名: {inquiry.name}</p>
                <p>受信: {formatDateTime(inquiry.created_at)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? "削除中…" : "削除する"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-white text-gray-600 text-xs font-bold py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
        active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {label} <span className="ml-1 opacity-70">{count}</span>
    </button>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 shrink-0 w-16">{label}</span>
      <span className="text-gray-800 font-medium">{typeof value === "string" ? value : value}</span>
    </div>
  );
}

function formatDateTime(str) {
  if (!str) return "";
  const d = new Date(str);
  return d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
