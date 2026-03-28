/**
 * 種目推定ライブラリ
 *
 * タイトル・説明文などから種目(距離)を推定する。
 * スクレイパーが races を返せなかった場合のフォールバック。
 */

/**
 * 距離パターン定義（優先度順）
 */
const DISTANCE_PATTERNS = [
  // 明示的なマラソン種別
  { pattern: /フルマラソン|フル42|42\.195\s*km/i, name: "フルマラソン", type: "full_marathon", km: 42.195 },
  { pattern: /ハーフマラソン|ハーフ21|21\.0975\s*km/i, name: "ハーフマラソン", type: "half_marathon", km: 21.0975 },
  { pattern: /ウルトラマラソン|100\s*km|100km|ウルトラ/i, name: "ウルトラマラソン", type: "ultra", km: 100 },

  // 数値+km パターン（降順で大きい距離から）
  { pattern: /(?:^|[^\d])50\s*(?:km|キロ)/i, name: "50km", type: "ultra", km: 50 },
  { pattern: /(?:^|[^\d])42\s*(?:km|キロ)/i, name: "フルマラソン", type: "full_marathon", km: 42.195 },
  { pattern: /(?:^|[^\d])30\s*(?:km|キロ)/i, name: "30km", type: "30km", km: 30 },
  { pattern: /(?:^|[^\d])21\s*(?:km|キロ)/i, name: "ハーフマラソン", type: "half_marathon", km: 21.0975 },
  { pattern: /(?:^|[^\d])20\s*(?:km|キロ)/i, name: "20km", type: "20km", km: 20 },
  { pattern: /(?:^|[^\d])15\s*(?:km|キロ)/i, name: "15km", type: "15km", km: 15 },
  { pattern: /(?:^|[^\d])10\s*(?:km|キロ)/i, name: "10km", type: "10km", km: 10 },
  { pattern: /(?:^|[^\d])5\s*(?:km|キロ)/i, name: "5km", type: "5km", km: 5 },
  { pattern: /(?:^|[^\d])3\s*(?:km|キロ)/i, name: "3km", type: "3km", km: 3 },
  { pattern: /(?:^|[^\d])2\s*(?:km|キロ)/i, name: "2km", type: "2km", km: 2 },
  { pattern: /(?:^|[^\d])1\s*(?:km|キロ)/i, name: "1km", type: "1km", km: 1 },

  // カテゴリ種別
  { pattern: /親子ラン|親子マラソン|ファミリーラン|ファミリーマラソン/i, name: "親子ラン", type: "fun_run", km: null },
  { pattern: /キッズ|ジュニア|こどもラン|子供ラン/i, name: "キッズラン", type: "fun_run", km: null },
  { pattern: /ファンラン|fun\s*run/i, name: "ファンラン", type: "fun_run", km: null },
  { pattern: /駅伝/i, name: "駅伝", type: "relay", km: null },
  { pattern: /リレーマラソン|リレー/i, name: "リレーマラソン", type: "relay", km: null },
  { pattern: /トレイルラン|トレイル|TRAIL/i, name: "トレイルラン", type: "trail", km: null },
  { pattern: /ウォーク|ウォーキング|歩|walk/i, name: "ウォーキング", type: "walk", km: null },
  { pattern: /ロゲイニング|rogaine/i, name: "ロゲイニング", type: "other", km: null },
];

/**
 * テキストから種目（距離）を推定する
 * @param {string[]} texts - 検索対象テキスト配列（タイトル、説明文等）
 * @returns {Array<{ race_name, race_type, distance_km, sort_order }>}
 */
export function inferRaces(...texts) {
  const combined = texts.filter(Boolean).join(" ");
  if (!combined.trim()) return [];

  const found = [];
  const seen = new Set();

  for (const dp of DISTANCE_PATTERNS) {
    if (dp.pattern.test(combined) && !seen.has(dp.name)) {
      seen.add(dp.name);
      found.push({
        race_name: dp.name,
        race_type: dp.type,
        distance_km: dp.km,
        sort_order: found.length,
      });
    }
  }

  // 「マラソン」単独（他に距離指定がない場合のみフルマラソンと推定）
  if (found.length === 0 && /マラソン/.test(combined) && !/トレイル|駅伝|リレー|ウォーク|オンライン|バーチャル|ONLINE|Virtual/i.test(combined)) {
    found.push({
      race_name: "マラソン",
      race_type: "full_marathon",
      distance_km: 42.195,
      sort_order: 0,
    });
  }

  return found;
}

/**
 * 大会がオンライン/バーチャルで距離情報を持たないか判定
 */
export function isOnlineRace(title, description) {
  const text = (title || "") + " " + (description || "");
  return /ONLINE|オンライン|バーチャル|TATTA|セルフチャレンジ|Virtual|リモート/i.test(text);
}
