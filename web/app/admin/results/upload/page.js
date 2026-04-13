"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

/**
 * Phase198+199: 結果CSVアップロードページ
 *
 * CSVファイルをアップロード → カラム自動判定 → プレビュー → 保存
 */

const SPORT_OPTIONS = [
  { value: "marathon", label: "マラソン" },
  { value: "trail", label: "トレイル" },
];

export default function AdminResultsUploadPage() {
  const [eventId, setEventId] = useState("");
  const [resultYear, setResultYear] = useState(new Date().getFullYear().toString());
  const [sportType, setSportType] = useState("marathon");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("CSVファイルを選択してください");
      return;
    }
    if (!eventId) {
      setError("データIDを入力してください");
      return;
    }

    setUploading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("csv", file);
      formData.append("event_id", eventId);
      formData.append("result_year", resultYear);
      formData.append("sport_type", sportType);

      const res = await fetch("/api/admin/results/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "アップロードに失敗しました");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError("通信エラーが発生しました");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <AdminNav />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">結果CSVアップロード</h1>
        <Link href="/admin/results" className="text-xs text-blue-600 hover:text-blue-800">
          ← 結果管理に戻る
        </Link>
      </div>

      <form onSubmit={handleUpload} className="space-y-6">
        {/* 基本情報 */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-700">基本情報</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">データID *</label>
              <input
                type="number"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                placeholder="例: 123"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">年度 *</label>
              <input
                type="number"
                value={resultYear}
                onChange={(e) => setResultYear(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                min="2000"
                max="2030"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">スポーツ種別</label>
              <select
                value={sportType}
                onChange={(e) => setSportType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                {SPORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* CSVファイル */}
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-700">CSVファイル</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            ヘッダー行からカラムを自動判定します。対応カラム: ゼッケン、順位、タイム、ネットタイム、種目、性別、年代
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {/* エラー */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* 送信 */}
        <button
          type="submit"
          disabled={uploading}
          className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {uploading ? "処理中..." : "アップロード実行"}
        </button>
      </form>

      {/* 結果表示 */}
      {result && (
        <div className="mt-6 space-y-4">
          <div className={`p-4 rounded-lg border ${result.success ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
            <p className={`text-sm font-medium ${result.success ? "text-green-700" : "text-amber-700"}`}>
              {result.message}
            </p>
          </div>

          {/* 統計 */}
          {result.stats && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">処理結果</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox label="総行数" value={result.stats.totalLines} />
                <StatBox label="パース成功" value={result.stats.parsed} color="text-blue-600" />
                {result.stats.inserted !== undefined && (
                  <StatBox label="新規登録" value={result.stats.inserted} color="text-green-600" />
                )}
                {result.stats.duplicated !== undefined && (
                  <StatBox label="重複スキップ" value={result.stats.duplicated} color="text-gray-500" />
                )}
                <StatBox label="スキップ" value={result.stats.skipped} color="text-gray-400" />
                <StatBox label="エラー" value={result.stats.errorCount} color="text-red-500" />
              </div>
            </div>
          )}

          {/* カラムマッピング */}
          {result.headers && result.mapping && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">カラム判定結果</h3>
              <div className="flex flex-wrap gap-2">
                {result.headers.map((h, i) => {
                  const field = Object.entries(result.mapping).find(([, idx]) => idx === i)?.[0];
                  return (
                    <div key={i} className={`px-2 py-1 text-xs rounded border ${field ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                      <span className="font-medium">{h}</span>
                      {field && <span className="ml-1">→ {field}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* エラー詳細 */}
          {result.errors?.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-red-600 mb-2">エラー ({result.errors.length}件)</h3>
              <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-500">{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ガイド */}
      <div className="mt-8 card p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">CSV形式ガイド</h3>
        <div className="text-xs text-gray-500 space-y-2 leading-relaxed">
          <p>• ヘッダー行が必要です（1行目にカラム名）</p>
          <p>• 文字コード: UTF-8 推奨（Shift-JISも可）</p>
          <p>• 自動判定カラム: ゼッケン, 順位, タイム, ネットタイム, 種目, 性別, 年代</p>
          <p>• タイム形式: H:MM:SS, HH:MM:SS, 1時間23分45秒 など柔軟に対応</p>
          <p>• 氏名はハッシュ化して保存（個人名は公開されません）</p>
        </div>
        <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-600 font-mono">
          ゼッケン,総合順位,タイム,ネットタイム,種目,性別,年代<br />
          101,1,3:05:23,3:04:58,フルマラソン,男,30代<br />
          102,2,3:12:45,3:12:01,フルマラソン,女,20代
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color = "text-gray-900" }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
