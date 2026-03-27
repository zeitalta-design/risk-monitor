/**
 * 行政処分DB Source — 国土交通省系（建設業監督処分）
 *
 * Source:
 *   - 国土交通省ネガティブ情報等検索サイト: https://www.mlit.go.jp/nega-inf/
 *   - 各地方整備局の記者発表（PDF）
 *
 * 取得方式:
 *   国交省のネガティブ情報検索はCGI+PDF主体のため、自動スクレイピングは困難。
 *   当面はキュレーション型（手動確認＋構造化JSON）で取り込み、
 *   将来的に API or 定型HTML公開が始まった場合にスクレイパーを追加する。
 *
 * データソース記録:
 *   source_name: "国土交通省"
 *   source_url: 各処分の公表ページ or PDF URL
 */

import { fetchHtml, extractText, stripTags } from "../fetch-helper.js";

// ─── ソース定義 ───

export const GYOSEI_SHOBUN_SOURCES = [
  {
    id: "mlit_nega_inf",
    name: "国土交通省ネガティブ情報等検索サイト",
    url: "https://www.mlit.go.jp/nega-inf/",
    type: "cgi",
    fetchable: false, // CGI形式のため自動取得不可
    note: "建設業・宅建業・運送業等の行政処分情報。5年分公開。月1回更新。",
  },
  {
    id: "mlit_kanto",
    name: "関東地方整備局 建設業監督処分",
    url: "https://www.ktr.mlit.go.jp/kensan/index00000006.html",
    type: "pdf_press_release",
    fetchable: false, // PDF記者発表のため自動取得不可
    note: "個別処分ごとにPDF記者発表。テーブル形式の一覧ページなし。",
  },
];

/**
 * 処分種別の正規化
 */
export function normalizeActionType(raw) {
  if (!raw) return "other";
  const s = raw.trim();
  if (s.includes("許可取消") || s.includes("取消")) return "license_revocation";
  if (s.includes("営業停止") || s.includes("事業停止")) return "business_suspension";
  if (s.includes("改善命令") || s.includes("改善")) return "improvement_order";
  if (s.includes("指示") || s.includes("警告")) return "warning";
  if (s.includes("指導") || s.includes("勧告")) return "guidance";
  return "other";
}

/**
 * 業種の正規化
 */
export function normalizeIndustry(raw) {
  if (!raw) return "other";
  const s = raw.trim();
  if (s.includes("建設") || s.includes("土木") || s.includes("建築")) return "construction";
  if (s.includes("廃棄物") || s.includes("産廃")) return "waste";
  if (s.includes("運送") || s.includes("運輸") || s.includes("物流") || s.includes("貨物")) return "transport";
  if (s.includes("派遣") || s.includes("人材")) return "staffing";
  if (s.includes("不動産") || s.includes("宅建")) return "real_estate";
  if (s.includes("食品") || s.includes("飲食")) return "food";
  if (s.includes("医療") || s.includes("介護") || s.includes("福祉")) return "medical";
  if (s.includes("金融") || s.includes("保険") || s.includes("証券")) return "finance";
  return "other";
}

/**
 * slug生成（重複しにくい形式）
 */
export function generateActionSlug({ action_date, action_type, organization_name_raw, authority_name }) {
  const datePart = (action_date || "unknown").replace(/-/g, "");
  // 正規化した事業者名（法人格除去・短縮）
  const orgPart = (organization_name_raw || "unknown")
    .replace(/株式会社|有限会社|（株）|\(株\)|合同会社|医療法人社団|一般社団法人/g, "")
    .trim()
    .substring(0, 12);
  const typePart = (action_type || "other").substring(0, 20);
  // authority の頭2文字を追加して一意性を高める
  const authPart = (authority_name || "").substring(0, 4);

  return `${datePart}-${typePart}-${orgPart}-${authPart}`
    .replace(/\s+/g, "-")
    .replace(/[^\w\u3000-\u9FFF-]/g, "")
    .replace(/-+/g, "-")
    .replace(/-$/, "")
    .substring(0, 80);
}
