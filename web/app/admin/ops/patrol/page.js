"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/**
 * 巡回パトロール — リスクデータ品質監視
 * 6カテゴリ横断でデータ品質を確認・対処
 */

const LEVEL_CONFIG = {
  danger: { label: "危険", dot: "bg-red-500", badge: "bg-red-100 text-red-800 border-red-200", card: "border-red-300 bg-red-50" },
  warning: { label: "要確認", dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800 border-yellow-200", card: "border-yellow-300 bg-yellow-50" },
  info: { label: "軽微", dot: "bg-blue-400", badge: "bg-blue-100 text-blue-800 border-blue-200", card: "border-gray-200 bg-white" },
};

const DOMAIN_BADGE = {
  "gyosei-shobun": { label: "行政処分", bg: "bg-red-100 text-red-700 border-red-200" },
  sanpai: { label: "産廃処分", bg: "bg-orange-100 text-orange-700 border-orange-200" },
  nyusatsu: { label: "入札", bg: "bg-blue-100 text-blue-700 border-blue-200" },
  shitei: { label: "指定管理", bg: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  hojokin: { label: "補助金", bg: "bg-purple-100 text-purple-700 border-purple-200" },
  kyoninka: { label: "許認可", bg: "bg-gray-100 text-gray-700 border-gray-200" },
};

export default function PatrolPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    fetchPatrolData();
  }, []);

  const fetchPatrolData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ops/patrol");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("巡回パトロールデータ取得エラー:", err);
      setData({ issueCards: [], totalPublished: 0, error: "取得に失敗しました" });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIssue = useCallback(async (issueKey) => {
    setSelectedIssue(issueKey);
    setItemsLoading(true);
    try {
      const res = await fetch(`/api/admin/ops/patrol?issue=${issueKey}`);
      const json = await res.json();
      setItems(json.items || []);
      const card = data?.issueCards?.find((c) => c.key === issueKey);
      setSelectedCard(card || null);
    } catch {
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, [data]);

  const handleAction = useCallback(async (action, params) => {
    try {
      const res = await fetch("/api/admin/ops/patrol", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
      });
      const result = await res.json();
      if (res.ok) {
        showFeedback("success", result.message);
        // リロード
        await fetchPatrolData();
        if (selectedIssue) {
          const issueRes = await fetch(`/api/admin/ops/patrol?issue=${selectedIssue}`);
          const issueJson = await issueRes.json();
          setItems(issueJson.items || []);
        }
      } else {
        showFeedback("error", result.error);
      }
    } catch {
      showFeedback("error", "操作に失敗しました");
    }
  }, [fetchPatrolData, selectedIssue]);

  const showFeedback = (type, message) => {
    setActionFeedback({ type, message });
    setTimeout(() => setActionFeedback(null), 5000);
  };

  if (loading) return <LoadingSkeleton />;
  if (!data) return <ErrorState message="データを取得できませんでした" />;

  const { issueCards = [], totalPublished = 0, error: apiError } = data;
  const totalIssues = issueCards.reduce((sum, c) => sum + (c.count || 0), 0);

  if (apiError && issueCards.length === 0) return <ErrorState message={apiError} />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* ヘッダー */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">巡回パトロール</h1>
        <p className="text-sm text-gray-500 mt-1">
          公開データ {totalPublished} 件 · 要確認 {totalIssues} 件
        </p>
      </div>

      {/* 問題種別カード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {issueCards.map((card) => {
          const lc = LEVEL_CONFIG[card.level];
          const active = selectedIssue === card.key;
          return (
            <button
              key={card.key}
              onClick={() => card.count > 0 && loadIssue(card.key)}
              disabled={card.count === 0}
              className={`text-left p-4 rounded-xl border transition-all ${
                active
                  ? "ring-2 ring-blue-500 border-blue-400 bg-blue-50"
                  : card.count > 0
                    ? `${lc.card} hover:shadow-md cursor-pointer`
                    : "border-gray-200 bg-gray-50 opacity-60 cursor-default"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${card.count > 0 ? lc.dot : "bg-green-500"}`} />
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${card.count > 0 ? lc.badge : "bg-green-100 text-green-800 border-green-200"}`}>
                  {card.count > 0 ? lc.label : "問題なし"}
                </span>
              </div>
              <p className={`text-2xl font-extrabold ${card.count > 0 ? "text-gray-900" : "text-green-700"}`}>
                {card.count}
                <span className="text-sm font-bold text-gray-500 ml-1">件</span>
              </p>
              <p className="text-xs text-gray-600 mt-1 font-medium">{card.label}</p>
            </button>
          );
        })}
      </div>

      {/* 問題一覧テーブル */}
      {selectedIssue && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* ヘッダー */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-extrabold text-gray-900">
                {selectedCard?.label || selectedIssue}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {items.length} 件が該当（最大50件/カテゴリ表示）
              </p>
            </div>
            <button
              onClick={() => { setSelectedIssue(null); setItems([]); setSelectedCard(null); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold"
            >
              閉じる
            </button>
          </div>

          {/* アクションフィードバック */}
          {actionFeedback && (
            <FeedbackBar feedback={actionFeedback} onClose={() => setActionFeedback(null)} />
          )}

          {itemsLoading ? (
            <div className="p-8 text-center text-gray-400">読み込み中...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-3xl mb-2">OK</div>
              <p className="text-green-700 font-bold">該当するデータはありません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {selectedIssue === "sync_failed" ? (
                <SyncFailedTable items={items} />
              ) : selectedIssue === "needs_review" ? (
                <ReviewTable items={items} onAction={handleAction} />
              ) : selectedIssue === "low_confidence" ? (
                <ExtractionTable items={items} />
              ) : (
                <DataItemTable items={items} onAction={handleAction} issueKey={selectedIssue} />
              )}
            </div>
          )}
        </div>
      )}

      {/* 選択前のガイド */}
      {!selectedIssue && (
        totalIssues === 0 ? (
          <div className="bg-green-50 rounded-xl border border-green-200 p-8 text-center">
            <p className="text-green-800 font-extrabold">現在、要確認のデータはありません</p>
            <p className="text-sm text-green-600 mt-1">すべての品質チェックをパスしています</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600 font-bold">問題カードをクリックすると該当データが表示されます</p>
          </div>
        )
      )}
    </div>
  );
}

/**
 * 通常データアイテムテーブル（ソースURL未設定、未公開、30日未更新、都道府県未設定）
 */
function DataItemTable({ items, onAction, issueKey }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">ID</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">カテゴリ</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">データ名</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">都道府県</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">最終更新</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">操作</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const badge = DOMAIN_BADGE[item.domain] || { label: item.domain, bg: "bg-gray-100 text-gray-700 border-gray-200" };
          return (
            <tr key={`${item.domain}-${item.id}`} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2.5 font-mono text-xs text-gray-500">#{item.id}</td>
              <td className="px-4 py-2.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.bg}`}>
                  {badge.label}
                </span>
              </td>
              <td className="px-4 py-2.5 max-w-[300px]">
                <div className="font-bold text-gray-800 truncate">{item.name || "（名称なし）"}</div>
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-600">
                {item.prefecture || <span className="text-red-500 font-bold">未設定</span>}
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(item.updated_at)}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.editPath && (
                    <Link
                      href={`${item.editPath}/${item.id}/edit`}
                      className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold border border-blue-200 transition-colors"
                    >
                      編集
                    </Link>
                  )}
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] px-2 py-1 rounded bg-gray-50 text-gray-700 hover:bg-gray-100 font-bold border border-gray-200 transition-colors"
                    >
                      ソース
                    </a>
                  )}
                  {issueKey === "unpublished" && (
                    <button
                      onClick={() => onAction("toggle_publish", { domain: item.domain, item_id: item.id })}
                      className="text-[11px] px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 font-bold border border-green-200 transition-colors"
                    >
                      公開する
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * 同期エラーテーブル
 */
function SyncFailedTable({ items }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">ID</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">カテゴリ</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">エラー内容</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">取得/失敗</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">実行日時</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const badge = DOMAIN_BADGE[item.domain] || { label: item.domain, bg: "bg-gray-100 text-gray-700 border-gray-200" };
          const detail = item.sync_detail || {};
          return (
            <tr key={`sync-${item.id}`} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2.5 font-mono text-xs text-gray-500">#{item.id}</td>
              <td className="px-4 py-2.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.bg}`}>
                  {badge.label}
                </span>
                <span className="text-[10px] text-gray-500 ml-1">{detail.run_type}</span>
              </td>
              <td className="px-4 py-2.5 max-w-[300px]">
                <div className="font-bold text-red-700 truncate text-xs">{detail.error_summary || "不明なエラー"}</div>
              </td>
              <td className="px-4 py-2.5 text-xs">
                <span className="text-gray-600">{detail.fetched_count || 0}件取得</span>
                {detail.failed_count > 0 && (
                  <span className="text-red-600 ml-1">/ {detail.failed_count}件失敗</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(detail.started_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * 要レビューテーブル
 */
function ReviewTable({ items, onAction }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">ID</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">カテゴリ</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">変更内容</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">信頼度</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">日時</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">操作</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const badge = DOMAIN_BADGE[item.domain] || { label: item.domain, bg: "bg-gray-100 text-gray-700 border-gray-200" };
          const detail = item.change_detail || {};
          const confidence = detail.confidence_score != null ? Math.round(detail.confidence_score * 100) : null;
          return (
            <tr key={`review-${item.id}`} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2.5 font-mono text-xs text-gray-500">#{item.entity_id || item.id}</td>
              <td className="px-4 py-2.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.bg}`}>
                  {badge.label}
                </span>
              </td>
              <td className="px-4 py-2.5 max-w-[300px]">
                <div className="text-xs">
                  <span className="font-bold text-gray-700">{detail.field_name}</span>
                  <span className="text-gray-400 mx-1">({detail.change_type})</span>
                </div>
                {detail.before_value && (
                  <div className="text-[10px] mt-0.5">
                    <span className="text-red-400 line-through">{truncate(detail.before_value, 30)}</span>
                    <span className="text-gray-400 mx-1">&rarr;</span>
                    <span className="text-green-700 font-bold">{truncate(detail.after_value, 30)}</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs">
                {confidence != null && (
                  <span className={`font-bold ${confidence >= 70 ? "text-green-600" : confidence >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                    {confidence}%
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(item.updated_at)}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  {item.editPath && item.entity_id && (
                    <Link
                      href={`${item.editPath}/${item.entity_id}/edit`}
                      className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold border border-blue-200 transition-colors"
                    >
                      編集
                    </Link>
                  )}
                  <button
                    onClick={() => onAction("mark_reviewed", { change_log_id: item.id })}
                    className="text-[11px] px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 font-bold border border-green-200 transition-colors"
                  >
                    レビュー済み
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * 信頼度低テーブル
 */
function ExtractionTable({ items }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">ID</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">カテゴリ</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">内容</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">信頼度</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">欠損フィールド</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">日時</th>
          <th className="text-left px-4 py-2.5 font-extrabold text-gray-600 text-xs">操作</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const badge = DOMAIN_BADGE[item.domain] || { label: item.domain, bg: "bg-gray-100 text-gray-700 border-gray-200" };
          const detail = item.extraction_detail || {};
          const confidence = detail.confidence_score != null ? Math.round(detail.confidence_score * 100) : null;
          return (
            <tr key={`ext-${item.id}`} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2.5 font-mono text-xs text-gray-500">#{item.entity_id || item.id}</td>
              <td className="px-4 py-2.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.bg}`}>
                  {badge.label}
                </span>
              </td>
              <td className="px-4 py-2.5 max-w-[250px]">
                <div className="font-bold text-gray-800 truncate text-xs">{item.name}</div>
              </td>
              <td className="px-4 py-2.5 text-xs">
                {confidence != null && (
                  <span className={`font-bold ${confidence >= 30 ? "text-yellow-600" : "text-red-600"}`}>
                    {confidence}%
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-orange-600 max-w-[200px] truncate">
                {detail.missing_fields || "—"}
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(item.updated_at)}</td>
              <td className="px-4 py-2.5">
                {item.editPath && item.entity_id && (
                  <Link
                    href={`${item.editPath}/${item.entity_id}/edit`}
                    className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold border border-blue-200 transition-colors"
                  >
                    編集
                  </Link>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * フィードバックバー
 */
function FeedbackBar({ feedback, onClose }) {
  const config = {
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
  };

  return (
    <div className={`px-5 py-3 text-sm font-bold flex items-center justify-between border-b ${config[feedback.type] || config.info}`}>
      <span>{feedback.message}</span>
      <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100 ml-4">x</button>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">巡回パトロール</h1>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <p className="text-red-800 font-extrabold">{message || "データの取得に失敗しました"}</p>
        <p className="text-sm text-red-600 mt-2">ページを再読み込みするか、時間をおいてお試しください</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
        >
          再読み込み
        </button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array(7).fill(0).map((_, i) => <div key={i} className="bg-white rounded-xl border h-28" />)}
      </div>
    </div>
  );
}

function formatDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "..." : str;
}
