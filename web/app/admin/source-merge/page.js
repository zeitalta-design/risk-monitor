"use client";
import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

/**
 * RUNNET × MOSHICOM ソース統合管理画面
 *
 * 1. リスクデータ一覧（統合ステータスフィルタ）
 * 2. 自動検索 → マッチ候補表示
 * 3. 手動URL入力 → 統合実行
 * 4. 差分プレビュー
 */

export default function SourceMergePage() {
  // 一覧
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("unmerged");
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  // 統合操作
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);

  useEffect(() => {
    loadEvents();
  }, [q, status, offset]);

  async function loadEvents() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, status, limit: LIMIT, offset });
      const res = await fetch(`/api/admin/source-merge?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(event) {
    setSelectedEvent(event);
    setSearchResult(null);
    setMergeResult(null);
    setPreviewResult(null);
    setManualUrl("");
    setSearching(true);

    try {
      const res = await fetch(`/api/admin/source-merge?eventId=${event.id}`);
      const data = await res.json();
      setSearchResult(data);
    } catch (err) {
      setSearchResult({ error: err.message });
    } finally {
      setSearching(false);
    }
  }

  async function handleMerge(moshicomUrl, dryRun = false) {
    if (!selectedEvent || !moshicomUrl) return;
    setMerging(true);
    setMergeResult(null);

    try {
      const res = await fetch("/api/admin/source-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          moshicomUrl,
          dryRun,
        }),
      });
      const data = await res.json();

      if (dryRun) {
        setPreviewResult(data);
      } else {
        setMergeResult(data);
        if (data.success) {
          loadEvents();
        }
      }
    } catch (err) {
      if (dryRun) {
        setPreviewResult({ error: err.message });
      } else {
        setMergeResult({ error: err.message });
      }
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <AdminNav />

      <h1 className="text-xl font-bold text-gray-900 mb-1">
        🔗 ソース統合（RUNNET × MOSHICOM）
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        RUNNETリスクデータにMOSHICOMの詳細情報を統合
      </p>

      {/* フィルタ */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="データ名検索..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-64"
        />
        <div className="flex gap-1">
          {[
            { value: "unmerged", label: "未統合" },
            { value: "merged", label: "統合済み" },
            { value: "all", label: "すべて" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setStatus(opt.value);
                setOffset(0);
              }}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                status === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{total}件</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左: リスクデータ一覧 */}
        <div>
          {loading ? (
            <p className="text-sm text-gray-400 py-10 text-center">読み込み中...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">該当なし</p>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedEvent?.id === ev.id
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-100 hover:border-gray-300"
                  }`}
                  onClick={() => handleSearch(ev)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {ev.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-400">
                          {ev.event_date || "日付不明"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {ev.prefecture || ""}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {ev.source_priority === "moshicom" ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          統合済み
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          RUNNET
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* ページング */}
              {total > LIMIT && (
                <div className="flex justify-center gap-2 pt-4">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                    disabled={offset === 0}
                    className="px-3 py-1.5 text-xs bg-gray-100 rounded disabled:opacity-30"
                  >
                    前へ
                  </button>
                  <span className="text-xs text-gray-500 py-1.5">
                    {offset + 1}–{Math.min(offset + LIMIT, total)} / {total}
                  </span>
                  <button
                    onClick={() => setOffset(offset + LIMIT)}
                    disabled={offset + LIMIT >= total}
                    className="px-3 py-1.5 text-xs bg-gray-100 rounded disabled:opacity-30"
                  >
                    次へ
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右: 検索結果・統合操作 */}
        <div>
          {!selectedEvent ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              左の一覧からリスクデータを選択
            </div>
          ) : (
            <div className="space-y-4">
              {/* 選択中のリスクデータ */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-bold text-gray-800">
                  {selectedEvent.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  ID: {selectedEvent.id} / {selectedEvent.event_date} / {selectedEvent.prefecture}
                </p>
              </div>

              {/* MOSHICOM検索結果 */}
              {searching ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  MOSHICOM検索中...
                </p>
              ) : searchResult?.alreadyMerged ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700 font-medium">
                    統合済み
                  </p>
                  <a
                    href={searchResult.moshicomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 underline mt-1 block"
                  >
                    {searchResult.moshicomUrl}
                  </a>
                </div>
              ) : searchResult?.matchResult ? (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-700">
                    MOSHICOM候補（上位{searchResult.matchResult.allResults?.length || 0}件）
                  </h4>
                  {searchResult.matchResult.allResults?.map((r, i) => (
                    <div
                      key={i}
                      className={`border rounded-lg p-3 ${
                        r.score >= 80
                          ? "border-green-300 bg-green-50"
                          : r.score >= 50
                          ? "border-amber-200 bg-amber-50"
                          : "border-gray-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 font-medium truncate">
                            {r.title}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {r.date || "日付不明"} / {r.prefecture || "地域不明"}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            r.score >= 80
                              ? "bg-green-200 text-green-800"
                              : r.score >= 50
                              ? "bg-amber-200 text-amber-800"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {r.score}点
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleMerge(r.url, true)}
                          disabled={merging}
                          className="px-3 py-1 text-[10px] font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                        >
                          プレビュー
                        </button>
                        <button
                          onClick={() => handleMerge(r.url, false)}
                          disabled={merging}
                          className="px-3 py-1 text-[10px] font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          統合実行
                        </button>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 text-[10px] text-gray-500 hover:text-gray-700"
                        >
                          開く ↗
                        </a>
                      </div>
                    </div>
                  ))}

                  {searchResult.matchResult.allResults?.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      マッチする候補が見つかりませんでした
                    </p>
                  )}
                </div>
              ) : searchResult?.error ? (
                <p className="text-sm text-red-500 py-4">
                  検索エラー: {searchResult.error}
                </p>
              ) : null}

              {/* 手動URL入力 */}
              <div className="border-t pt-4">
                <h4 className="text-xs font-bold text-gray-700 mb-2">
                  手動でMOSHICOM URLを入力
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://moshicom.com/..."
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => handleMerge(manualUrl, true)}
                    disabled={!manualUrl || merging}
                    className="px-3 py-2 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                  >
                    確認
                  </button>
                  <button
                    onClick={() => handleMerge(manualUrl, false)}
                    disabled={!manualUrl || merging}
                    className="px-3 py-2 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    統合
                  </button>
                </div>
              </div>

              {/* プレビュー結果 */}
              {previewResult && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-xs font-bold text-blue-800 mb-2">
                    プレビュー（dry-run）
                  </h4>
                  {previewResult.error ? (
                    <p className="text-xs text-red-500">{previewResult.error}</p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-700 mb-2">
                        MOSHICOM: {previewResult.moshicomTitle} （{previewResult.moshicomRacesCount}種目）
                      </p>
                      {previewResult.differences?.diffs?.length > 0 ? (
                        <div className="space-y-1.5">
                          {previewResult.differences.diffs.map((d, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-[11px]"
                            >
                              <span className="text-gray-500 w-16 shrink-0">
                                {d.label}
                              </span>
                              <span className="text-red-500 line-through flex-1">
                                {d.current || "(なし)"}
                              </span>
                              <span className="text-green-700 flex-1">
                                {d.moshicom || "(なし)"}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  d.priority === "moshicom"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {d.priority}優先
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">差分なし</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 統合結果 */}
              {mergeResult && (
                <div
                  className={`rounded-lg p-4 border ${
                    mergeResult.success
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  {mergeResult.success ? (
                    <>
                      <p className="text-sm font-medium text-green-800">
                        統合完了
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        {mergeResult.eventTitle} ← {mergeResult.moshicomTitle}
                        （{mergeResult.fieldsUpdated}フィールド更新, {mergeResult.moshicomRacesCount}種目）
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-red-700">
                      エラー: {mergeResult.error}
                    </p>
                  )}
                </div>
              )}

              {merging && (
                <p className="text-sm text-gray-400 text-center py-4">
                  処理中...
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
