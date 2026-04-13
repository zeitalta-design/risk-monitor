"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminNav from "@/components/AdminNav";

// ─── ソース種別 ──────────────────────────

const SOURCE_TYPES = [
  { value: "moshicom", label: "moshicom" },
  { value: "runnet", label: "RUNNET" },
  { value: "sportsentry", label: "スポーツエントリー" },
  { value: "official", label: "公式サイト" },
  { value: "manual", label: "手入力" },
];

// ─── メインコンポーネント ─────────────────────

export default function AdminMarathonDetailImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledEventId = searchParams.get("eventId") || "";

  // モード切替: "url" or "text"
  const [mode, setMode] = useState("url");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <AdminNav />

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        リスク情報の取込
      </h1>

      {/* モード切替タブ */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        <button
          onClick={() => setMode("url")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            mode === "url"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          URL自動取得
        </button>
        <button
          onClick={() => setMode("text")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            mode === "text"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          テキスト貼付
        </button>
      </div>

      {mode === "url" ? (
        <UrlImportMode prefilledEventId={prefilledEventId} />
      ) : (
        <TextImportMode router={router} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// URL自動取得モード
// ═══════════════════════════════════════════════════

function UrlImportMode({ prefilledEventId = "" }) {
  const [url, setUrl] = useState("");
  const [existingId, setExistingId] = useState(prefilledEventId);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleImport() {
    setError(null);
    setResult(null);

    if (!url.trim()) {
      setError("URLを入力してください。");
      return;
    }

    setLoading(true);
    setStep("HTML取得中...");

    try {
      const stepTimer = setTimeout(() => setStep("解析・構造化中..."), 3000);
      const stepTimer2 = setTimeout(() => setStep("データベース保存中..."), 10000);

      const res = await fetch("/api/admin/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          existingEventId: existingId ? parseInt(existingId, 10) : null,
        }),
      });

      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "インポートに失敗しました。");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setStep("");
    }
  }

  return (
    <>
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          URL自動取得（RUNNET / MOSHICOM / スポーツエントリー）
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          URLを入力するだけで、HTML取得 → 解析 → LLM構造化 → DB保存を一括で行います。
        </p>

        {/* URL入力 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            リスク情報ページURL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://runnet.jp/entry/... / https://moshicom.com/... / https://www.sportsentry.ne.jp/event/t/..."
            className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
            onKeyDown={(e) => e.key === "Enter" && !loading && handleImport()}
          />
        </div>

        {/* 既存データID（任意） */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            既存データID（任意）
          </label>
          <input
            type="number"
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
            placeholder="空欄なら新規作成、指定すれば既存データを更新"
            className="border border-gray-300 rounded px-3 py-2 w-64 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            空欄の場合、新規リスク情報として登録されます。同じURLのリスク情報が既にある場合は自動で更新されます。
          </p>
        </div>

        {/* 実行ボタン */}
        <button
          onClick={handleImport}
          disabled={loading || !url.trim()}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {step || "処理中..."}
            </span>
          ) : (
            "取得＆登録"
          )}
        </button>
      </div>

      {/* エラー */}
      {error && (
        <div className="card p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-sm text-red-700 font-medium">エラー</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          <p className="text-xs text-gray-500 mt-2">
            自動取得に失敗した場合は「テキスト貼付」タブからコピペで取込できます。
          </p>
        </div>
      )}

      {/* 成功結果 */}
      {result && (
        <div className="card p-6 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-green-600 text-xl">✓</span>
            <h3 className="text-base font-bold text-gray-900">
              {result.action === "created" ? "新規登録" : "更新"}完了
            </h3>
          </div>

          <div className="space-y-2 text-sm mb-4">
            <div>
              <span className="text-gray-500">データ名:</span>{" "}
              <span className="font-medium text-gray-900">{result.title}</span>
            </div>
            <div>
              <span className="text-gray-500">データID:</span>{" "}
              <span className="font-medium text-gray-900">{result.eventId}</span>
            </div>
            <div>
              <span className="text-gray-500">種目数:</span>{" "}
              <span className="font-medium text-gray-900">{result.racesCount}件</span>
            </div>
            <div>
              <span className="text-gray-500">詳細情報:</span>{" "}
              <span className="font-medium text-green-600">登録済み</span>
            </div>
            {result.structureResult && (
              <div className="text-xs text-gray-400">
                モデル: {result.structureResult.model} ｜ トークン:{" "}
                {result.structureResult.usage?.inputTokens?.toLocaleString()} in /{" "}
                {result.structureResult.usage?.outputTokens?.toLocaleString()} out
                {result.structureResult.validation?.warnings?.length > 0 && (
                  <span className="text-yellow-600 ml-2">
                    ⚠ 警告{result.structureResult.validation.warnings.length}件
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <a
              href={`/marathon/${result.eventId}`}
              className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors"
            >
              リスク情報ページを開く
            </a>
            <a
              href={`/admin/marathon-details/${result.eventId}`}
              className="px-4 py-2 text-sm bg-gray-600 text-white font-medium rounded hover:bg-gray-700 transition-colors"
            >
              編集ページを開く
            </a>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════
// テキスト貼付モード（既存フロー）
// ═══════════════════════════════════════════════════

function TextImportMode({ router }) {
  const [marathonId, setMarathonId] = useState("");
  const [eventInfo, setEventInfo] = useState(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState("moshicom");
  const [text, setText] = useState("");

  const [structuring, setStructuring] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  async function lookupEvent() {
    const id = parseInt(marathonId, 10);
    if (!id || id <= 0) {
      setEventInfo(null);
      return;
    }
    setEventLoading(true);
    try {
      const res = await fetch(`/api/admin/marathon-details/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEventInfo({
        id: data.event.id,
        title: data.event.title,
        event_date: data.event.event_date,
        prefecture: data.event.prefecture,
        has_detail: data.has_detail,
      });
    } catch (err) {
      setEventInfo({ error: err.message });
    } finally {
      setEventLoading(false);
    }
  }

  async function handleStructure() {
    setError(null);
    setResult(null);
    setSaveMessage(null);

    if (!text.trim()) {
      setError("テキストを入力してください。");
      return;
    }

    setStructuring(true);
    try {
      const res = await fetch("/api/admin/marathon-details/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          sourceUrl: sourceUrl || undefined,
          sourceType,
          marathonName: eventInfo?.title || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "構造化に失敗しました。");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setStructuring(false);
    }
  }

  function handleTransferToEdit() {
    if (!result?.data || !eventInfo?.id) return;
    sessionStorage.setItem(
      `marathon-detail-import-${eventInfo.id}`,
      JSON.stringify(result.data)
    );
    router.push(`/admin/marathon-details/${eventInfo.id}?import=1`);
  }

  async function handleDirectSave() {
    if (!result?.data || !eventInfo?.id) return;

    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marathon-details/${eventInfo.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "保存に失敗しました。");
      }
      setSaveMessage({
        type: "success",
        text: `${data.action === "created" ? "新規作成" : "更新"}しました。`,
      });
    } catch (err) {
      setSaveMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function parseJsonField(jsonStr) {
    if (!jsonStr) return [];
    try {
      return JSON.parse(jsonStr);
    } catch {
      return [];
    }
  }

  return (
    <>
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">テキスト貼付で構造化</h2>
        <p className="text-xs text-gray-400 mb-4">
          外部サイトからリスク情報テキストをコピペして、LLMで構造化します。
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            対象データID
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={marathonId}
              onChange={(e) => setMarathonId(e.target.value)}
              placeholder="データIDを入力"
              className="border border-gray-300 rounded px-3 py-2 w-40 text-sm"
              onKeyDown={(e) => e.key === "Enter" && lookupEvent()}
            />
            <button
              onClick={lookupEvent}
              disabled={eventLoading}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors disabled:opacity-50"
            >
              {eventLoading ? "検索中..." : "検索"}
            </button>
          </div>

          {eventInfo && !eventInfo.error && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <div className="font-medium text-gray-900">{eventInfo.title}</div>
              <div className="text-gray-500 text-xs mt-1">
                ID: {eventInfo.id} ｜ {eventInfo.event_date || "日付未定"} ｜{" "}
                {eventInfo.prefecture || ""} ｜{" "}
                {eventInfo.has_detail ? (
                  <span className="text-green-600">詳細あり</span>
                ) : (
                  <span className="text-orange-600">詳細なし</span>
                )}
              </div>
            </div>
          )}
          {eventInfo?.error && (
            <p className="mt-2 text-sm text-red-600">
              リスク情報が見つかりません: {eventInfo.error}
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ソースURL（任意）
          </label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ソース種別
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            元テキスト
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Moshicom / RUNNET / 公式サイトなどからリスク情報のテキストを貼り付けてください"
            rows={15}
            className="border border-gray-300 rounded px-3 py-2 w-full text-sm font-mono leading-relaxed"
          />
          <p className="text-xs text-gray-400 mt-1">
            {text.length.toLocaleString()}文字
          </p>
        </div>

        <button
          onClick={handleStructure}
          disabled={structuring || !text.trim()}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {structuring ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              構造化中...
            </span>
          ) : (
            "構造化する"
          )}
        </button>
      </div>

      {error && (
        <div className="card p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-sm text-red-700 font-medium">エラー</p>
          <p className="text-sm text-red-600 mt-1 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {result && (
        <>
          <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
            <span>モデル: {result.model}</span>
            <span>
              トークン: {result.usage?.inputTokens?.toLocaleString()} in /{" "}
              {result.usage?.outputTokens?.toLocaleString()} out
            </span>
            {result.validation?.warnings?.length > 0 && (
              <span className="text-yellow-600">
                ⚠ 警告 {result.validation.warnings.length}件
              </span>
            )}
            {result.validation?.errors?.length > 0 && (
              <span className="text-red-600">
                ✕ エラー {result.validation.errors.length}件
              </span>
            )}
          </div>

          {(result.validation?.errors?.length > 0 ||
            result.validation?.warnings?.length > 0) && (
            <div className="card p-4 mb-4 bg-yellow-50 border-yellow-200">
              {result.validation.errors.map((e, i) => (
                <p key={`e-${i}`} className="text-sm text-red-600">✕ {e}</p>
              ))}
              {result.validation.warnings.map((w, i) => (
                <p key={`w-${i}`} className="text-sm text-yellow-700">⚠ {w}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4">
                抽出結果サマリー
              </h3>
              <div className="space-y-3 text-sm">
                <SummaryItem label="キャッチコピー" value={result.data.tagline} />
                <SummaryItem
                  label="概要"
                  value={
                    result.data.summary
                      ? result.data.summary.slice(0, 200) +
                        (result.data.summary.length > 200 ? "..." : "")
                      : null
                  }
                />
                <SummaryItem
                  label="会場"
                  value={
                    [result.data.venue_name, result.data.venue_address]
                      .filter(Boolean)
                      .join(" / ") || null
                  }
                />
                <SummaryItem label="データソース" value={result.data.organizer_name} />

                <div>
                  <span className="text-gray-500 text-xs">特徴:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {parseJsonField(result.data.features_json).length > 0 ? (
                      parseJsonField(result.data.features_json).map((f, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                          {f}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-xs">なし</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-gray-500 text-xs">種目・料金:</span>
                  {parseJsonField(result.data.pricing_json).length > 0 ? (
                    <table className="mt-1 w-full text-xs">
                      <tbody>
                        {parseJsonField(result.data.pricing_json).map((p, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-1 text-gray-900">{p.name}</td>
                            <td className="py-1 text-gray-600 text-right">{p.fee}</td>
                            <td className="py-1 text-gray-400 pl-2">{p.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-gray-400 text-xs mt-1">なし</p>
                  )}
                </div>

                <div className="flex gap-4 pt-2 border-t border-gray-100">
                  <CountBadge label="FAQ" count={parseJsonField(result.data.faq_json).length} />
                  <CountBadge label="スケジュール" count={parseJsonField(result.data.schedule_json).length} />
                  <CountBadge label="制限時間" count={parseJsonField(result.data.time_limits_json).length} />
                  <CountBadge label="系列リスク情報" count={parseJsonField(result.data.series_events_json).length} />
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">生JSON</h3>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(result.data, null, 2))}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
                >
                  コピー
                </button>
              </div>
              <textarea
                readOnly
                value={JSON.stringify(result.data, null, 2)}
                rows={25}
                className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded p-3 leading-relaxed"
              />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">保存</h3>
            {!eventInfo?.id ? (
              <p className="text-sm text-gray-500">
                保存するには、上部で対象リスク情報を選択してください。
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={handleTransferToEdit}
                  className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  編集ページへ反映（推奨）
                </button>
                <button
                  onClick={handleDirectSave}
                  disabled={saving}
                  className="px-5 py-2.5 bg-gray-600 text-white font-medium rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "保存中..." : "そのまま保存"}
                </button>
                {saveMessage && (
                  <span className={`text-sm ${saveMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                    {saveMessage.text}
                    {saveMessage.type === "success" && (
                      <>
                        {" "}
                        <a href={`/admin/marathon-details/${eventInfo.id}`} className="text-blue-600 underline">
                          編集ページを開く
                        </a>
                      </>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ─── サブコンポーネント ──────────────────────

function SummaryItem({ label, value }) {
  return (
    <div>
      <span className="text-gray-500 text-xs">{label}:</span>
      <p className="text-gray-900 mt-0.5">
        {value || <span className="text-gray-400">—</span>}
      </p>
    </div>
  );
}

function CountBadge({ label, count }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${count > 0 ? "text-blue-600" : "text-gray-300"}`}>
        {count}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
