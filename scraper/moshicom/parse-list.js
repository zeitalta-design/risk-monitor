/**
 * MOSHICOM 検索結果HTMLから大会データを抽出
 */

const { inferSportType } = require("../sport-type-inference");

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const REGION_MAP = {
  "北海道": "hokkaido",
  "青森県": "tohoku", "岩手県": "tohoku", "宮城県": "tohoku", "秋田県": "tohoku", "山形県": "tohoku", "福島県": "tohoku",
  "茨城県": "kanto", "栃木県": "kanto", "群馬県": "kanto", "埼玉県": "kanto", "千葉県": "kanto", "東京都": "kanto", "神奈川県": "kanto",
  "新潟県": "hokuriku", "富山県": "hokuriku", "石川県": "hokuriku", "福井県": "hokuriku",
  "山梨県": "koshinetsu", "長野県": "koshinetsu",
  "岐阜県": "tokai", "静岡県": "tokai", "愛知県": "tokai", "三重県": "tokai",
  "滋賀県": "kinki", "京都府": "kinki", "大阪府": "kinki", "兵庫県": "kinki", "奈良県": "kinki", "和歌山県": "kinki",
  "鳥取県": "chugoku", "島根県": "chugoku", "岡山県": "chugoku", "広島県": "chugoku", "山口県": "chugoku",
  "徳島県": "shikoku", "香川県": "shikoku", "愛媛県": "shikoku", "高知県": "shikoku",
  "福岡県": "kyushu", "佐賀県": "kyushu", "長崎県": "kyushu", "熊本県": "kyushu", "大分県": "kyushu", "宮崎県": "kyushu", "鹿児島県": "kyushu", "沖縄県": "kyushu",
};

function parseJapaneseDate(text) {
  if (!text) return null;
  const m = text.match(/(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function extractPrefecture(text) {
  if (!text) return null;
  for (const p of PREFECTURES) {
    if (text.includes(p)) return p;
  }
  return null;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

/**
 * MOSHICOMの一覧ページHTMLからイベントを抽出
 *
 * MOSHICOMの一覧はカード型レイアウト。
 * 各イベントは /event/XXXXX のリンクを持つ。
 */
function parsePage(html) {
  if (!html || html.length < 1000) return [];

  const events = [];
  // イベントリンクパターン: /event/XXXXX
  const eventPattern = /<a[^>]*href="\/event\/(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set();
  let match;

  while ((match = eventPattern.exec(html)) !== null) {
    const eventId = match[1];
    if (seen.has(eventId)) continue;
    seen.add(eventId);

    const block = match[2];
    // タイトル抽出（最初の意味のあるテキスト）
    const titleMatch = block.match(/<(?:h[2-4]|div|span)[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)/i)
      || block.match(/<(?:h[2-4])[^>]*>([^<]{5,})/i);
    let title = titleMatch ? stripTags(titleMatch[1]).trim() : null;

    // タイトルがなければ画像altから
    if (!title) {
      const altMatch = block.match(/alt="([^"]{5,})"/);
      title = altMatch ? altMatch[1].trim() : null;
    }

    if (!title || title.length < 3) continue;

    // 日付
    const dateMatch = block.match(/(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})/);
    const eventDate = dateMatch ? parseJapaneseDate(dateMatch[0]) : null;
    const eventMonth = eventDate ? eventDate.split("-")[1].replace(/^0/, "") : null;

    // 場所
    const placeText = stripTags(block);
    const prefecture = extractPrefecture(placeText);

    // スポーツタイプ
    let sportType = "marathon";
    try {
      const result = inferSportType(title, placeText);
      if (result && typeof result === "object") sportType = result.sportType || "marathon";
      else if (typeof result === "string") sportType = result;
    } catch {}

    // 画像
    const imgMatch = block.match(/<img[^>]*(?:src|data-src)="(https?:\/\/[^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    events.push({
      source_site: "moshicom",
      source_event_id: `MC${eventId}`,
      title,
      normalized_title: title.replace(/[　\s]+/g, " ").trim(),
      sport_type: sportType,
      sport_slug: sportType,
      area_region: prefecture ? REGION_MAP[prefecture] || null : null,
      prefecture,
      city: null,
      venue_name: null,
      event_date: eventDate,
      event_month: eventMonth,
      entry_start_date: null,
      entry_end_date: null,
      entry_status: "unknown",
      source_url: `https://moshicom.com/event/${eventId}`,
      official_url: null,
      hero_image_url: imageUrl,
      description: "",
      is_active: 1,
    });
  }

  return events;
}

function deduplicateEvents(events) {
  const seen = new Set();
  return events.filter((ev) => {
    if (seen.has(ev.source_event_id)) return false;
    seen.add(ev.source_event_id);
    return true;
  });
}

module.exports = { parsePage, deduplicateEvents };
