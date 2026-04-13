"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

// ─── JSON項目のサンプルデータ ─────────────────

const JSON_SAMPLES = {
  features_json: '["日本陸連公認", "ペーサーあり", "チップ計測", "完走メダル"]',
  payment_methods_json: '["クレジットカード", "コンビニ払い", "銀行振込"]',
  level_labels_json: '["初心者向け", "中級者向け", "上級者向け"]',
  pricing_json:
    '[\n  { "name": "フルマラソン", "fee": "11,000円", "note": "早割10%OFF" },\n  { "name": "ハーフ", "fee": "7,700円", "note": "" }\n]',
  schedule_json:
    '[\n  { "time": "07:30", "label": "受付開始" },\n  { "time": "09:00", "label": "フルマラソン スタート" },\n  { "time": "14:00", "label": "閉会式" }\n]',
  faq_json:
    '[\n  { "question": "ゼッケンの受取方法は？", "answer": "当日会場で受け取れます。" },\n  { "question": "駐車場はありますか？", "answer": "会場周辺に有料駐車場があります。" }\n]',
  time_limits_json:
    '[\n  { "name": "フルマラソン", "limit": "6時間" },\n  { "name": "ハーフ", "limit": "3時間" }\n]',
  series_events_json:
    '[\n  { "event_id": 1, "name": "東京マラソン2026" },\n  { "event_id": 2, "name": "大阪マラソン2026" }\n]',
  distances_json: '["42.195km", "21.0975km", "10km", "5km"]',
};

const JSON_HINTS = {
  features_json: "文字列の配列",
  payment_methods_json: "文字列の配列",
  level_labels_json: "文字列の配列",
  pricing_json: "{ name, fee, note } の配列",
  schedule_json: "{ time, label } の配列",
  faq_json: "{ question, answer } の配列",
  time_limits_json: "{ name, limit } の配列",
  series_events_json: "{ event_id, name } の配列",
  distances_json: "文字列の配列",
};

// ─── メインコンポーネント ─────────────────────

export default function AdminMarathonDetailEditPage({ params }) {
  const { id } = use(params);
  const marathonId = parseInt(id, 10);

  const [event, setEvent] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState({});
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetchData();
  }, [marathonId]);

  // インポートデータの反映（sessionStorageから）
  useEffect(() => {
    if (loading) return; // fetchData完了後に実行
    const storageKey = `marathon-detail-import-${marathonId}`;
    const importJson = sessionStorage.getItem(storageKey);
    if (!importJson) return;

    try {
      const importData = JSON.parse(importJson);
      sessionStorage.removeItem(storageKey);

      // フォームにマージ（インポートデータで上書き、ただしnull/空は既存値を保持）
      setForm((prev) => {
        const merged = { ...prev };
        for (const [key, value] of Object.entries(importData)) {
          if (key === "id" || key === "marathon_id" || key === "created_at" || key === "updated_at") continue;
          // 新規作成時は全フィールド上書き、既存時はnull/空でなければ上書き
          if (isNew || (value !== null && value !== "" && value !== "[]")) {
            merged[key] = value === null ? "" : String(value);
          }
        }
        return merged;
      });

      setMessage({
        type: "success",
        text: "インポートデータを反映しました。内容を確認して保存してください。",
      });
    } catch {
      // パースエラーは無視
      sessionStorage.removeItem(storageKey);
    }
  }, [loading, marathonId, isNew]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/marathon-details/${marathonId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEvent(data.event);
      setIsNew(!data.has_detail);
      if (data.detail) {
        // JSON項目は文字列として展開
        const formData = {};
        for (const [key, value] of Object.entries(data.detail)) {
          if (key === "id" || key === "marathon_id" || key === "created_at" || key === "updated_at") continue;
          formData[key] = value === null ? "" : String(value);
        }
        setForm(formData);
      } else {
        setForm({});
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // エラーをクリア
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validateJsonFields() {
    const jsonFields = Object.keys(JSON_SAMPLES);
    const newErrors = {};
    for (const field of jsonFields) {
      const val = form[field];
      if (val && val.trim() !== "") {
        try {
          JSON.parse(val);
        } catch (e) {
          newErrors[field] = `JSON形式エラー: ${e.message}`;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validateJsonFields()) {
      setMessage({ type: "error", text: "JSON形式のエラーがあります。修正してから保存してください。" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/marathon-details/${marathonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "保存に失敗しました");
      }
      setMessage({
        type: "success",
        text: data.action === "created" ? "新規作成しました" : "更新しました",
      });
      setIsNew(false);
      // フォームを最新に更新
      await fetchData();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function insertSample(field) {
    const sample = JSON_SAMPLES[field];
    if (sample) {
      updateField(field, sample);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <AdminNav />
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <AdminNav />
        <div className="text-center py-12 text-gray-400">
          リスク情報が見つかりません
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <AdminNav />

      {/* ヘッダー */}
      <div className="mb-6">
        <Link
          href="/admin/marathon-details"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          ← 一覧に戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          {event.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>{event.event_date || "日付未定"}</span>
          <span>{event.prefecture || ""}</span>
          {isNew && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
              新規作成
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <Link
            href={`/marathon/${marathonId}`}
            target="_blank"
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            詳細ページを確認 ↗
          </Link>
          {event.source_url && (
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              RUNNET ↗
            </a>
          )}
          {event.official_url && (
            <a
              href={event.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              公式サイト ↗
            </a>
          )}
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* フォーム */}
      <div className="space-y-8">
        {/* セクション1: 基本情報 */}
        <FormSection title="基本情報">
          <TextInput
            label="キャッチコピー"
            field="tagline"
            value={form.tagline}
            onChange={updateField}
            placeholder="例: 神戸で開催の日本陸連公認レース！初心者からサブ3ランナーまで楽しめる6種目"
          />
          <TextArea
            label="概要（summary）"
            field="summary"
            value={form.summary}
            onChange={updateField}
            rows={5}
            placeholder="リスク情報の概要を記入"
          />
          <TextInput
            label="スポーツカテゴリ"
            field="sports_category"
            value={form.sports_category}
            onChange={updateField}
            placeholder="例: ランニング"
          />
          <TextInput
            label="リスク情報種別"
            field="event_type_label"
            value={form.event_type_label}
            onChange={updateField}
            placeholder="例: ロードレース"
          />
          <TextInput
            label="リスク情報規模"
            field="event_scale_label"
            value={form.event_scale_label}
            onChange={updateField}
            placeholder="例: 500〜1,000人"
          />
          <TextInput
            label="計測方法"
            field="measurement_method"
            value={form.measurement_method}
            onChange={updateField}
            placeholder="例: ICチップ計測"
          />
        </FormSection>

        {/* セクション2: 申込・会場 */}
        <FormSection title="申込・会場">
          <TextInput
            label="会場名"
            field="venue_name"
            value={form.venue_name}
            onChange={updateField}
          />
          <TextInput
            label="住所"
            field="venue_address"
            value={form.venue_address}
            onChange={updateField}
          />
          <TextArea
            label="アクセス情報"
            field="access_info"
            value={form.access_info}
            onChange={updateField}
            rows={3}
          />
          <TextInput
            label="地図URL"
            field="map_url"
            value={form.map_url}
            onChange={updateField}
            placeholder="https://..."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="申込開始日"
              field="application_start_at"
              value={form.application_start_at}
              onChange={updateField}
              placeholder="2025-10-01"
            />
            <TextInput
              label="申込終了日"
              field="application_end_at"
              value={form.application_end_at}
              onChange={updateField}
              placeholder="2026-03-15"
            />
          </div>
          <TextInput
            label="受付開始時間"
            field="registration_start_time"
            value={form.registration_start_time}
            onChange={updateField}
            placeholder="例: 07:30"
          />
          <TextInput
            label="エントリーURL"
            field="entry_url"
            value={form.entry_url}
            onChange={updateField}
            placeholder="https://..."
          />
          <TextInput
            label="公式サイトURL"
            field="official_url"
            value={form.official_url}
            onChange={updateField}
            placeholder="https://..."
          />
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">
              代理申込
            </label>
            <select
              value={form.agent_entry_allowed ?? ""}
              onChange={(e) => updateField("agent_entry_allowed", e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">未設定</option>
              <option value="1">可</option>
              <option value="0">不可</option>
            </select>
          </div>
          <TextArea
            label="キャンセルポリシー"
            field="cancellation_policy"
            value={form.cancellation_policy}
            onChange={updateField}
            rows={3}
          />
        </FormSection>

        {/* セクション3: 特徴・レベル */}
        <FormSection title="特徴・レベル">
          <JsonTextArea
            label="特徴"
            field="features_json"
            value={form.features_json}
            onChange={updateField}
            error={errors.features_json}
            hint={JSON_HINTS.features_json}
            onInsertSample={() => insertSample("features_json")}
          />
          <JsonTextArea
            label="レベル"
            field="level_labels_json"
            value={form.level_labels_json}
            onChange={updateField}
            error={errors.level_labels_json}
            hint={JSON_HINTS.level_labels_json}
            onInsertSample={() => insertSample("level_labels_json")}
          />
          <JsonTextArea
            label="支払方法"
            field="payment_methods_json"
            value={form.payment_methods_json}
            onChange={updateField}
            error={errors.payment_methods_json}
            hint={JSON_HINTS.payment_methods_json}
            onInsertSample={() => insertSample("payment_methods_json")}
          />
        </FormSection>

        {/* セクション4: 種目・料金・スケジュール */}
        <FormSection title="種目・料金・スケジュール">
          <JsonTextArea
            label="料金情報"
            field="pricing_json"
            value={form.pricing_json}
            onChange={updateField}
            error={errors.pricing_json}
            hint={JSON_HINTS.pricing_json}
            onInsertSample={() => insertSample("pricing_json")}
            rows={8}
          />
          <JsonTextArea
            label="タイムスケジュール"
            field="schedule_json"
            value={form.schedule_json}
            onChange={updateField}
            error={errors.schedule_json}
            hint={JSON_HINTS.schedule_json}
            onInsertSample={() => insertSample("schedule_json")}
            rows={8}
          />
          <JsonTextArea
            label="制限時間"
            field="time_limits_json"
            value={form.time_limits_json}
            onChange={updateField}
            error={errors.time_limits_json}
            hint={JSON_HINTS.time_limits_json}
            onInsertSample={() => insertSample("time_limits_json")}
          />
          <JsonTextArea
            label="距離情報"
            field="distances_json"
            value={form.distances_json}
            onChange={updateField}
            error={errors.distances_json}
            hint={JSON_HINTS.distances_json}
            onInsertSample={() => insertSample("distances_json")}
          />
          <TextArea
            label="コース情報"
            field="course_info"
            value={form.course_info}
            onChange={updateField}
            rows={3}
          />
        </FormSection>

        {/* セクション5: FAQ */}
        <FormSection title="FAQ・注意事項">
          <JsonTextArea
            label="FAQ"
            field="faq_json"
            value={form.faq_json}
            onChange={updateField}
            error={errors.faq_json}
            hint={JSON_HINTS.faq_json}
            onInsertSample={() => insertSample("faq_json")}
            rows={10}
          />
          <TextArea
            label="注意事項"
            field="notes"
            value={form.notes}
            onChange={updateField}
            rows={4}
          />
        </FormSection>

        {/* セクション6: データソース */}
        <FormSection title="データソース情報">
          <TextInput
            label="データソース名"
            field="organizer_name"
            value={form.organizer_name}
            onChange={updateField}
          />
          <TextInput
            label="担当者名"
            field="organizer_contact_name"
            value={form.organizer_contact_name}
            onChange={updateField}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="メール"
              field="organizer_email"
              value={form.organizer_email}
              onChange={updateField}
            />
            <TextInput
              label="電話"
              field="organizer_phone"
              value={form.organizer_phone}
              onChange={updateField}
            />
          </div>
          <TextArea
            label="データソース説明"
            field="organizer_description"
            value={form.organizer_description}
            onChange={updateField}
            rows={3}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="レビュースコア"
              field="organizer_review_score"
              value={form.organizer_review_score}
              onChange={updateField}
              placeholder="例: 4.3"
            />
            <TextInput
              label="レビュー件数"
              field="organizer_review_count"
              value={form.organizer_review_count}
              onChange={updateField}
              placeholder="例: 127"
            />
          </div>
        </FormSection>

        {/* セクション7: 系列リスク情報 */}
        <FormSection title="系列リスク情報">
          <JsonTextArea
            label="系列リスク情報"
            field="series_events_json"
            value={form.series_events_json}
            onChange={updateField}
            error={errors.series_events_json}
            hint={JSON_HINTS.series_events_json}
            onInsertSample={() => insertSample("series_events_json")}
          />
        </FormSection>

        {/* セクション8: メタ情報 */}
        <FormSection title="メタ情報">
          <TextInput
            label="データ出典URL"
            field="source_url"
            value={form.source_url}
            onChange={updateField}
            placeholder="https://..."
          />
        </FormSection>
      </div>

      {/* 保存ボタン（固定） */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 py-4 mt-8 -mx-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {isNew ? "新規作成" : "既存データ編集"}
            {Object.keys(errors).length > 0 && (
              <span className="text-red-600 ml-3">
                ⚠ {Object.keys(errors).length}件のエラー
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold
                       hover:bg-blue-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
          >
            {saving ? "保存中..." : isNew ? "新規作成" : "更新保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── フォーム部品 ─────────────────────────────

function FormSection({ title, children }) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-5 pb-3 border-b border-gray-100">
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function TextInput({ label, field, value, onChange, placeholder = "" }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        <span className="text-xs text-gray-400 ml-2">{field}</span>
      </label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

function TextArea({ label, field, value, onChange, rows = 4, placeholder = "" }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        <span className="text-xs text-gray-400 ml-2">{field}</span>
      </label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(field, e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   resize-y leading-relaxed"
      />
    </div>
  );
}

function JsonTextArea({
  label,
  field,
  value,
  onChange,
  error,
  hint,
  onInsertSample,
  rows = 5,
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-700">
          {label}
          <span className="text-xs text-gray-400 ml-2">{field}</span>
        </label>
        <button
          type="button"
          onClick={onInsertSample}
          className="text-xs text-blue-500 hover:text-blue-700"
        >
          サンプルを挿入
        </button>
      </div>
      {hint && (
        <p className="text-xs text-gray-400 mb-1.5">形式: {hint}</p>
      )}
      <textarea
        value={value || ""}
        onChange={(e) => onChange(field, e.target.value)}
        rows={rows}
        className={`w-full px-4 py-2.5 border rounded-lg text-sm font-mono
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   resize-y leading-relaxed ${
                     error
                       ? "border-red-400 bg-red-50"
                       : "border-gray-300"
                   }`}
        spellCheck={false}
      />
      {error && (
        <p className="text-xs text-red-600 mt-1">⚠ {error}</p>
      )}
    </div>
  );
}
