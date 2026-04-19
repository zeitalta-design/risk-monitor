"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Phase J-3: entity picker（最小構成）
 *
 * 「誰の視点で Deal Score を見るか」を切り替える最小 UI。
 * 入力は entityId 直入力のみ。オートコンプリート / 名前検索は今回範囲外。
 *
 * entityId 解決ルール（優先順位）:
 *   1. URL query `?entityId=...`
 *   2. localStorage[STORAGE_KEY] の直近値
 *   3. fallbackEntityId
 *
 * 選択変更時:
 *   - URL query を router.replace で更新（他 params は保持）
 *   - localStorage に保存
 *   - onChange(entityId) を発火
 *
 * Props:
 *   - fallbackEntityId  (必須)  デモ / 未選択時の表示対象
 *   - onChange(entityId)        解決済み entityId を受け取るコールバック
 */

const STORAGE_KEY = "nyusatsu:selectedEntityId";

export default function EntityPicker({ fallbackEntityId, onChange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 表示中の（適用済み）entity。初期値は URL query があればそれ、なければ fallback。
  // localStorage は useEffect で別途解決する（SSR / hydration セーフ）。
  const initialFromUrl = parseEntityId(searchParams.get("entityId"));
  const [entityId, setEntityId]     = useState(initialFromUrl || fallbackEntityId);
  const [inputValue, setInputValue] = useState(String(initialFromUrl || fallbackEntityId));
  const [inputError, setInputError] = useState(null);
  const [isDemo, setIsDemo]         = useState(!initialFromUrl); // URL 明示なし＝デモ扱い

  const notifiedRef = useRef(false);
  const emitChange = useCallback((id) => {
    if (typeof onChange === "function") onChange(id);
  }, [onChange]);

  // Mount 時の解決：URL が無ければ localStorage → それも無ければ fallback
  useEffect(() => {
    const fromUrl = parseEntityId(searchParams.get("entityId"));
    if (fromUrl) {
      setEntityId(fromUrl);
      setInputValue(String(fromUrl));
      setIsDemo(false);
      if (!notifiedRef.current) {
        emitChange(fromUrl);
        notifiedRef.current = true;
      }
      return;
    }
    let stored = null;
    try {
      stored = typeof window !== "undefined" ? parseEntityId(window.localStorage.getItem(STORAGE_KEY)) : null;
    } catch {
      stored = null;
    }
    if (stored) {
      setEntityId(stored);
      setInputValue(String(stored));
      setIsDemo(false);
      if (!notifiedRef.current) {
        emitChange(stored);
        notifiedRef.current = true;
      }
    } else {
      setEntityId(fallbackEntityId);
      setInputValue(String(fallbackEntityId));
      setIsDemo(true);
      if (!notifiedRef.current) {
        emitChange(fallbackEntityId);
        notifiedRef.current = true;
      }
    }
    // 初回 mount のみ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = useCallback(() => {
    const parsed = parseEntityId(inputValue);
    if (!parsed) {
      setInputError("企業IDを正しく入力してください（正の整数）");
      return;
    }
    setInputError(null);
    setEntityId(parsed);
    setIsDemo(false);

    try {
      window.localStorage.setItem(STORAGE_KEY, String(parsed));
    } catch { /* quota / disabled: 無視 */ }

    const params = new URLSearchParams(searchParams.toString());
    params.set("entityId", String(parsed));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    emitChange(parsed);
  }, [inputValue, pathname, router, searchParams, emitChange]);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch { /* noop */ }

    setInputError(null);
    setEntityId(fallbackEntityId);
    setInputValue(String(fallbackEntityId));
    setIsDemo(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("entityId");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    emitChange(fallbackEntityId);
  }, [fallbackEntityId, pathname, router, searchParams, emitChange]);

  const onKeyDown = (e) => { if (e.key === "Enter") apply(); };

  return (
    <div className="mb-3 bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="entity-picker-input" className="text-sm font-medium text-gray-700">
          企業を選択
        </label>
        <input
          id="entity-picker-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setInputError(null); }}
          onKeyDown={onKeyDown}
          placeholder="企業ID（数値）"
          className="w-40 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#2F9FD3]"
          aria-invalid={!!inputError}
        />
        <button
          type="button"
          onClick={apply}
          className="px-3 py-1 text-sm font-medium text-white bg-[#2F9FD3] hover:bg-[#2789b8] rounded"
        >
          表示
        </button>
        <button
          type="button"
          onClick={clear}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded"
        >
          クリア
        </button>
        <span className="ml-1 text-xs text-gray-500">
          現在の企業ID: <span className="font-mono text-gray-700">{entityId}</span>
          {isDemo && <span className="ml-2 text-gray-400">（デモ表示）</span>}
        </span>
      </div>
      {inputError && (
        <p className="mt-2 text-xs text-red-600" role="alert">{inputError}</p>
      )}
    </div>
  );
}

function parseEntityId(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (!/^[0-9]+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
