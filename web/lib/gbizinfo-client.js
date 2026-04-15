/**
 * gBizINFO API クライアント（経済産業省）
 *
 * https://info.gbiz.go.jp/hojin/APIManual
 *
 * 利用には事前にAPIトークン申請が必要。
 * 環境変数 GBIZINFO_API_TOKEN に設定する。
 *
 * 提供情報:
 *   - 法人基本情報 (getHojin)
 *   - 届出・認定情報 = 許認可 (getCertification)
 *   - 補助金情報 (getSubsidy)
 *   - 調達情報 (getProcurement)
 *   - 表彰情報 (getAward)
 *   - 特許情報 (getPatent)
 *   - 財務情報 (getFinance)
 *   - 職場情報 (getWorkplace)
 *
 * 企業名からの検索（searchByName）も可能だが、法人番号検索より遅い。
 */

const BASE_URL = "https://info.gbiz.go.jp/hojin/v1/hojin";
const DEFAULT_TIMEOUT_MS = 15000;

function getToken() {
  const token = process.env.GBIZINFO_API_TOKEN;
  if (!token) {
    throw new Error("GBIZINFO_API_TOKEN が未設定です。https://info.gbiz.go.jp/hojin/APIManual で申請してください");
  }
  return token;
}

async function gbizFetch(pathOrUrl, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
  const res = await fetch(url, {
    headers: {
      "X-hojinInfo-api-token": getToken(),
      Accept: "application/json",
      "User-Agent": "RiskMonitor/1.0 (kyoninka-collector)",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`gBizINFO HTTP ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    err.url = url;
    throw err;
  }
  return res.json();
}

/**
 * 法人基本情報を取得
 * @param {string} corporateNumber 13桁の法人番号
 * @returns {Promise<object|null>} hojin-infos[0] or null
 */
export async function getHojin(corporateNumber) {
  if (!/^\d{13}$/.test(corporateNumber)) {
    throw new Error(`Invalid corporate number: ${corporateNumber}`);
  }
  const data = await gbizFetch(`/${corporateNumber}`);
  const list = data?.["hojin-infos"] || [];
  return list[0] || null;
}

/**
 * 届出・認定（許認可）情報を取得
 * @param {string} corporateNumber
 * @returns {Promise<Array>} certification 配列
 */
export async function getCertification(corporateNumber) {
  if (!/^\d{13}$/.test(corporateNumber)) {
    throw new Error(`Invalid corporate number: ${corporateNumber}`);
  }
  try {
    const data = await gbizFetch(`/${corporateNumber}/certification`);
    const hojin = data?.["hojin-infos"]?.[0];
    return hojin?.certifications || [];
  } catch (e) {
    if (e.status === 404) return [];
    throw e;
  }
}

/**
 * 補助金情報を取得
 */
export async function getSubsidy(corporateNumber) {
  if (!/^\d{13}$/.test(corporateNumber)) {
    throw new Error(`Invalid corporate number: ${corporateNumber}`);
  }
  try {
    const data = await gbizFetch(`/${corporateNumber}/subsidy`);
    const hojin = data?.["hojin-infos"]?.[0];
    return hojin?.subsidies || [];
  } catch (e) {
    if (e.status === 404) return [];
    throw e;
  }
}

/**
 * 法人名から検索
 * @param {string} name 検索する法人名
 * @param {object} opts
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=10] 結果の最大件数（クライアント側で制限）
 * @returns {Promise<Array>} hojin-infos 配列
 */
export async function searchByName(name, { page = 1, limit = 10 } = {}) {
  if (!name || name.trim().length < 2) return [];
  const params = new URLSearchParams({
    name: name.trim(),
    page: String(page),
  });
  // search エンドポイントは v1/hojin?name=... （末尾スラッシュなし）
  const data = await gbizFetch(`?${params}`);
  const list = data?.["hojin-infos"] || [];
  return list.slice(0, limit);
}

/**
 * certification 配列を kyoninka_registrations の形式に正規化
 */
export function normalizeCertification(cert, { corporateNumber } = {}) {
  // gBizINFO certification の代表的フィールド:
  //   category: 許認可カテゴリ（例: "建設業許可"）
  //   qualification_grade: 等級・種別
  //   date_of_approval: 許可日
  //   date_of_expiration: 有効期限
  //   governmentDepartments: 所管省庁・認定機関
  //   title: 詳細名称
  const category = cert?.category || cert?.title || "";
  const familySlug = inferLicenseFamily(category);
  const typeSlug = inferLicenseType(familySlug, category);

  return {
    license_family: familySlug,
    license_type: typeSlug,
    registration_number: cert?.registration_number || cert?.qualification_grade || null,
    authority_name: (cert?.governmentDepartments?.[0] || cert?.department || "").slice(0, 100) || null,
    valid_from: formatDate(cert?.date_of_approval),
    valid_to: formatDate(cert?.date_of_expiration),
    registration_status: inferStatus(cert),
    source_name: "gBizINFO",
    source_url: corporateNumber
      ? `https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${corporateNumber}`
      : "https://info.gbiz.go.jp/",
    detail_url: null,
    _raw_category: category,
  };
}

function inferLicenseFamily(category) {
  const s = String(category || "");
  if (/建設業/.test(s)) return "construction";
  if (/宅地建物取引|宅建/.test(s)) return "real_estate";
  if (/産業廃棄物|廃棄物処理/.test(s)) return "waste_disposal";
  if (/食品衛生|飲食店|食品製造/.test(s)) return "food_sanitation";
  if (/運送|貨物|自動車運送|旅客/.test(s)) return "transport";
  if (/警備/.test(s)) return "security";
  return "other";
}

function inferLicenseType(family, category) {
  const s = String(category || "");
  switch (family) {
    case "construction":
      return /特定/.test(s) ? "special_construction" : "general_construction";
    case "real_estate":
      return /管理業/.test(s) ? "real_estate_management" : "real_estate_broker";
    case "waste_disposal":
      if (/最終処分/.test(s)) return "final_disposal";
      if (/中間処理/.test(s)) return "intermediate_disposal";
      return "collection_transport";
    case "food_sanitation":
      return /製造/.test(s) ? "food_manufacturing" : "restaurant";
    case "transport":
      return /軽/.test(s) ? "light_cargo" : "general_cargo";
    case "security":
      return "security_service";
    default:
      return "other";
  }
}

function inferStatus(cert) {
  const expiration = cert?.date_of_expiration;
  if (cert?.revoked) return "revoked";
  if (cert?.suspended) return "suspended";
  if (expiration) {
    const exp = new Date(expiration);
    if (!Number.isNaN(exp.getTime()) && exp < new Date()) return "expired";
  }
  return "active";
}

function formatDate(iso) {
  if (!iso) return null;
  // gBizINFO は YYYY-MM-DD または YYYY-MM-DDTHH:MM:SS 両方ありうる
  const s = String(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
