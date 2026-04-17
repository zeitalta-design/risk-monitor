/**
 * QA チェック群（Phase 3 最小実装）
 *
 * 各チェックは store を使って snapshot を取り、必要なら finding を記録する。
 * どれも単一関数 (純関数に近い) として呼び出せる。
 *
 * 成功条件:
 *   - 入札ラインの異常を早期検知できる
 *   - 同じ構造を補助金 DB へコピーできる（domain 指定で切替）
 */

// ─── 対象メトリクス定義 ─────────────────────
// 他ドメインへコピーするときはここを差し替えれば再利用可能。

/** 入札ドメインのテーブル件数メトリクス */
export const NYUSATSU_COUNT_METRICS = [
  { metric: "count.nyusatsu_items",    sql: "SELECT COUNT(*) c FROM nyusatsu_items WHERE is_published = 1" },
  { metric: "count.nyusatsu_results",  sql: "SELECT COUNT(*) c FROM nyusatsu_results WHERE is_published = 1" },
  { metric: "count.resolved_entities", sql: "SELECT COUNT(*) c FROM resolved_entities" },
  { metric: "count.entity_clusters",   sql: "SELECT COUNT(*) c FROM entity_clusters" },
  { metric: "count.resolution_aliases",sql: "SELECT COUNT(*) c FROM resolution_aliases" },
];

/** 容量モニタ対象（Turso 全体＆テーブル級） */
export const CAPACITY_METRICS = [
  { metric: "size.nyusatsu_items.rows",    sql: "SELECT COUNT(*) c FROM nyusatsu_items" },
  { metric: "size.nyusatsu_results.rows",  sql: "SELECT COUNT(*) c FROM nyusatsu_results" },
  { metric: "size.sanpai_items.rows",      sql: "SELECT COUNT(*) c FROM sanpai_items" },
  { metric: "size.hojokin_items.rows",     sql: "SELECT COUNT(*) c FROM hojokin_items" },
];

// ─── (1) 件数 snapshot 取得 ─────────────────────

/**
 * 指定メトリクス群の値を取得して store.putSnapshot で記録する。
 * @returns {Array<{metric: string, value: number}>}
 */
export function captureCountSnapshots({ db, store, day, metrics = NYUSATSU_COUNT_METRICS }) {
  const results = [];
  for (const m of metrics) {
    try {
      const row = db.prepare(m.sql).get();
      const value = Number(row?.c || 0);
      store.putSnapshot({ day, metric: m.metric, value });
      results.push({ metric: m.metric, value });
    } catch (e) {
      // テーブル未存在等は warn 相当で finding だけ残す
      store.recordFinding({
        day, severity: "warn", category: "capacity", metric: m.metric,
        message: `snapshot 失敗: ${e.message}`,
      });
    }
  }
  return results;
}

// ─── (2) 前日比しきい値チェック ─────────────────────

/**
 * 指定メトリクス群で今日 vs 昨日（or 7日前 fallback）の変動を評価。
 * 閾値:
 *   - ±30% でも件数差 >= 10 → warn
 *   - ±50% で件数差 >= 50  → critical
 *   - 減少（マイナス変動）は符号付きで判定し、件数減は critical 側に寄せる
 */
export function checkDelta({
  store, day,
  metrics = NYUSATSU_COUNT_METRICS,
  warnPct = 0.30,
  critPct = 0.50,
  minAbsoluteWarn = 10,
  minAbsoluteCrit = 50,
}) {
  const out = [];
  for (const m of metrics) {
    const today = store.getSnapshot(day, m.metric);
    if (!today) continue;

    // 昨日 → 見つからなければ直近 7 日以内で最新を使う
    const hist = store.getHistory(m.metric, 10).filter((h) => h.captured_on !== day);
    const prev = hist[0];
    if (!prev) continue; // 履歴なしはスキップ

    const a = Number(today.value || 0);
    const b = Number(prev.value || 0);
    const diff = a - b;
    const baseForRatio = Math.max(b, 1); // 0 除算回避
    const pct = diff / baseForRatio;
    const absDiff = Math.abs(diff);

    // 減少は critical 側に寄せる（データ欠損の疑いが大きい）
    let severity = null;
    if (diff < 0 && absDiff >= minAbsoluteCrit) {
      severity = Math.abs(pct) >= warnPct ? "critical" : "warn";
    } else if (Math.abs(pct) >= critPct && absDiff >= minAbsoluteCrit) {
      severity = "critical";
    } else if (Math.abs(pct) >= warnPct && absDiff >= minAbsoluteWarn) {
      severity = "warn";
    }

    if (severity) {
      const pctStr = `${(pct * 100).toFixed(1)}%`;
      const sign = diff > 0 ? "+" : "";
      store.recordFinding({
        day, severity, category: "delta", metric: m.metric,
        message: `前回 ${prev.captured_on} (${b}) → 今回 ${day} (${a}) 変動 ${sign}${diff} (${pctStr})`,
        detail: { prev: prev.captured_on, prev_value: b, today_value: a, diff, pct },
      });
    }
    out.push({ metric: m.metric, prev_day: prev.captured_on, prev_value: b, today_value: a, diff, pct, severity });
  }
  return out;
}

// ─── (3) freshness: cron の実行時刻監視 ─────────────────────

/**
 * sync_runs テーブル（各 domain の実行履歴）から最終実行を見て古すぎを検知。
 */
export function checkFreshness({
  db, store, day,
  domains = [
    { id: "nyusatsu",         maxHours: 30 },
    { id: "nyusatsu_kkj",     maxHours: 30 },
    { id: "nyusatsu_results", maxHours: 30 },
    { id: "sanpai",           maxHours: 30 },
  ],
}) {
  const out = [];
  for (const d of domains) {
    try {
      const r = db.prepare(
        "SELECT finished_at FROM sync_runs WHERE domain_id = ? ORDER BY id DESC LIMIT 1"
      ).get(d.id);
      if (!r || !r.finished_at) {
        store.recordFinding({
          day, severity: "warn", category: "freshness", metric: `freshness.${d.id}`,
          message: `sync_runs に ${d.id} の実行履歴なし`,
        });
        out.push({ domain: d.id, severity: "warn", reason: "no_history" });
        continue;
      }
      const finishedMs = Date.parse(String(r.finished_at).replace(" ", "T") + "Z");
      const ageHours = (Date.now() - finishedMs) / 3_600_000;
      store.putSnapshot({
        day, metric: `freshness.${d.id}.hours_since_last`,
        value: Math.round(ageHours),
      });
      if (ageHours > d.maxHours) {
        store.recordFinding({
          day, severity: ageHours > d.maxHours * 2 ? "critical" : "warn",
          category: "freshness", metric: `freshness.${d.id}`,
          message: `${d.id} の最終実行から ${ageHours.toFixed(1)}h 経過（閾値 ${d.maxHours}h）`,
          detail: { finished_at: r.finished_at, age_hours: ageHours, max_hours: d.maxHours },
        });
        out.push({ domain: d.id, severity: "warn", age_hours: ageHours });
      } else {
        out.push({ domain: d.id, severity: "ok", age_hours: ageHours });
      }
    } catch (e) {
      out.push({ domain: d.id, severity: "error", error: e.message });
    }
  }
  return out;
}

// ─── (4) resolver / cluster 増分監視 ─────────────────────

/**
 * resolved_entities と entity_clusters の増分が想定外（急激な減少）を検知。
 * captureCountSnapshots と checkDelta で代替可能だが、明示的にカバーするためのラッパー。
 */
export function checkResolverGrowth({ store, day }) {
  const metrics = [
    "count.resolved_entities",
    "count.entity_clusters",
    "count.resolution_aliases",
  ];
  return checkDelta({
    store, day,
    metrics: metrics.map((m) => ({ metric: m })),
    warnPct: 0.20, critPct: 0.40,
    minAbsoluteWarn: 5, minAbsoluteCrit: 20,
  });
}

// ─── (5) Analyzer API 健全性 ─────────────────────

/**
 * Analyzer の主要関数が空レスポンスを返していないか確認。
 * 0 件返しが継続するのは Resolver が未走行の可能性。
 */
export function checkApiHealth({ db, store, day, analyzer }) {
  const out = [];
  try {
    const r = analyzer.getAwardRanking({ db, by: "entity", metric: "count", limit: 1 });
    const ok = r.length > 0 && Number(r[0].total_awards) > 0;
    store.putSnapshot({
      day, metric: "api.ranking.entity.top1_count",
      value: ok ? Number(r[0].total_awards) : 0,
    });
    if (!ok) {
      store.recordFinding({
        day, severity: "warn", category: "api_health", metric: "api.ranking.entity",
        message: "getAwardRanking(entity) が空またはゼロ件。Resolver 未実行の疑い。",
      });
    }
    out.push({ check: "ranking.entity", ok });
  } catch (e) {
    store.recordFinding({
      day, severity: "critical", category: "api_health", metric: "api.ranking.entity",
      message: `getAwardRanking エラー: ${e.message}`,
    });
    out.push({ check: "ranking.entity", ok: false, error: e.message });
  }

  try {
    const t = analyzer.getAwardTimeline({ db, granularity: "month" });
    const ok = t.length > 0;
    store.putSnapshot({ day, metric: "api.timeline.periods", value: t.length });
    if (!ok) {
      store.recordFinding({
        day, severity: "warn", category: "api_health", metric: "api.timeline",
        message: "getAwardTimeline が空。データ未投入？",
      });
    }
    out.push({ check: "timeline", ok });
  } catch (e) {
    store.recordFinding({
      day, severity: "critical", category: "api_health", metric: "api.timeline",
      message: `getAwardTimeline エラー: ${e.message}`,
    });
    out.push({ check: "timeline", ok: false, error: e.message });
  }

  return out;
}

// ─── (6) 容量モニタ ─────────────────────

export function checkCapacity({
  db, store, day,
  metrics = CAPACITY_METRICS,
  rowsCriticalHigh = 2_000_000, // 200万行で critical 警告
  rowsWarnHigh = 500_000,
}) {
  const out = [];
  for (const m of metrics) {
    try {
      const row = db.prepare(m.sql).get();
      const value = Number(row?.c || 0);
      store.putSnapshot({ day, metric: m.metric, value });
      let severity = null;
      if (value >= rowsCriticalHigh) severity = "critical";
      else if (value >= rowsWarnHigh) severity = "warn";
      if (severity) {
        store.recordFinding({
          day, severity, category: "capacity", metric: m.metric,
          message: `テーブル行数 ${value.toLocaleString()} が閾値超過`,
          detail: { rowsWarnHigh, rowsCriticalHigh },
        });
      }
      out.push({ metric: m.metric, value, severity });
    } catch (e) {
      // テーブルが無い domain は skip
      out.push({ metric: m.metric, skipped: true, error: e.message });
    }
  }
  return out;
}
