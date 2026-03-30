#!/usr/bin/env bash
# db-counts.sh — DB件数の詳細確認
set -euo pipefail

CONTAINER="${CONTAINER:-navi-app}"
DB_PATH="/app/web/data/sports-event.db"

echo "=========================================="
echo "  DB 件数確認  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "=========================================="

docker exec "$CONTAINER" node -e "
  const D = require('better-sqlite3');
  const db = new D('$DB_PATH', { readonly: true });

  // --- administrative_actions ---
  console.log('');
  console.log('=== administrative_actions ===');
  const byIndustry = db.prepare(\`
    SELECT
      industry,
      COUNT(*) as total,
      SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN detail IS NOT NULL AND detail != '' THEN 1 ELSE 0 END) as enriched,
      MIN(action_date) as oldest,
      MAX(action_date) as newest
    FROM administrative_actions
    GROUP BY industry
    ORDER BY industry
  \`).all();

  console.log('industry           | total | published | enriched | oldest     | newest');
  console.log('-------------------|-------|-----------|----------|------------|----------');
  byIndustry.forEach(r => {
    const ind = (r.industry || 'unknown').padEnd(18);
    console.log(
      ind + ' | ' +
      String(r.total).padStart(5) + ' | ' +
      String(r.published).padStart(9) + ' | ' +
      String(r.enriched).padStart(8) + ' | ' +
      (r.oldest || 'N/A').padEnd(10) + ' | ' +
      (r.newest || 'N/A')
    );
  });

  // --- action_type 内訳 ---
  console.log('');
  console.log('=== action_type 内訳 ===');
  const byType = db.prepare(\`
    SELECT action_type, industry, COUNT(*) as cnt
    FROM administrative_actions
    GROUP BY action_type, industry
    ORDER BY industry, cnt DESC
  \`).all();
  byType.forEach(r => {
    console.log('  ' + (r.industry || '?').padEnd(15) + ' ' + (r.action_type || '?').padEnd(25) + ' ' + r.cnt);
  });

  // --- 最新10件 ---
  console.log('');
  console.log('=== 最新10件 ===');
  const recent = db.prepare(\`
    SELECT id, industry, action_date, organization_name_raw, action_type
    FROM administrative_actions
    ORDER BY created_at DESC
    LIMIT 10
  \`).all();
  recent.forEach(r => {
    const name = (r.organization_name_raw || '').substring(0, 30);
    console.log('  #' + String(r.id).padStart(5) + ' ' + (r.action_date || '?').padEnd(10) + ' ' + (r.industry || '?').padEnd(15) + ' ' + name);
  });

  // --- events (大会) ---
  console.log('');
  console.log('=== events (大会) ===');
  try {
    const evTotal = db.prepare('SELECT COUNT(*) as c FROM events').get();
    console.log('  total: ' + evTotal.c);
    // カラム存在チェックしてからソース別集計
    const cols = db.prepare(\"PRAGMA table_info(events)\").all().map(c => c.name);
    if (cols.includes('source_name')) {
      const evBySource = db.prepare('SELECT source_name, COUNT(*) as cnt FROM events GROUP BY source_name ORDER BY cnt DESC').all();
      evBySource.forEach(r => console.log('    ' + (r.source_name || '?').padEnd(20) + ' ' + r.cnt));
    } else if (cols.includes('source')) {
      const evBySource = db.prepare('SELECT source, COUNT(*) as cnt FROM events GROUP BY source ORDER BY cnt DESC').all();
      evBySource.forEach(r => console.log('    ' + (r.source || '?').padEnd(20) + ' ' + r.cnt));
    } else {
      console.log('  (source column not found, skipping breakdown)');
    }
  } catch (e) {
    console.log('  (events table query failed: ' + e.message + ')');
  }

  db.close();
  console.log('');
  console.log('完了');
"
