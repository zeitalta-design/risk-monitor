/**
 * QA 層の DB アクセスヘルパー。
 * snapshot 書込み / 既存 snapshot 取得 / finding 記録 を提供。
 */

/**
 * JST 日付を "YYYY-MM-DD" で返す
 */
export function todayJst() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * N 日前の JST 日付
 */
export function daysAgoJst(n) {
  return new Date(Date.now() + 9 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);
}

/**
 * DB アクセスを束ねた store オブジェクト。
 * 同一プロセスで複数チェックで共有できる。
 */
export function createQaStore(db) {
  if (!db) throw new TypeError("createQaStore: db is required");

  const upsertSnapshot = db.prepare(`
    INSERT INTO qa_snapshots (captured_on, metric, value, meta, created_at)
    VALUES (@captured_on, @metric, @value, @meta, datetime('now'))
    ON CONFLICT(captured_on, metric) DO UPDATE SET
      value = excluded.value, meta = excluded.meta, created_at = datetime('now')
  `);

  const selectSnapshot = db.prepare(
    "SELECT * FROM qa_snapshots WHERE captured_on = ? AND metric = ?"
  );

  const selectHistory = db.prepare(
    "SELECT captured_on, value FROM qa_snapshots WHERE metric = ? ORDER BY captured_on DESC LIMIT ?"
  );

  const insertFinding = db.prepare(`
    INSERT INTO qa_findings (captured_on, severity, category, metric, message, detail, detected_at)
    VALUES (@captured_on, @severity, @category, @metric, @message, @detail, datetime('now'))
  `);

  return {
    /**
     * snapshot 1 メトリクス書き込み（同日同メトリクスは上書き）
     * @param {{day: string, metric: string, value: number, meta?: object}} s
     */
    putSnapshot({ day, metric, value, meta }) {
      upsertSnapshot.run({
        captured_on: day,
        metric,
        value: Math.round(Number(value) || 0),
        meta: meta ? JSON.stringify(meta) : null,
      });
    },

    /**
     * 指定日・メトリクスの snapshot を取得
     */
    getSnapshot(day, metric) {
      return selectSnapshot.get(day, metric) || null;
    },

    /**
     * 直近 N 日分の履歴（新しい順）
     */
    getHistory(metric, n = 7) {
      return selectHistory.all(metric, n);
    },

    /**
     * finding 記録
     */
    recordFinding({ day, severity, category, metric = null, message, detail = null }) {
      insertFinding.run({
        captured_on: day,
        severity,
        category,
        metric,
        message,
        detail: detail ? JSON.stringify(detail) : null,
      });
    },
  };
}
