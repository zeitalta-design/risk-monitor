/**
 * watch_notifications — DB アクセス層
 *
 * Step A/B で整備された in-app 通知テーブル (watch_notifications) 用の
 * 薄いリポジトリ。cron (Step B) とは独立に、UI 側 API (Step C) から使う。
 *
 * 制約:
 *   - user 所有チェックは必ず SQL に入れる（他ユーザーの通知を取得・更新できない）
 *   - fuzzy / LLM は使わない
 *   - cursor pagination は (is_read, event_date, id) の3要素で安定動作
 */
import { getDb } from "@/lib/db";

// ─── cursor encode / decode ───────────────────────────
// cursor は base64(JSON{r, e, i}) の opaque 文字列。
//   r: is_read int（0 = unread, 1 = read）
//   e: event_date (YYYY-MM-DD)
//   i: notification id
// status=unread でも同じ形式を使う（r は常に 0）。
export function encodeCursor(row) {
  if (!row) return null;
  const payload = {
    r: row.read_at ? 1 : 0,
    e: row.event_date,
    i: row.id,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(s) {
  if (!s) return null;
  try {
    const json = Buffer.from(s, "base64url").toString("utf8");
    const obj = JSON.parse(json);
    if (typeof obj.r !== "number" || typeof obj.e !== "string" || typeof obj.i !== "number") {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

// ─── 一覧取得 ──────────────────────────────────────────
// Phase J-11/J-15: /watch-notifications 一覧ページの簡易フィルタ用。
// exact 一致のみ受け付ける（任意文字列は許容しない）。
const ALLOWED_TYPES = new Set(["gyosei_shobun", "nyusatsu", "deal_score", "saved_deal_update"]);

/**
 * @param {Object} opts
 * @param {number} opts.userId   - 認証済みユーザー ID（必須）
 * @param {"unread"|"all"} [opts.status="unread"]
 * @param {string|null} [opts.type]  - "gyosei_shobun" | "nyusatsu" | "deal_score" のいずれか
 * @param {number} [opts.limit=30]
 * @param {string|null} [opts.cursor]
 * @returns {{ items: Array, nextCursor: string|null }}
 */
export function listWatchNotifications({
  userId,
  status = "unread",
  type = null,
  limit = 30,
  cursor = null,
} = {}) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("userId is required");
  }
  const db = getDb();

  const lim = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 30));
  const cur = decodeCursor(cursor);

  // ORDER BY is_read ASC, event_date DESC, id DESC
  //   is_read = 0（unread）が先、同一 is_read 内は新しい順
  //
  // cursor condition（cur が渡された場合、cursor の次の row から）:
  //   (is_read_int > cur.r)
  //   OR (is_read_int = cur.r AND event_date < cur.e)
  //   OR (is_read_int = cur.r AND event_date = cur.e AND id < cur.i)
  const params = { user_id: userId, lim };
  const where = ["wn.user_id = @user_id"];
  if (status === "unread") where.push("wn.read_at IS NULL");
  if (typeof type === "string" && ALLOWED_TYPES.has(type)) {
    where.push("wn.type = @type");
    params.type = type;
  }
  if (cur) {
    where.push(`(
      (CASE WHEN wn.read_at IS NULL THEN 0 ELSE 1 END) > @cur_r
      OR ((CASE WHEN wn.read_at IS NULL THEN 0 ELSE 1 END) = @cur_r AND wn.event_date < @cur_e)
      OR ((CASE WHEN wn.read_at IS NULL THEN 0 ELSE 1 END) = @cur_r AND wn.event_date = @cur_e AND wn.id < @cur_i)
    )`);
    params.cur_r = cur.r;
    params.cur_e = cur.e;
    params.cur_i = cur.i;
  }

  // limit+1 取って次ページの有無を判定
  // Phase J-9: frequency 列を返却し、UI 側で「今日の有望案件まとめ」を識別する。
  const rows = db.prepare(`
    SELECT wn.id, wn.type, wn.source_slug, wn.event_date,
           wn.organization_name, wn.title, wn.summary,
           wn.frequency,
           wn.created_at, wn.read_at
    FROM watch_notifications wn
    WHERE ${where.join(" AND ")}
    ORDER BY (CASE WHEN wn.read_at IS NULL THEN 0 ELSE 1 END) ASC,
             wn.event_date DESC, wn.id DESC
    LIMIT @lim
  `).all({ ...params, lim: lim + 1 });

  const hasMore = rows.length > lim;
  const slice = hasMore ? rows.slice(0, lim) : rows;
  const items = slice.map(formatItem);
  const nextCursor = hasMore ? encodeCursor(slice[slice.length - 1]) : null;

  return { items, nextCursor };
}

// ─── item 整形（domain ラベル / sourceUrl を派生） ───
const DOMAIN_LABELS = {
  gyosei_shobun:     "行政処分",
  nyusatsu:          "入札/落札",
  deal_score:        "有望案件",
  saved_deal_update: "保存案件",
};

function domainLabel(type) {
  return DOMAIN_LABELS[type] || type || "通知";
}

// Phase J-6: deal_score 通知は source_slug を `deal:{slug}:{entityId}` で格納。
// UNIQUE (user_id, type, source_slug, event_date) を崩さず、同一 item でも
// entity が違えば別通知として扱えるようにする。
function parseDealScoreSlug(source_slug) {
  if (typeof source_slug !== "string" || !source_slug.startsWith("deal:")) return null;
  // "deal:{slug}:{entityId}" — slug 側に `:` が含まれても最後の ":" 以降を entityId とみなす
  const rest = source_slug.slice(5);
  const idx = rest.lastIndexOf(":");
  if (idx < 0) return null;
  const slug = rest.slice(0, idx);
  const entityIdStr = rest.slice(idx + 1);
  const entityId = parseInt(entityIdStr, 10);
  if (!slug || !Number.isFinite(entityId) || entityId <= 0) return null;
  return { slug, entityId };
}

function buildSourceUrl(type, source_slug, organization_name) {
  if (type === "gyosei_shobun" && source_slug) {
    return `/gyosei-shobun/${encodeURIComponent(source_slug)}`;
  }
  if (type === "nyusatsu" && organization_name) {
    // nyusatsu_results は個別詳細ページが無いため、落札企業キーワード検索に送る。
    return `/nyusatsu/results?keyword=${encodeURIComponent(organization_name)}`;
  }
  if (type === "deal_score" && source_slug) {
    const parsed = parseDealScoreSlug(source_slug);
    if (parsed) {
      return `/nyusatsu/${encodeURIComponent(parsed.slug)}?entityId=${parsed.entityId}`;
    }
  }
  // Phase J-15: saved_deal_update は source_slug に nyusatsu_items.slug を直で入れる。
  if (type === "saved_deal_update" && source_slug) {
    return `/nyusatsu/${encodeURIComponent(source_slug)}`;
  }
  return null;
}

function formatItem(r) {
  // Phase J-9: frequency は realtime / daily のみ。NULL / 不明値は realtime 扱いにする。
  const freq = r.frequency === "daily" ? "daily" : "realtime";
  return {
    id:               r.id,
    domain:           r.type,
    title:            r.title,
    eventDate:        r.event_date,
    sourceUrl:        buildSourceUrl(r.type, r.source_slug, r.organization_name),
    sourceLabel:      domainLabel(r.type),
    organizationName: r.organization_name,
    frequency:        freq,
    isRead:           !!r.read_at,
    readAt:           r.read_at || null,
    createdAt:        r.created_at,
  };
}

// ─── 既読化（ids 指定） ────────────────────────────────
/**
 * @param {Object} opts
 * @param {number} opts.userId
 * @param {number[]} opts.ids
 * @returns {{ updatedCount: number }}
 */
export function markWatchNotificationsRead({ userId, ids } = {}) {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("userId is required");
  if (!Array.isArray(ids)) throw new Error("ids must be array");
  const cleanIds = ids.filter((x) => Number.isInteger(x) && x > 0);
  if (cleanIds.length === 0) return { updatedCount: 0 };

  const db = getDb();
  // user 所有チェックを SQL 条件に必ず入れる（他ユーザーの id を混ぜても無視）。
  // 既読済み（read_at IS NOT NULL）は変更しない。
  const placeholders = cleanIds.map(() => "?").join(",");
  const res = db.prepare(`
    UPDATE watch_notifications
    SET read_at = datetime('now')
    WHERE user_id = ?
      AND read_at IS NULL
      AND id IN (${placeholders})
  `).run(userId, ...cleanIds);

  return { updatedCount: res.changes || 0 };
}

// ─── JST「今日 0:00」を SQLite `datetime('now')` 互換の UTC 文字列で返す ──
//   watch_notifications.created_at は SQLite `datetime('now')` =
//   `"YYYY-MM-DD HH:MM:SS"` (UTC, ミリ秒なし) で格納される。境界値も
//   同じフォーマットで作ると単純な文字列比較で `>= jstTodayStartUtcString()`
//   が正しく動作する。
//
//   JST = UTC+9。今の JST 時刻を UTC ms 空間で作って 1 日で floor し、
//   9 時間戻すことで「JST 当日 0:00」の UTC ms を得る。これを SQLite の
//   UTC 文字列フォーマットに整形して返す。
//
//   exported: client 側 (`lib/watch-notifications-ui.js`) の
//   `jstTodayStartUtcMs` と等価だが、server 側は "SQL に渡す文字列" という
//   別の出口が必要なので明示的に別関数として置く。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export function jstTodayStartUtcString(now = new Date()) {
  const jstNowMs = now.getTime() + JST_OFFSET_MS;
  const jstDayStartMs = Math.floor(jstNowMs / DAY_MS) * DAY_MS;
  const d = new Date(jstDayStartMs - JST_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() + "-" +
    pad(d.getUTCMonth() + 1) + "-" +
    pad(d.getUTCDate()) + " " +
    pad(d.getUTCHours()) + ":" +
    pad(d.getUTCMinutes()) + ":" +
    pad(d.getUTCSeconds())
  );
}

// ─── 既読化（当日 JST の daily deal_score digest 分のみ） ─────────────
// Phase J-12: client 側で id を集めて `/read` を叩く方式だと、通知が
//   ページング境界を越えたときに取りこぼす。サーバー側で条件指定の一括
//   UPDATE に切り替える。
//
//   対象: user_id = ?, type='deal_score', frequency='daily', read_at IS NULL,
//         created_at >= JST 当日 0:00（UTC 文字列比較）
//   範囲外（前日以前 / realtime / off / 他 type）はどちらの条件にも当たらず
//   変更しない。返却は updatedCount のみ。
/**
 * @param {Object} opts
 * @param {number} opts.userId
 * @param {Date}   [opts.now=new Date()]  -- テスト用に注入できる「現在」。
 * @returns {{ updatedCount: number, cutoff: string }}
 */
export function markDailyDigestRead({ userId, now = new Date() } = {}) {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("userId is required");
  const cutoff = jstTodayStartUtcString(now);
  const db = getDb();
  const res = db.prepare(`
    UPDATE watch_notifications
    SET read_at = datetime('now')
    WHERE user_id = ?
      AND type = 'deal_score'
      AND frequency = 'daily'
      AND read_at IS NULL
      AND created_at >= ?
  `).run(userId, cutoff);
  return { updatedCount: res.changes || 0, cutoff };
}

// ─── 既読化（全件） ────────────────────────────────────
/**
 * @param {Object} opts
 * @param {number} opts.userId
 * @returns {{ updatedCount: number }}
 */
export function markAllWatchNotificationsRead({ userId } = {}) {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("userId is required");

  const db = getDb();
  const res = db.prepare(`
    UPDATE watch_notifications
    SET read_at = datetime('now')
    WHERE user_id = ? AND read_at IS NULL
  `).run(userId);

  return { updatedCount: res.changes || 0 };
}

// ─── 未読件数 ────────────────────────────────────────
/**
 * ヘッダーベル用の軽量 unread-count 取得。
 * user 所有チェックを SQL 条件に必ず入れる。
 *
 * @param {number} userId
 * @returns {number}
 */
export function countUnreadWatchNotifications(userId) {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("userId is required");
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) AS n
    FROM watch_notifications
    WHERE user_id = ? AND read_at IS NULL
  `).get(userId);
  return row?.n || 0;
}
