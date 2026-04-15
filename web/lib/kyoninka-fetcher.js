/**
 * 許認可（kyoninka）取得ロジック
 *
 * リスクモニターの文脈に合わせ、行政処分を受けた企業を起点として
 * gBizINFO から許認可・届出認定情報を取得する。
 *
 * フロー:
 *   1. administrative_actions から対象企業を取得（未解決の法人優先）
 *   2. organizations.corporate_number が無ければ gBizINFO の法人名検索で解決
 *   3. certification エンドポイントで許認可情報を取得
 *   4. kyoninka_entities / kyoninka_registrations に upsert
 *
 * Vercel Hobby の10秒制限では回り切らないため、CLI / GitHub Actions で実行。
 */
import { getDb } from "@/lib/db";
import {
  getHojin,
  getCertification,
  searchByName,
  normalizeCertification,
} from "@/lib/gbizinfo-client";
import { normalizeEntityName } from "@/lib/kyoninka-config";

const DEFAULT_LIMIT = 50;
const DELAY_MS = 700; // gBizINFO のrate limit考慮

/**
 * 行政処分/産廃処分対象企業を起点に許認可情報を取得し DB に upsert する
 *
 * @param {object} opts
 * @param {number} [opts.limit=50] 1回に処理する企業数
 * @param {boolean} [opts.onlyMissing=true] corporate_number 未解決の企業のみ対象
 * @param {boolean} [opts.dryRun=false]
 * @param {"actions"|"sanpai"|"all"} [opts.source="actions"] 対象企業のソース
 * @param {function} [opts.logger]
 * @returns {Promise<{ok,processed,resolved,certFetched,created,updated,errors,elapsed,source}>}
 */
export async function fetchAndUpsertKyoninka({
  limit = DEFAULT_LIMIT,
  onlyMissing = true,
  dryRun = false,
  source = "actions",
  logger = console.log,
} = {}) {
  const db = getDb();
  const startTime = Date.now();
  const log = (msg) => logger(`[kyoninka-fetcher] ${msg}`);

  let processed = 0;
  let resolved = 0; // gBizINFOで法人番号解決できた数
  let certFetched = 0; // certification取得成功数
  let created = 0;
  let updated = 0;
  const errors = [];

  const targets = getTargetsBySource({ db, source, onlyMissing, limit });
  log(`Start: ${targets.length} targets from source=${source}, dryRun=${dryRun}, onlyMissing=${onlyMissing}`);

  for (const row of targets) {
    processed++;
    const displayName = row.display_name || row.name_raw;
    let corporateNumber = row.corporate_number;

    // 企業名として明らかに不適切なデータをスキップ（スクレイパー誤抽出対策）
    const skip = shouldSkipAsCompanyName(displayName);
    if (skip) {
      log(`  ⊘ skip (${skip}): ${displayName.slice(0, 40)}`);
      continue;
    }

    try {
      // 法人番号が未解決なら gBizINFO 名前検索で解決
      if (!corporateNumber) {
        await sleep(DELAY_MS);
        // 行政処分データの略記「（有）」「(株)」等を正式名称に展開してから検索
        const searchQueries = buildSearchQueries(displayName);
        let hits = [];
        for (const q of searchQueries) {
          hits = await searchByName(q, { limit: 3 });
          if (hits.length > 0) break;
          await sleep(300);
        }
        const best = pickBestMatch(hits, displayName, row.prefecture);
        if (!best) {
          log(`  ✗ ${displayName}: gBizINFO で法人番号解決できず`);
          continue;
        }
        corporateNumber = best.corporate_number;
        resolved++;
        log(`  → ${displayName}: 解決 ${corporateNumber} (${best.name})`);

        if (!dryRun) {
          upsertOrganizationCorporateNumber(db, row, corporateNumber, best);
        }
      }

      // certification 取得
      await sleep(DELAY_MS);
      const certs = await getCertification(corporateNumber);
      certFetched++;

      if (!dryRun) {
        // certs が空でも法人番号解決済みなので entity 自体は登録（基本情報として価値あり）
        const r = upsertKyoninkaForCorporate(db, {
          corporateNumber,
          displayName,
          row,
          certs,
        });
        created += r.created;
        updated += r.updated;
        const certNote = certs.length > 0 ? `${certs.length}件の許認可` : "許認可情報なし";
        const opNote = r.created ? `+${r.created}` : `~${r.updated}`;
        log(`  ${certs.length > 0 ? "✓" : "·"} ${displayName}: ${certNote} (${opNote})`);
      } else {
        log(`  (dry) ${displayName}: ${certs.length}件の許認可`);
      }
    } catch (e) {
      const detail = e.status ? `HTTP ${e.status} ${e.url || ""}` : e.message;
      errors.push(`${displayName}: ${detail}`);
      log(`  ! ${displayName}: ${detail}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // sync_runs記録
  if (!dryRun) {
    try {
      db.prepare(`
        INSERT INTO sync_runs (domain_id, run_type, run_status, fetched_count, created_count, updated_count, error_summary, started_at, finished_at)
        VALUES ('kyoninka', 'scheduled', 'completed', ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(certFetched, created, updated, errors.length > 0 ? errors.slice(0, 3).join(" | ") : null);
    } catch {
      /* ignore */
    }
  }

  log(`Done: processed=${processed} resolved=${resolved} certFetched=${certFetched} created=${created} updated=${updated} (${elapsed}s)`);

  return {
    ok: true,
    source,
    processed,
    resolved,
    certFetched,
    created,
    updated,
    errors,
    elapsed,
  };
}

/**
 * ソース別の対象企業取得
 * - actions: administrative_actions（行政処分対象）を起点
 * - sanpai:  sanpai_items（産廃許可取消対象）を起点
 * - all:     両方をUNIONし、企業名で重複除去
 */
function getTargetsBySource({ db, source, onlyMissing, limit }) {
  const actionsQuery = `
    SELECT
      a.organization_name_raw AS name_raw,
      a.prefecture AS prefecture,
      a.industry AS industry,
      o.id AS org_id,
      o.corporate_number AS corporate_number,
      o.display_name AS display_name,
      'actions' AS source_tag,
      COALESCE(a.action_date, a.created_at) AS sort_key
    FROM administrative_actions a
    LEFT JOIN organizations o ON o.id = a.organization_id
    WHERE a.is_published = 1
      ${onlyMissing ? "AND (o.corporate_number IS NULL OR o.corporate_number = '')" : ""}
  `;

  const sanpaiQuery = `
    SELECT
      s.company_name AS name_raw,
      s.prefecture AS prefecture,
      'waste_disposal' AS industry,
      NULL AS org_id,
      s.corporate_number AS corporate_number,
      s.company_name AS display_name,
      'sanpai' AS source_tag,
      COALESCE(s.latest_penalty_date, s.created_at) AS sort_key
    FROM sanpai_items s
    WHERE s.is_published = 1
      ${onlyMissing ? "AND (s.corporate_number IS NULL OR s.corporate_number = '')" : ""}
  `;

  let sql;
  if (source === "sanpai") {
    sql = `${sanpaiQuery} ORDER BY sort_key DESC LIMIT ?`;
  } else if (source === "all") {
    // UNION で両方を対象にし、名前で重複除去
    sql = `
      SELECT * FROM (
        ${actionsQuery}
        UNION ALL
        ${sanpaiQuery}
      ) t
      GROUP BY t.name_raw
      ORDER BY MAX(t.sort_key) DESC
      LIMIT ?
    `;
  } else {
    // default: actions
    sql = `${actionsQuery} ORDER BY sort_key DESC LIMIT ?`;
  }

  return db.prepare(sql).all(limit);
}

/**
 * 企業名として不適切なデータを検出（スクレイパー誤抽出等）。
 * 理由を返し、スキップ対象なら文字列、正常なら null。
 */
function shouldSkipAsCompanyName(name) {
  if (!name || typeof name !== "string") return "empty";
  const s = name.trim();
  if (s.length < 2) return "too-short";
  if (s.length > 100) return "too-long-extreme"; // 100文字超は確実に文章
  // 短くてあいまいな単語も除外（処分理由の見出し語等が誤抽出されたケース）
  const ambiguousShort = new Set([
    "公告", "公示", "事案", "概要", "詳細", "本文", "別紙", "添付", "様式",
    "備考", "頁", "項", "号", "目次", "前項", "後項", "本項", "条文",
  ]);
  if (s.length <= 4 && ambiguousShort.has(s)) return `ambiguous-short(${s})`;
  // 年月日だけのパターン
  if (/^令和\d+年\d+月?$/.test(s) || /^平成\d+年\d+月?$/.test(s)) return "date-only";
  if (/^\d+年\d+月/.test(s)) return "date-only";
  // 明らかに非企業名の典型ワード
  const nonCompanyKeywords = [
    "基準", "処分内容", "商号又は名称", "主たる事務所", "主たる営業所",
    "登録申請書", "誓約書", "身分証明書", "登記されていないことの証明",
    "住民票", "個人番号カード", "合格証書", "登録資格を証する書面",
    "土木事務所", "県土マネジメント部", "建設事務所", "建築課",
    "間の日数", "提出期限", "事業所名", "営業所の所在",
    "〇（", "行政処分一覧", "監督処分簿", "処分年月日", "処分情報",
  ];
  for (const kw of nonCompanyKeywords) {
    if (s.includes(kw)) return `non-company-keyword(${kw})`;
  }
  // 「令和X年Y月Z日から」等の文章っぽい書き出し
  if (/令和\d+年\d+月\d+日/.test(s) && s.length > 30) return "description-text";
  // 株式会社/有限会社/合同会社/合資会社/合名会社/一般財団/公益財団/社団/組合/個人事業主
  // または 企業名らしい語尾（建設/工業/商事/商会/興業/運輸/開発/不動産/設備/電気/住宅/ホーム/宅建/リース/サービス/プランニング 等）
  const looksLikeCompany = /(株式会社|有限会社|合同会社|合資会社|合名会社|一般財団法人|公益財団法人|社団法人|組合|協会|事務所|[(（][株有合]{1}[)）])/.test(s)
    || /(建設|工業|商事|商会|興業|運輸|開発|不動産|設備|電気|住宅|ホーム|宅建|リース|サービス|プランニング|コーポレーション|ホールディングス|グループ|工務店|建築|産業|物産)$/.test(s);
  if (!looksLikeCompany && s.length > 30) return "not-company-like";
  return null;
}

/**
 * 行政処分データの法人名から gBizINFO 向けの検索クエリ候補を生成。
 *   「ゼロホームデザイン（有）」→ ["ゼロホームデザイン", "有限会社ゼロホームデザイン"]
 *   「株式会社XXX（かぶしきがいしゃエックスエックス）」→ ["株式会社XXX"]
 * 順に試行し、最初にヒットしたものを採用。
 */
function buildSearchQueries(rawName) {
  const queries = [];
  let s = String(rawName || "").trim();

  // 長文の場合: 最初に出現する法人格までを切り出して使う
  // （「株式会社川崎工業曽於市株式会社川崎工業の代表取締役は…」等の対策）
  if (s.length > 40) {
    const corpMatch = s.match(/^(.{1,25}?(?:株式会社|有限会社|合同会社|合資会社|合名会社))/);
    if (corpMatch) {
      const trimmed = corpMatch[1];
      // さらに重複法人格を除く: 「株式会社X株式会社」→「株式会社X」
      const cleaned = trimmed.replace(/(株式会社|有限会社|合同会社|合資会社|合名会社).+(株式会社|有限会社|合同会社|合資会社|合名会社)$/, "$1");
      queries.push(cleaned);
    } else {
      queries.push(s.slice(0, 30));
    }
  }

  // 末尾の読み仮名カッコを除去（例: 株式会社XXX（えっくすえっくす））
  const kanaStripped = s.replace(/[（(][^）)]*[）)]$/, "").trim();
  if (kanaStripped && kanaStripped !== s) queries.push(kanaStripped);

  // 末尾の法人格簡略記号を展開（主に宅建業の表記パターン）
  const suffixMap = [
    { pattern: /[（(]有[）)]$/, repl: "有限会社", prefix: true },
    { pattern: /[（(]株[）)]$/, repl: "株式会社", prefix: true },
    { pattern: /[（(]合[）)]$/, repl: "合同会社", prefix: true },
    { pattern: /[（(]資[）)]$/, repl: "合資会社", prefix: true },
    { pattern: /[（(]名[）)]$/, repl: "合名会社", prefix: true },
  ];
  for (const { pattern, repl, prefix } of suffixMap) {
    if (pattern.test(kanaStripped || s)) {
      const stem = (kanaStripped || s).replace(pattern, "").trim();
      if (stem) queries.push(prefix ? `${repl}${stem}` : `${stem}${repl}`);
      // 法人格を単純に除去した形も候補に
      if (stem) queries.push(stem);
      break;
    }
  }

  // 元の名前も候補として残す
  queries.push(s);

  // 重複除去
  return [...new Set(queries.filter(Boolean))];
}

/** gBizINFO 検索結果から最適なものを1つ選ぶ（名前+都道府県で近い順） */
function pickBestMatch(hits, queryName, queryPref) {
  if (!hits || hits.length === 0) return null;
  const queryNorm = normalizeEntityName(queryName);

  // 完全一致を最優先
  const exact = hits.find((h) => normalizeEntityName(h.name) === queryNorm);
  if (exact) return exact;

  // 都道府県一致
  if (queryPref) {
    const sameP = hits.find((h) => (h.prefecture_name || h.location || "").includes(queryPref));
    if (sameP) return sameP;
  }

  // 先頭のヒット（gBizINFOの関連度順）
  return hits[0];
}

function upsertOrganizationCorporateNumber(db, row, corporateNumber, hojinInfo) {
  // 既に同じ corporate_number を持つ organization があるか確認（UNIQUE 制約衝突の事前回避）
  const existing = db.prepare(
    "SELECT id FROM organizations WHERE corporate_number = ? LIMIT 1"
  ).get(corporateNumber);

  if (existing) {
    // 既に登録されている → 何もしない（既に正しく紐付けされている）
    // ただし行政処分の元 row.org_id が異なる場合は administrative_actions の
    // organization_id を既存organization に張り直すことも検討の余地あり。
    // 今回は副作用を避けて何もしない。
    return;
  }

  if (row.org_id) {
    // 既存organizationを更新（このorgはまだcorporate_numberを持っていない）
    db.prepare(`
      UPDATE organizations
      SET corporate_number = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(corporateNumber, row.org_id);
  } else {
    // 新規organization作成
    const normalized = normalizeEntityName(row.name_raw);
    db.prepare(`
      INSERT INTO organizations
        (normalized_name, display_name, corporate_number, prefecture, city, address, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(
      normalized,
      hojinInfo?.name || row.name_raw,
      corporateNumber,
      row.prefecture || null,
      hojinInfo?.location?.city || null,
      hojinInfo?.location?.street_number || hojinInfo?.location || null
    );
  }
}

function upsertKyoninkaForCorporate(db, { corporateNumber, displayName, row, certs }) {
  // kyoninka_entities を upsert
  const slug = `gbiz-${corporateNumber}`;
  const normalizedName = normalizeEntityName(displayName);

  const existing = db.prepare("SELECT id FROM kyoninka_entities WHERE slug = ? OR corporate_number = ?").get(slug, corporateNumber);

  let entityId;
  if (existing) {
    entityId = existing.id;
    db.prepare(`
      UPDATE kyoninka_entities
      SET entity_name = ?, normalized_name = ?, corporate_number = ?,
          prefecture = COALESCE(prefecture, ?),
          registration_count = ?,
          latest_update_date = date('now'),
          source_name = 'gBizINFO',
          source_url = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      displayName.slice(0, 100),
      normalizedName,
      corporateNumber,
      row.prefecture || null,
      certs.length,
      `https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${corporateNumber}`,
      entityId
    );
  } else {
    const primaryFamily = inferPrimaryFamily(certs);
    const info = db.prepare(`
      INSERT INTO kyoninka_entities
        (slug, entity_name, normalized_name, corporate_number, prefecture,
         entity_status, primary_license_family, registration_count,
         latest_update_date, source_name, source_url,
         is_published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, date('now'), 'gBizINFO', ?, 1, datetime('now'), datetime('now'))
    `).run(
      slug,
      displayName.slice(0, 100),
      normalizedName,
      corporateNumber,
      row.prefecture || null,
      primaryFamily,
      certs.length,
      `https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${corporateNumber}`
    );
    entityId = Number(info.lastInsertRowid);
  }

  // 既存 registrations を一旦削除して入れ直す（シンプルな戦略）
  db.prepare("DELETE FROM kyoninka_registrations WHERE entity_id = ?").run(entityId);

  let created = 0;
  const insertStmt = db.prepare(`
    INSERT INTO kyoninka_registrations
      (entity_id, license_family, license_type, registration_number,
       authority_name, prefecture, valid_from, valid_to, registration_status,
       source_name, source_url, detail_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  for (const cert of certs) {
    const n = normalizeCertification(cert, { corporateNumber });
    try {
      insertStmt.run(
        entityId,
        n.license_family,
        n.license_type,
        n.registration_number,
        n.authority_name,
        row.prefecture || null,
        n.valid_from,
        n.valid_to,
        n.registration_status,
        n.source_name,
        n.source_url,
        n.detail_url
      );
      created++;
    } catch {
      /* ignore */
    }
  }

  return { created, updated: existing ? 1 : 0 };
}

function inferPrimaryFamily(certs) {
  const counts = {};
  for (const c of certs) {
    const { license_family } = normalizeCertification(c);
    counts[license_family] = (counts[license_family] || 0) + 1;
  }
  let best = "other";
  let max = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * トークン不要なドライランヘルパー: 対象候補だけをログに出す
 */
export function previewTargets({ limit = 50, onlyMissing = true, source = "actions" } = {}) {
  const db = getDb();
  return getTargetsBySource({ db, source, onlyMissing, limit });
}
