"use client";
import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

/**
 * ヒーロー画像管理画面
 *
 * 各スライドの active 画像、候補一覧、スコア、クレジット情報を確認できる。
 */

const SLIDE_LABELS = {
  "entry-open": { label: "今エントリーできるリスク情報", color: "blue" },
  "deadline-soon": { label: "締切間近のリスク情報", color: "rose" },
  "beginner-friendly": { label: "初心者でも参加しやすいリスク情報", color: "emerald" },
};

export default function HeroImagesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/hero-images")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <AdminNav />

      <h1 className="text-xl font-bold text-gray-900 mb-1">
        🖼 ヒーロー画像管理
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        トップページスライダー画像の候補・採用状態を確認
      </p>

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">読み込み中...</p>
      ) : !data?.exists ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm mb-2">画像データが未作成です</p>
          <p className="text-xs">
            <code className="bg-gray-100 px-2 py-1 rounded">
              node scripts/fetch-hero-images.js
            </code>
            <br />を実行して候補を取得してください
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 最終更新 */}
          <p className="text-xs text-gray-400">
            最終更新: {data.updatedAt ? new Date(data.updatedAt).toLocaleString("ja-JP") : "不明"}
          </p>

          {/* スライド別 */}
          {Object.entries(SLIDE_LABELS).map(([key, meta]) => {
            const slide = data.slides?.[key];
            if (!slide) return null;

            return (
              <div key={key} className="border rounded-xl overflow-hidden">
                {/* ヘッダー */}
                <div className={`bg-${meta.color}-50 border-b border-${meta.color}-100 px-5 py-3`}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-800">
                      {meta.label}
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        ({key})
                      </span>
                    </h2>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>候補: {slide.counts.total}</span>
                      <span className="text-green-600 font-medium">
                        採用可: {slide.counts.approved}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Active 画像 */}
                <div className="px-5 py-4 border-b bg-white">
                  {slide.active ? (
                    <div className="flex items-start gap-4">
                      <div className="w-40 h-24 rounded-lg overflow-hidden bg-gray-100 shrink-0 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={slide.active.localPath}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-green-700 mb-1">
                          ✅ Active
                        </p>
                        <p className="text-xs text-gray-600">
                          ID: {slide.active.id}
                        </p>
                        <p className="text-xs text-gray-600">
                          スコア: {slide.active.score}点
                        </p>
                        <p className="text-xs text-gray-500">
                          撮影: {slide.active.photographer}
                        </p>
                        {slide.active.creditUrl && (
                          <a
                            href={slide.active.creditUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-500 hover:underline"
                          >
                            クレジット ↗
                          </a>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">
                          採用: {slide.active.activatedAt ? new Date(slide.active.activatedAt).toLocaleString("ja-JP") : "不明"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      ⬜ Active 画像なし — グラデーションフォールバック中
                    </p>
                  )}
                </div>

                {/* 候補一覧 */}
                <div className="px-5 py-3">
                  <h3 className="text-xs font-bold text-gray-700 mb-2">
                    候補一覧（スコア順）
                  </h3>
                  {slide.candidates.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">
                      候補なし
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {slide.candidates.map((c) => (
                        <CandidateRow key={c.id} candidate={c} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* コマンドヘルプ */}
          <div className="bg-gray-50 rounded-xl p-5">
            <h3 className="text-xs font-bold text-gray-700 mb-3">
              操作コマンド
            </h3>
            <div className="space-y-1.5 text-xs text-gray-600 font-mono">
              <p>
                <code className="bg-white px-2 py-0.5 rounded border text-[11px]">
                  node scripts/fetch-hero-images.js
                </code>
                <span className="ml-2 font-sans text-gray-400">
                  候補取得（全スライド）
                </span>
              </p>
              <p>
                <code className="bg-white px-2 py-0.5 rounded border text-[11px]">
                  node scripts/fetch-hero-images.js --dry-run
                </code>
                <span className="ml-2 font-sans text-gray-400">
                  取得のみ（保存しない）
                </span>
              </p>
              <p>
                <code className="bg-white px-2 py-0.5 rounded border text-[11px]">
                  node scripts/fetch-hero-images.js --download --activate
                </code>
                <span className="ml-2 font-sans text-gray-400">
                  DL + 最高スコアを active に
                </span>
              </p>
              <p>
                <code className="bg-white px-2 py-0.5 rounded border text-[11px]">
                  node scripts/fetch-hero-images.js --slide entry-open
                </code>
                <span className="ml-2 font-sans text-gray-400">
                  特定スライドのみ
                </span>
              </p>
              <p>
                <code className="bg-white px-2 py-0.5 rounded border text-[11px]">
                  node scripts/fetch-hero-images.js --report
                </code>
                <span className="ml-2 font-sans text-gray-400">
                  現在の状態レポート
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateRow({ candidate: c }) {
  const statusColors = {
    active: "bg-green-100 text-green-700",
    approved: "bg-blue-100 text-blue-700",
    candidate: "bg-gray-100 text-gray-500",
    rejected: "bg-red-100 text-red-500",
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 border border-gray-50">
      {/* サムネイル */}
      {c.thumbnailUrl && (
        <div className="w-20 h-12 rounded overflow-hidden bg-gray-100 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* 情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              statusColors[c.status] || statusColors.candidate
            }`}
          >
            {c.status}
          </span>
          <span className="text-xs font-bold text-gray-700">
            {c.score}点
          </span>
          <span className="text-[10px] text-gray-400">
            {c.width}×{c.height}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 truncate">
          {c.photographer}
          {c.sourceProvider && ` (${c.sourceProvider})`}
        </p>
        {c.localPath && (
          <p className="text-[10px] text-green-500">
            DL済: {c.localPath}
          </p>
        )}
      </div>

      {/* スコア詳細 */}
      <div className="shrink-0 text-right">
        {c.creditUrl && (
          <a
            href={c.creditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-500 hover:underline"
          >
            credit ↗
          </a>
        )}
      </div>
    </div>
  );
}
