/**
 * Cron: Deal Score 通知ジェネレータ（Phase J-6）
 *
 * GET  /api/cron/notify-deal-score   → dry-run（件数プレビューのみ、書込なし）
 * POST /api/cron/notify-deal-score   → 実行（INSERT OR IGNORE）
 *
 * 処理:
 *   1. watched_organizations を取得
 *   2. 各 watch の organization_name を organizations テーブルと完全一致させ、
 *      entity_links.resolved_entity_id（最大 confidence）を解決する
 *      （fuzzy / LIKE / LLM は使わない。解決不能は skip）
 *   3. watch → entity_id のユニーク集合を作り、entity ごとに共通 bundle を 1 度だけ
 *      使う `computeDealScoreMap` で Deal Score を計算
 *   4. score >= THRESHOLD (= 80) の (user, entity, item) を
 *      INSERT OR IGNORE で watch_notifications へ格納
 *      - type:          "deal_score"
 *      - source_slug:   `deal:{slug}:{entityId}` — 同一 item でも entity が違えば別通知
 *      - event_date:    announcement_date
 *      → UNIQUE (user_id, type, source_slug, event_date) により cron 再実行で二重通知せず
 *
 * ポリシー:
 *   - 候補 items は最新 CANDIDATE_LIMIT 件（全件スキャン禁止）
 *   - watch → entity は exact name match のみ（意図しないマッチを防ぐ）
 *   - 既存 /api/cron/notify（gyosei / nyusatsu）とは独立、相互影響なし
 *
 * 認証:
 *   - Authorization: Bearer $CRON_SECRET（Vercel cron 用）
 *   - または admin_session / mvp_session cookie（手動呼び出し）
 *   - CRON_SECRET 未設定時は dev とみなしてスキップ
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeDealScoreMap } from "@/lib/agents/analyzer/nyusatsu";
import { resolveIssuerKey } from "@/lib/nyusatsu-issuer";

export const dynamic = "force-dynamic";

const THRESHOLD = 80;           // 「非常に有望」以上だけ通知
const CANDIDATE_LIMIT = 200;    // 直近 N 件の items だけ score 化
const INSERT_BATCH = 100;       // SQLite 999 parameter 制限対策

// Phase J-10: sibling sub-routes (`/realtime`, `/daily`) が再利用するため export。
export function verifyCronAuth(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
  }
  const adminSession =
    request.cookies?.get?.("admin_session")?.value ||
    request.cookies?.get?.("mvp_session")?.value;
  if (adminSession) return true;
  if (!secret) return true; // dev
  return false;
}

// ─── watch → entity_id の解決（exact 名前一致 → entity_links 最大 confidence）──
//   返却: Array<{ user_id, organization_name, entity_id, deal_score_threshold, notify_frequency }>
function resolveWatchEntities(db) {
  const watches = db.prepare(`
    SELECT w.id AS watch_id, w.user_id, w.organization_name,
           w.deal_score_threshold, w.notify_frequency
    FROM watched_organizations w
    ORDER BY w.id
  `).all();

  if (watches.length === 0) return [];

  // organizations を exact name で lookup。display_name / normalized_name 両方見る。
  const names = watches.map((w) => w.organization_name);
  const uniqNames = [...new Set(names.filter(Boolean))];
  if (uniqNames.length === 0) return [];

  const placeholders = uniqNames.map(() => "?").join(",");
  const orgs = db.prepare(`
    SELECT id, display_name, normalized_name
    FROM organizations
    WHERE display_name IN (${placeholders})
       OR normalized_name IN (${placeholders})
  `).all(...uniqNames, ...uniqNames);

  // display_name / normalized_name → org_id map（複数候補は最小 id）
  const nameToOrgId = new Map();
  for (const o of orgs) {
    for (const k of [o.display_name, o.normalized_name]) {
      if (!k) continue;
      const prev = nameToOrgId.get(k);
      if (prev == null || o.id < prev) nameToOrgId.set(k, o.id);
    }
  }

  const allOrgIds = [...new Set([...nameToOrgId.values()])];
  if (allOrgIds.length === 0) return [];

  // entity_links を一括取得 → org_id → 最大 confidence の entity_id
  const orgPH = allOrgIds.map(() => "?").join(",");
  const linkRows = db.prepare(`
    SELECT organization_id, resolved_entity_id, confidence
    FROM entity_links
    WHERE organization_id IN (${orgPH})
  `).all(...allOrgIds);

  const orgIdToEntity = new Map();
  for (const l of linkRows) {
    const c = Number.isFinite(l.confidence) ? l.confidence : 0;
    const cur = orgIdToEntity.get(l.organization_id);
    if (!cur || c > cur.confidence) {
      orgIdToEntity.set(l.organization_id, { entity_id: l.resolved_entity_id, confidence: c });
    }
  }

  const resolved = [];
  for (const w of watches) {
    const orgId = nameToOrgId.get(w.organization_name);
    if (orgId == null) continue;
    const ent = orgIdToEntity.get(orgId);
    if (!ent) continue;
    // Phase J-8: frequency を resolved watch に持たせて、run() 内で mode に応じ
    // て filter する。null / 不正値は realtime 扱い（DB default と同じ）。
    const freq = w.notify_frequency;
    const effectiveFreq = (freq === "realtime" || freq === "daily" || freq === "off")
      ? freq
      : "realtime";
    resolved.push({
      watch_id:              w.watch_id,
      user_id:               w.user_id,
      organization_name:     w.organization_name,
      entity_id:             ent.entity_id,
      deal_score_threshold:  Number.isFinite(w.deal_score_threshold)
                               ? w.deal_score_threshold
                               : 80,
      notify_frequency:      effectiveFreq,
    });
  }
  return resolved;
}

// ─── 候補 items（最新 CANDIDATE_LIMIT 件、announcement_date 降順） ──
function fetchCandidateItems(db) {
  return db.prepare(`
    SELECT id, slug, title, category,
           announcement_date AS date,
           issuer_name, issuer_dept_hint, issuer_code
    FROM nyusatsu_items
    WHERE is_published = 1
      AND announcement_date IS NOT NULL AND announcement_date != ''
      AND slug IS NOT NULL AND slug != ''
    ORDER BY announcement_date DESC
    LIMIT ${CANDIDATE_LIMIT}
  `).all();
}

// ─── タイトル / summary ──
function buildDealTitle(label, title) {
  const labelPart = label || "有望案件";
  return `${labelPart}: ${title || "(件名不明)"}`;
}
// Phase J-13: topReason を summary 末尾に 1 件だけ添える。
//   `computeDealScoreMap` が返す `topReason`（reasons[0]、中立メッセージは null 化）
//   を受けて、1 行要約を壊さない範囲で理由を見せる。
function buildDealSummary(score, category, item, topReason) {
  const parts = [`Deal Score ${score}`];
  if (category) parts.push(category);
  const issuerKeyInfo = resolveIssuerKey({
    issuer_dept_hint: item.issuer_dept_hint,
    issuer_code:      item.issuer_code,
  });
  if (issuerKeyInfo) {
    if (issuerKeyInfo.type === "dept_hint") parts.push(`issuerヒント: ${issuerKeyInfo.key}`);
    else if (issuerKeyInfo.type === "code") parts.push(`code: ${issuerKeyInfo.key}`);
  }
  if (topReason) parts.push(topReason);
  return parts.join(" / ");
}

// ─── メインランナー ──
// Phase J-7: 通常は watch ごとの deal_score_threshold を使う。
//   opts.thresholdOverride が数値なら全 watch に対してその値を最優先適用
//   （ops 検証 / `?minScore=` 用）。
// Phase J-8: mode で watch を frequency で絞る:
//   - "realtime": notify_frequency === 'realtime' の watch のみ
//   - "daily":    notify_frequency === 'daily' の watch のみ
//   - notify_frequency === 'off' はどちらでも skip
// Phase J-10: sibling sub-routes が mode を固定して呼ぶため export。
export async function run({ dryRun = false, thresholdOverride = null, mode = "realtime" } = {}) {
  const db = getDb();

  // 1. watch → entity_id 解決
  const resolvedAll = resolveWatchEntities(db);

  // Phase J-8: frequency で filter。mode と一致する watch だけが対象。
  //   off はどちらの mode でも skip。
  const skippedOff = resolvedAll.filter((w) => w.notify_frequency === "off").length;
  const watchedEntities = resolvedAll.filter((w) => w.notify_frequency === mode);

  // 2. 候補 items
  const candidates = fetchCandidateItems(db);
  const itemsById = new Map(candidates.map((c) => [c.id, c]));

  const summary = {
    dryRun,
    mode,
    defaultThreshold:      THRESHOLD,
    thresholdOverride,
    watchedEntitiesTotal:  resolvedAll.length,
    watchedEntities:       watchedEntities.length,
    candidateItems:        candidates.length,
    scoredPairs:           0,
    insertedNotifications: 0,
    skippedDuplicates:     0,
    skippedBelowThreshold: 0,
    skippedOff,
    uniqueEntitiesScored:  0,
    perWatch:              [],
  };

  if (watchedEntities.length === 0 || candidates.length === 0) {
    return summary;
  }

  // 3. entity ごとの score map を一度だけ計算（同じ entity を複数 user が watch
  //    していても 1 回で済ませる）
  const uniqueEntityIds = [...new Set(watchedEntities.map((w) => w.entity_id))];
  summary.uniqueEntitiesScored = uniqueEntityIds.length;

  // entity_id → Map<item_id, { score, label, topReason }>
  const scoreByEntity = new Map();
  for (const entityId of uniqueEntityIds) {
    try {
      const rows = await computeDealScoreMap({ db, entityId, items: candidates });
      const m = new Map();
      for (const r of rows) m.set(r.id, { score: r.score, label: r.label, topReason: r.topReason });
      scoreByEntity.set(entityId, m);
      summary.scoredPairs += rows.length;
    } catch (e) {
      console.error(`[notify-deal-score] score failed for entity=${entityId}:`, e.message);
    }
  }

  // 4. (user, entity, item) タプルを組み立て、watch ごとの threshold で絞る
  //    優先順: thresholdOverride(?minScore=) > watch.deal_score_threshold > 80
  const toInsert = [];
  for (const w of watchedEntities) {
    const scoreMap = scoreByEntity.get(w.entity_id);
    if (!scoreMap) continue;
    const effective = thresholdOverride != null
      ? thresholdOverride
      : (w.deal_score_threshold ?? THRESHOLD);

    const perWatch = {
      watch_id:              w.watch_id,
      user_id:               w.user_id,
      entity_id:             w.entity_id,
      threshold:             effective,
      frequency:             w.notify_frequency,
      candidateItems:        scoreMap.size,
      passedThreshold:       0,
      skippedBelowThreshold: 0,
    };

    for (const [itemId, s] of scoreMap) {
      if (s.score < effective) {
        perWatch.skippedBelowThreshold += 1;
        summary.skippedBelowThreshold  += 1;
        continue;
      }
      const item = itemsById.get(itemId);
      if (!item) continue;
      perWatch.passedThreshold += 1;
      toInsert.push({
        user_id:           w.user_id,
        entity_id:         w.entity_id,
        organization_name: w.organization_name,
        item,
        score:             s.score,
        label:             s.label,
        topReason:         s.topReason || null,
      });
    }
    summary.perWatch.push(perWatch);
  }

  if (dryRun || toInsert.length === 0) {
    // dry-run では insertedNotifications は 0 のまま。スキップ系は候補数として報告
    return summary;
  }

  // 5. 冪等 INSERT（UNIQUE で二重通知を弾く）
  db.exec("BEGIN");
  try {
    for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
      const slice = toInsert.slice(i, i + INSERT_BATCH);
      // Phase J-9: frequency を行に残す（UI 側の「今日のまとめ」識別用）。
      // dedupe キー (user_id, type, source_slug, event_date) は従来どおり不変。
      const placeholders = slice.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const params = [];
      for (const x of slice) {
        const sourceSlug = `deal:${x.item.slug}:${x.entity_id}`;
        params.push(
          x.user_id,
          "deal_score",
          sourceSlug,
          x.item.date,                               // event_date = announcement_date
          x.organization_name || "",
          buildDealTitle(x.label, x.item.title),
          buildDealSummary(x.score, x.item.category, x.item, x.topReason),
          mode,                                      // frequency = "realtime" | "daily"
        );
      }
      const res = db.prepare(
        `INSERT OR IGNORE INTO watch_notifications
           (user_id, type, source_slug, event_date, organization_name, title, summary, frequency)
         VALUES ${placeholders}`
      ).run(...params);
      const inserted = res.changes || 0;
      summary.insertedNotifications += inserted;
      summary.skippedDuplicates     += (slice.length - inserted);
    }
    db.exec("COMMIT");
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch {}
    console.error("[notify-deal-score] INSERT failed:", e);
    throw e;
  }

  return summary;
}

// ─── HTTP handlers ──
// ops 検証用 override（`?minScore=N`）。指定が無ければ null = per-watch を使う。
function parseThresholdOverride(request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("minScore");
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

// Phase J-8: `?mode=realtime` (default) | `?mode=daily`。
//   off watch はどちらの mode でも insert しない。
//   未知の値は realtime にフォールバック（安全側）。
function parseMode(request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("mode");
  if (raw === "daily") return "daily";
  return "realtime";
}

export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const thresholdOverride = parseThresholdOverride(request);
    const mode = parseMode(request);
    const result = await run({ dryRun: true, thresholdOverride, mode });
    console.log("[notify-deal-score] dry-run", result);
    return NextResponse.json({ ...result, preview: true });
  } catch (e) {
    console.error("[notify-deal-score] GET error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const thresholdOverride = parseThresholdOverride(request);
    const mode = parseMode(request);
    const result = await run({ dryRun: false, thresholdOverride, mode });
    console.log("[notify-deal-score] run", result);
    return NextResponse.json({ ...result, ok: true });
  } catch (e) {
    console.error("[notify-deal-score] POST error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
