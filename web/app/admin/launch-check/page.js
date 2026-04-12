"use client";

import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

/**
 * Phase225: 公開前チェックページ
 *
 * 公開前に確認すべき項目を一覧表示。
 * /api/health + /api/admin/monitoring からデータ取得して自動チェック。
 */

const MANUAL_CHECKS = [
  { id: "brand", label: "ブランド名「Risk Monitor」が全ページで統一されている", category: "ブランド" },
  { id: "favicon", label: "ファビコン・OGP画像が設定されている", category: "ブランド" },
  { id: "terms", label: "利用規約・プライバシーポリシーが最新版", category: "法務" },
  { id: "contact", label: "お問い合わせフォームが正常に送信できる", category: "法務" },
  { id: "mobile", label: "主要ページがモバイルで正常表示される", category: "UI" },
  { id: "login", label: "ログイン・会員登録フローが正常動作する", category: "機能" },
  { id: "search", label: "大会検索（キーワード・フィルタ）が動作する", category: "機能" },
  { id: "detail", label: "大会詳細ページが正常表示される", category: "機能" },
  { id: "favorite", label: "お気に入り追加/解除が動作する", category: "機能" },
  { id: "notify", label: "通知設定が動作する", category: "機能" },
  { id: "ssl", label: "SSL証明書が有効（https）", category: "インフラ" },
  { id: "domain", label: "本番ドメインでアクセスできる", category: "インフラ" },
  { id: "analytics", label: "アクセス解析が動作している", category: "インフラ" },
];

export default function LaunchCheckPage() {
  const [health, setHealth] = useState(null);
  const [monitoring, setMonitoring] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualChecks, setManualChecks] = useState({});

  useEffect(() => {
    Promise.all([
      fetch("/api/health").then((r) => r.json()).catch(() => null),
      fetch("/api/admin/monitoring").then((r) => r.json()).catch(() => null),
    ]).then(([h, m]) => {
      setHealth(h);
      setMonitoring(m);
      setLoading(false);
    });
  }, []);

  function toggleCheck(id) {
    setManualChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const autoChecks = [];
  if (health) {
    autoChecks.push({
      label: "データベース接続",
      status: health.checks?.database?.status === "ok" ? "pass" : "fail",
      detail: health.checks?.database?.status === "ok"
        ? `${health.checks.database.active_events}件のアクティブイベント`
        : "接続エラー",
    });
    autoChecks.push({
      label: "データ鮮度（72時間以内）",
      status: health.checks?.data_freshness?.status === "ok" ? "pass" : "warn",
      detail: health.checks?.data_freshness?.hours_since != null
        ? `最終更新: ${health.checks.data_freshness.hours_since}時間前`
        : "不明",
    });
  }
  if (monitoring) {
    autoChecks.push({
      label: "イベントデータ充実度",
      status: monitoring.summary?.total_events >= 100 ? "pass" : "warn",
      detail: `${monitoring.summary?.total_events || 0}件`,
    });
    autoChecks.push({
      label: "日付未設定イベント",
      status: monitoring.data_quality?.events_no_date === 0 ? "pass" : "warn",
      detail: `${monitoring.data_quality?.events_no_date || 0}件`,
    });
    autoChecks.push({
      label: "県未設定イベント",
      status: monitoring.data_quality?.events_no_prefecture === 0 ? "pass" : "warn",
      detail: `${monitoring.data_quality?.events_no_prefecture || 0}件`,
    });
    autoChecks.push({
      label: "古いデータ（30日以上未更新）",
      status: (monitoring.data_quality?.stale_events_30d || 0) < 50 ? "pass" : "warn",
      detail: `${monitoring.data_quality?.stale_events_30d || 0}件`,
    });
  }

  const manualDone = MANUAL_CHECKS.filter((c) => manualChecks[c.id]).length;
  const autoPass = autoChecks.filter((c) => c.status === "pass").length;
  const totalChecks = MANUAL_CHECKS.length + autoChecks.length;
  const doneChecks = manualDone + autoPass;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <AdminNav />
      <h1 className="text-xl font-bold text-gray-900 mb-1">公開前チェックリスト</h1>
      <p className="text-sm text-gray-500 mb-6">
        公開前に確認すべき項目。自動チェック + 手動確認。
      </p>

      {/* 進捗バー */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-700">進捗</span>
          <span className="text-sm text-gray-500">{doneChecks} / {totalChecks}</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              doneChecks === totalChecks ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${totalChecks > 0 ? (doneChecks / totalChecks) * 100 : 0}%` }}
          />
        </div>
        {doneChecks === totalChecks && (
          <p className="text-sm text-green-600 font-bold mt-2">全チェック完了 — 公開準備OK</p>
        )}
      </div>

      {/* 自動チェック */}
      <div className="card p-5 mb-6">
        <h2 className="text-base font-bold text-gray-900 mb-3">自動チェック</h2>
        {loading ? (
          <p className="text-sm text-gray-400">チェック中...</p>
        ) : (
          <div className="space-y-2">
            {autoChecks.map((check, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <StatusIcon status={check.status} />
                <span className="text-sm text-gray-700 flex-1">{check.label}</span>
                <span className="text-xs text-gray-500">{check.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 手動チェック */}
      <div className="card p-5">
        <h2 className="text-base font-bold text-gray-900 mb-3">手動チェック</h2>
        {Object.entries(
          MANUAL_CHECKS.reduce((acc, c) => {
            if (!acc[c.category]) acc[c.category] = [];
            acc[c.category].push(c);
            return acc;
          }, {})
        ).map(([category, checks]) => (
          <div key={category} className="mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{category}</h3>
            <div className="space-y-1.5">
              {checks.map((check) => (
                <label
                  key={check.id}
                  className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1"
                >
                  <input
                    type="checkbox"
                    checked={!!manualChecks[check.id]}
                    onChange={() => toggleCheck(check.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-sm ${manualChecks[check.id] ? "text-gray-400 line-through" : "text-gray-700"}`}>
                    {check.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === "pass") {
    return <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">✓</span>;
  }
  if (status === "warn") {
    return <span className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center text-xs font-bold">!</span>;
  }
  return <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">✕</span>;
}
