import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * 巡回パトロール API — リスクデータ品質監視
 * 6カテゴリ横断の品質チェック
 */

const DOMAIN_CONFIG = {
  "gyosei-shobun": {
    table: "administrative_actions",
    label: "行政処分",
    nameCol: "organization_name_raw",
    sourceUrlCol: "source_url",
    prefectureCol: "prefecture",
    publishCol: "is_published",
    slugCol: "slug",
    editPath: "/admin/gyosei-shobun",
  },
  sanpai: {
    table: "sanpai_items",
    label: "産廃処分",
    nameCol: "company_name",
    sourceUrlCol: "source_url",
    prefectureCol: "prefecture",
    publishCol: "is_published",
    slugCol: "slug",
    editPath: "/admin/sanpai",
  },
  nyusatsu: {
    table: "nyusatsu_items",
    label: "入札",
    nameCol: "title",
    sourceUrlCol: "announcement_url",
    prefectureCol: null,
    publishCol: "is_published",
    slugCol: "slug",
    editPath: "/admin/nyusatsu",
  },
  shitei: {
    table: "shitei_items",
    label: "指定管理",
    nameCol: "title",
    sourceUrlCol: "source_url",
    prefectureCol: "prefecture",
    publishCol: "is_published",
    slugCol: "slug",
    editPath: "/admin/shitei",
  },
  hojokin: {
    table: "hojokin_items",
    label: "補助金",
    nameCol: "title",
    sourceUrlCol: "source_url",
    prefectureCol: null,
    publishCol: "is_published",
    slugCol: "slug",
    editPath: "/admin/hojokin",
  },
  kyoninka: {
    table: "kyoninka_entities",
    label: "許認可",
    nameCol: "entity_name",
    sourceUrlCol: "source_url",
    prefectureCol: "prefecture",
    publishCol: "is_published",
    slugCol: "slug",
    editPath: "/admin/kyoninka",
  },
};

const ISSUE_META = {
  missing_source: { label: "ソースURL未設定", level: "danger", priority: 1 },
  unpublished: { label: "未公開データ", level: "warning", priority: 2 },
  stale_30d: { label: "30日以上未更新", level: "warning", priority: 3 },
  no_prefecture: { label: "都道府県未設定", level: "warning", priority: 4 },
  sync_failed: { label: "同期エラー", level: "danger", priority: 5 },
  needs_review: { label: "要レビュー", level: "danger", priority: 6 },
  low_confidence: { label: "信頼度低", level: "info", priority: 7 },
};

function safeCount(db, sql, params = []) {
  try {
    return db.prepare(sql).get(...params)?.c || 0;
  } catch {
    return 0;
  }
}

export async function GET(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const issue = searchParams.get("issue");
    const staleDate = new Date(Date.now() - 30 * 86400000).toISOString().replace("T", " ").slice(0, 19);

    // 問題種別ごとの件数を集計
    const issueCounts = {};

    // missing_source: ソースURL未設定
    let missingSource = 0;
    for (const [, cfg] of Object.entries(DOMAIN_CONFIG)) {
      missingSource += safeCount(db,
        `SELECT COUNT(*) as c FROM ${cfg.table} WHERE ${cfg.publishCol} = 1 AND (${cfg.sourceUrlCol} IS NULL OR ${cfg.sourceUrlCol} = '')`
      );
    }
    issueCounts.missing_source = missingSource;

    // unpublished: 未公開データ
    let unpublished = 0;
    for (const [, cfg] of Object.entries(DOMAIN_CONFIG)) {
      unpublished += safeCount(db,
        `SELECT COUNT(*) as c FROM ${cfg.table} WHERE ${cfg.publishCol} = 0`
      );
    }
    issueCounts.unpublished = unpublished;

    // stale_30d: 30日以上未更新
    let stale = 0;
    for (const [, cfg] of Object.entries(DOMAIN_CONFIG)) {
      stale += safeCount(db,
        `SELECT COUNT(*) as c FROM ${cfg.table} WHERE ${cfg.publishCol} = 1 AND updated_at < ?`,
        [staleDate]
      );
    }
    issueCounts.stale_30d = stale;

    // no_prefecture: 都道府県未設定（対象カテゴリのみ）
    let noPref = 0;
    for (const [, cfg] of Object.entries(DOMAIN_CONFIG)) {
      if (!cfg.prefectureCol) continue;
      noPref += safeCount(db,
        `SELECT COUNT(*) as c FROM ${cfg.table} WHERE ${cfg.publishCol} = 1 AND (${cfg.prefectureCol} IS NULL OR ${cfg.prefectureCol} = '')`
      );
    }
    issueCounts.no_prefecture = noPref;

    // sync_failed: 同期エラー
    issueCounts.sync_failed = safeCount(db,
      `SELECT COUNT(*) as c FROM sync_runs WHERE run_status = 'failed'`
    );

    // needs_review: 要レビュー
    issueCounts.needs_review = safeCount(db,
      `SELECT COUNT(*) as c FROM change_logs WHERE requires_review = 1 AND reviewed_at IS NULL`
    );

    // low_confidence: 信頼度低
    issueCounts.low_confidence = safeCount(db,
      `SELECT COUNT(*) as c FROM ai_extractions WHERE confidence_score < 0.5 AND quality_level = 'draft'`
    );

    // カード生成
    const issueCards = Object.entries(issueCounts).map(([key, count]) => ({
      key,
      ...ISSUE_META[key],
      count,
    })).sort((a, b) => {
      if (a.count > 0 && b.count === 0) return -1;
      if (a.count === 0 && b.count > 0) return 1;
      return a.priority - b.priority;
    });

    // 全公開データ数
    let totalPublished = 0;
    for (const [, cfg] of Object.entries(DOMAIN_CONFIG)) {
      totalPublished += safeCount(db,
        `SELECT COUNT(*) as c FROM ${cfg.table} WHERE ${cfg.publishCol} = 1`
      );
    }

    // 選択された問題種別の詳細一覧
    let items = [];
    if (issue && ISSUE_META[issue]) {
      items = loadIssueItems(db, issue, staleDate);
    }

    return NextResponse.json({
      issueCards,
      items,
      selectedIssue: issue,
      totalPublished,
    });
  } catch (err) {
    console.error("Patrol API error:", err);
    return NextResponse.json({
      error: "取得に失敗しました",
      issueCards: [],
      items: [],
      totalPublished: 0,
    }, { status: 500 });
  }
}

/**
 * 問題種別に応じた詳細アイテム一覧を取得
 */
function loadIssueItems(db, issue, staleDate) {
  const results = [];

  switch (issue) {
    case "missing_source": {
      for (const [domain, cfg] of Object.entries(DOMAIN_CONFIG)) {
        try {
          const rows = db.prepare(
            `SELECT id, ${cfg.nameCol} as name, ${cfg.sourceUrlCol} as source_url, updated_at
             ${cfg.prefectureCol ? `, ${cfg.prefectureCol} as prefecture` : ""}
             FROM ${cfg.table}
             WHERE ${cfg.publishCol} = 1 AND (${cfg.sourceUrlCol} IS NULL OR ${cfg.sourceUrlCol} = '')
             LIMIT 50`
          ).all();
          for (const row of rows) {
            results.push({ ...row, domain, domainLabel: cfg.label, editPath: cfg.editPath, prefecture: row.prefecture || null });
          }
        } catch { /* table may not exist */ }
      }
      break;
    }

    case "unpublished": {
      for (const [domain, cfg] of Object.entries(DOMAIN_CONFIG)) {
        try {
          const rows = db.prepare(
            `SELECT id, ${cfg.nameCol} as name, ${cfg.sourceUrlCol} as source_url, updated_at
             ${cfg.prefectureCol ? `, ${cfg.prefectureCol} as prefecture` : ""}
             FROM ${cfg.table}
             WHERE ${cfg.publishCol} = 0
             ORDER BY updated_at DESC LIMIT 50`
          ).all();
          for (const row of rows) {
            results.push({ ...row, domain, domainLabel: cfg.label, editPath: cfg.editPath, prefecture: row.prefecture || null });
          }
        } catch { /* table may not exist */ }
      }
      break;
    }

    case "stale_30d": {
      for (const [domain, cfg] of Object.entries(DOMAIN_CONFIG)) {
        try {
          const rows = db.prepare(
            `SELECT id, ${cfg.nameCol} as name, ${cfg.sourceUrlCol} as source_url, updated_at
             ${cfg.prefectureCol ? `, ${cfg.prefectureCol} as prefecture` : ""}
             FROM ${cfg.table}
             WHERE ${cfg.publishCol} = 1 AND updated_at < ?
             ORDER BY updated_at ASC LIMIT 50`,
          ).all(staleDate);
          for (const row of rows) {
            results.push({ ...row, domain, domainLabel: cfg.label, editPath: cfg.editPath, prefecture: row.prefecture || null });
          }
        } catch { /* table may not exist */ }
      }
      break;
    }

    case "no_prefecture": {
      for (const [domain, cfg] of Object.entries(DOMAIN_CONFIG)) {
        if (!cfg.prefectureCol) continue;
        try {
          const rows = db.prepare(
            `SELECT id, ${cfg.nameCol} as name, ${cfg.sourceUrlCol} as source_url, updated_at
             FROM ${cfg.table}
             WHERE ${cfg.publishCol} = 1 AND (${cfg.prefectureCol} IS NULL OR ${cfg.prefectureCol} = '')
             LIMIT 50`
          ).all();
          for (const row of rows) {
            results.push({ ...row, domain, domainLabel: cfg.label, editPath: cfg.editPath, prefecture: null });
          }
        } catch { /* table may not exist */ }
      }
      break;
    }

    case "sync_failed": {
      try {
        const rows = db.prepare(
          `SELECT id, domain_id as domain, run_type, run_status, error_summary,
                  started_at, finished_at, fetched_count, failed_count
           FROM sync_runs WHERE run_status = 'failed'
           ORDER BY started_at DESC LIMIT 50`
        ).all();
        for (const row of rows) {
          const cfg = DOMAIN_CONFIG[row.domain];
          results.push({
            id: row.id,
            name: `${cfg?.label || row.domain} — ${row.run_type}同期 (${row.error_summary || "エラー"})`,
            domain: row.domain,
            domainLabel: cfg?.label || row.domain,
            editPath: null,
            source_url: null,
            prefecture: null,
            updated_at: row.started_at,
            sync_detail: {
              run_type: row.run_type,
              error_summary: row.error_summary,
              fetched_count: row.fetched_count,
              failed_count: row.failed_count,
              started_at: row.started_at,
              finished_at: row.finished_at,
            },
          });
        }
      } catch { /* table may not exist */ }
      break;
    }

    case "needs_review": {
      try {
        const rows = db.prepare(
          `SELECT cl.id, cl.domain_id as domain, cl.entity_type, cl.entity_id,
                  cl.entity_slug, cl.change_type, cl.field_name,
                  cl.before_value, cl.after_value, cl.confidence_score,
                  cl.created_at as updated_at
           FROM change_logs cl
           WHERE cl.requires_review = 1 AND cl.reviewed_at IS NULL
           ORDER BY cl.created_at DESC LIMIT 50`
        ).all();
        for (const row of rows) {
          const cfg = DOMAIN_CONFIG[row.domain];
          results.push({
            id: row.id,
            name: `${row.entity_type}#${row.entity_id} — ${row.field_name}: ${row.change_type}`,
            domain: row.domain,
            domainLabel: cfg?.label || row.domain,
            editPath: cfg?.editPath || null,
            entity_id: row.entity_id,
            source_url: null,
            prefecture: null,
            updated_at: row.updated_at,
            change_detail: {
              field_name: row.field_name,
              change_type: row.change_type,
              before_value: row.before_value,
              after_value: row.after_value,
              confidence_score: row.confidence_score,
            },
          });
        }
      } catch { /* table may not exist */ }
      break;
    }

    case "low_confidence": {
      try {
        const rows = db.prepare(
          `SELECT ae.id, ae.domain_id as domain, ae.entity_type, ae.entity_id,
                  ae.extraction_type, ae.confidence_score, ae.missing_fields,
                  ae.review_reasons, ae.created_at as updated_at
           FROM ai_extractions ae
           WHERE ae.confidence_score < 0.5 AND ae.quality_level = 'draft'
           ORDER BY ae.confidence_score ASC LIMIT 50`
        ).all();
        for (const row of rows) {
          const cfg = DOMAIN_CONFIG[row.domain];
          results.push({
            id: row.id,
            name: `${row.entity_type}#${row.entity_id} — ${row.extraction_type} (信頼度: ${Math.round(row.confidence_score * 100)}%)`,
            domain: row.domain,
            domainLabel: cfg?.label || row.domain,
            editPath: cfg?.editPath || null,
            entity_id: row.entity_id,
            source_url: null,
            prefecture: null,
            updated_at: row.updated_at,
            extraction_detail: {
              confidence_score: row.confidence_score,
              missing_fields: row.missing_fields,
              review_reasons: row.review_reasons,
            },
          });
        }
      } catch { /* table may not exist */ }
      break;
    }
  }

  return results;
}

/**
 * PATCH: データに対するアクション
 */
export async function PATCH(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const db = getDb();
    const body = await request.json();
    const { action, domain, item_id, change_log_id } = body;

    if (!action) {
      return NextResponse.json({ error: "action は必須です" }, { status: 400 });
    }

    switch (action) {
      case "toggle_publish": {
        if (!domain || !item_id) {
          return NextResponse.json({ error: "domain と item_id は必須です" }, { status: 400 });
        }
        const cfg = DOMAIN_CONFIG[domain];
        if (!cfg) {
          return NextResponse.json({ error: `不明なドメイン: ${domain}` }, { status: 400 });
        }
        const row = db.prepare(`SELECT ${cfg.publishCol} as pub FROM ${cfg.table} WHERE id = ?`).get(item_id);
        if (!row) return NextResponse.json({ error: "データが見つかりません" }, { status: 404 });
        const newVal = row.pub ? 0 : 1;
        db.prepare(`UPDATE ${cfg.table} SET ${cfg.publishCol} = ?, updated_at = datetime('now') WHERE id = ?`).run(newVal, item_id);
        return NextResponse.json({
          message: newVal ? "公開に変更しました" : "非公開に変更しました",
          is_published: newVal,
        });
      }

      case "mark_reviewed": {
        if (!change_log_id) {
          return NextResponse.json({ error: "change_log_id は必須です" }, { status: 400 });
        }
        db.prepare(
          `UPDATE change_logs SET reviewed_at = datetime('now'), reviewed_by = 'admin' WHERE id = ?`
        ).run(change_log_id);
        return NextResponse.json({ message: "レビュー済みに変更しました" });
      }

      default:
        return NextResponse.json({ error: `不明なアクション: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("Patrol PATCH error:", err);
    return NextResponse.json({ error: "操作に失敗しました" }, { status: 500 });
  }
}
