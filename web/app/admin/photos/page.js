"use client";

import { useState, useEffect } from "react";
import AdminNav from "@/components/AdminNav";

/**
 * Phase164: 写真管理画面
 * /admin/photos
 *
 * 一覧・検索・ステータス変更・メタ編集
 */

const IMAGE_TYPES = [
  { value: "", label: "全タイプ" },
  { value: "hero", label: "メイン" },
  { value: "course", label: "コース" },
  { value: "venue", label: "会場" },
  { value: "start", label: "スタート" },
  { value: "finish", label: "フィニッシュ" },
  { value: "crowd", label: "盛り上がり" },
  { value: "scenery", label: "景色" },
  { value: "other", label: "その他" },
];

const STATUS_OPTIONS = [
  { value: "", label: "全ステータス" },
  { value: "published", label: "公開" },
  { value: "draft", label: "下書き" },
  { value: "hidden", label: "非公開" },
];

const SOURCE_LABELS = {
  official: "公式",
  organizer: "運営",
  user: "ユーザー",
  editorial: "編集部",
};

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterEventId, setFilterEventId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const LIMIT = 30;

  useEffect(() => { loadPhotos(); }, [filterEventId, filterType, filterStatus, offset]);

  async function loadPhotos() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (filterEventId) params.set("event_id", filterEventId);
      if (filterType) params.set("image_type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/admin/photos?${params}`);
      const data = await res.json();
      setPhotos(data.photos || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load photos:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(photoId, newStatus) {
    try {
      await fetch("/api/admin/photos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_id: photoId, status: newStatus }),
      });
      loadPhotos();
    } catch (err) {
      console.error("Status change failed:", err);
    }
  }

  async function handleMetaUpdate(photoId, updates) {
    try {
      await fetch("/api/admin/photos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_id: photoId, ...updates }),
      });
      setEditingId(null);
      loadPhotos();
    } catch (err) {
      console.error("Meta update failed:", err);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <AdminNav />
      <h1 className="text-xl font-bold text-gray-900 mb-4">写真管理</h1>

      {/* フィルタ */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={filterEventId}
          onChange={(e) => { setFilterEventId(e.target.value); setOffset(0); }}
          placeholder="データID"
          className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600 w-24"
        />
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setOffset(0); }}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600"
        >
          {IMAGE_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setOffset(0); }}
          className="text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-600"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{total}件</span>
      </div>

      {/* 写真グリッド */}
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">写真データはありません</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="card overflow-hidden">
                {/* サムネイル */}
                <div className="relative bg-gray-100" style={{ aspectRatio: "16/10" }}>
                  <img
                    src={photo.thumbnail_url || photo.image_url}
                    alt={photo.alt_text || "写真"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-1.5 left-1.5 flex gap-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      photo.status === "published" ? "bg-green-500 text-white" :
                      photo.status === "draft" ? "bg-yellow-400 text-yellow-900" :
                      "bg-gray-500 text-white"
                    }`}>
                      {photo.status}
                    </span>
                    {photo.image_type && (
                      <span className="text-[9px] bg-black/40 text-white px-1.5 py-0.5 rounded">
                        {IMAGE_TYPES.find((t) => t.value === photo.image_type)?.label || photo.image_type}
                      </span>
                    )}
                  </div>
                </div>

                {/* 情報 */}
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {photo.event_title || `Event #${photo.event_id}`}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                        <span>ID:{photo.id}</span>
                        <span>リスク情報:{photo.event_id}</span>
                        {photo.source_type && <span>{SOURCE_LABELS[photo.source_type] || photo.source_type}</span>}
                        {photo.taken_year && <span>{photo.taken_year}年</span>}
                        <span>順序:{photo.display_order}</span>
                      </div>
                    </div>
                  </div>

                  {photo.caption && (
                    <p className="text-xs text-gray-500 line-clamp-2">{photo.caption}</p>
                  )}

                  {/* 操作 */}
                  {editingId === photo.id ? (
                    <PhotoMetaEditor
                      photo={photo}
                      onSave={(updates) => handleMetaUpdate(photo.id, updates)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={photo.status}
                        onChange={(e) => handleStatusChange(photo.id, e.target.value)}
                        className="text-[10px] border border-gray-200 rounded px-1.5 py-1 text-gray-500"
                      >
                        <option value="published">公開</option>
                        <option value="draft">下書き</option>
                        <option value="hidden">非公開</option>
                      </select>
                      <button
                        onClick={() => setEditingId(photo.id)}
                        className="text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
                      >
                        編集
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                前へ
              </button>
              <span className="text-xs text-gray-500">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- メタ編集フォーム ---
function PhotoMetaEditor({ photo, onSave, onCancel }) {
  const [imageType, setImageType] = useState(photo.image_type || "other");
  const [caption, setCaption] = useState(photo.caption || "");
  const [altText, setAltText] = useState(photo.alt_text || "");
  const [displayOrder, setDisplayOrder] = useState(photo.display_order || 0);

  return (
    <div className="space-y-2 pt-2 border-t border-gray-100">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500">タイプ</label>
          <select value={imageType} onChange={(e) => setImageType(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1">
            {IMAGE_TYPES.filter((t) => t.value).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500">表示順</label>
          <input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1" />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-gray-500">キャプション</label>
        <input value={caption} onChange={(e) => setCaption(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1" placeholder="写真の説明" />
      </div>
      <div>
        <label className="text-[10px] text-gray-500">ALTテキスト</label>
        <input value={altText} onChange={(e) => setAltText(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1" placeholder="画像の代替テキスト" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave({ image_type: imageType, caption, alt_text: altText, display_order: displayOrder })}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">保存</button>
        <button onClick={onCancel}
          className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors">キャンセル</button>
      </div>
    </div>
  );
}
