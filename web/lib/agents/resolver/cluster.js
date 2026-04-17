/**
 * Resolver Step 3.5 — クラスタリング
 *
 * 企業 entity を「グループ・類似企業」単位に束ねる cluster_id を付与する。
 * 目的: トヨタグループ（トヨタ自動車 / トヨタ自動車東日本 等）や
 *       地元ファミリー企業群（A工業 / A建設 / A運輸）を
 *       ダッシュボードで集約表示できるようにすること。
 *
 * entity 判定（Step 3）とは独立:
 *   entity_id   = 同一法人
 *   cluster_id  = 同一グループ or 類似企業群（entity_id の上位概念）
 *
 * 判定シグナル（OR 条件で union-find）:
 *   (a) normalized_key が prefixLen 文字以上共通
 *   (b) normalized_key の Levenshtein 類似度が simThreshold 以上
 *   （c）LLM 判定 — 曖昧ケースのみ。本実装は stub）
 */
import { similarity } from "./normalize.js";

export const DEFAULT_PREFIX_LEN = 4;     // 4 文字以上共通 → 候補
export const DEFAULT_SIM_THRESHOLD = 0.7; // 類似度 0.7 以上 → 候補
export const MIN_KEY_LEN_FOR_CLUSTER = 2; // 短すぎるキーは除外

/**
 * 全 entity をクラスタ化し、cluster_id を割当て、entity_clusters 行を作成/更新。
 * 同一プロセスで繰り返し呼んでも冪等。
 *
 * @param {object} opts
 * @param {object} opts.db              better-sqlite3 or turso compat layer
 * @param {number} [opts.prefixLen]     4 文字以上共通で cluster 候補
 * @param {number} [opts.simThreshold]  類似度 0.7 以上で cluster 候補
 * @param {Function}[opts.logger]
 * @returns {{ entities: number, clusters: number, singletons: number, largestCluster: number, assigned: number }}
 */
export function assignClusters({
  db,
  prefixLen = DEFAULT_PREFIX_LEN,
  simThreshold = DEFAULT_SIM_THRESHOLD,
  logger = console.log,
} = {}) {
  if (!db) throw new TypeError("assignClusters: db is required");
  const log = (msg) => logger(`[cluster] ${msg}`);

  const entities = db.prepare("SELECT id, canonical_name, normalized_key, cluster_id FROM resolved_entities").all();
  log(`対象 entity: ${entities.length}件`);

  // Union-Find
  const parent = new Map(); // id -> id
  const ensure = (id) => { if (!parent.has(id)) parent.set(id, id); };
  const find = (id) => {
    let x = id;
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x))); // path compression
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const e of entities) ensure(e.id);

  // normalized_key の先頭 2 文字でバケット化して枝刈り
  const buckets = new Map();
  for (const e of entities) {
    if (!e.normalized_key || e.normalized_key.length < MIN_KEY_LEN_FOR_CLUSTER) continue;
    const b = e.normalized_key.slice(0, 2);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(e);
  }
  log(`バケット数: ${buckets.size}`);

  let pairsChecked = 0;
  let pairsUnioned = 0;

  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      const a = bucket[i];
      for (let j = i + 1; j < bucket.length; j++) {
        const b = bucket[j];
        pairsChecked++;
        const shared = commonPrefixLen(a.normalized_key, b.normalized_key);
        if (shared >= prefixLen) {
          union(a.id, b.id);
          pairsUnioned++;
          continue;
        }
        // 類似度（共通 prefix が短くても、誤字・短縮で似ている可能性）
        // 片側が短すぎる場合は誤判定の原因になるので最低3文字
        if (a.normalized_key.length >= 3 && b.normalized_key.length >= 3) {
          const sim = similarity(a.normalized_key, b.normalized_key);
          if (sim >= simThreshold) {
            union(a.id, b.id);
            pairsUnioned++;
          }
        }
      }
    }
  }
  log(`比較: ${pairsChecked}ペア、結合: ${pairsUnioned}ペア`);

  // Union-Find の root ごとにグループ化
  const groups = new Map(); // root -> [entityId,...]
  for (const e of entities) {
    const root = find(e.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(e);
  }

  // 単独メンバーはクラスタリング対象外（cluster_id = null のまま）
  // 2 件以上のグループのみ cluster を作成/更新
  const multiGroups = [...groups.values()].filter((g) => g.length >= 2);
  const singletons = entities.length - multiGroups.reduce((s, g) => s + g.length, 0);

  const upsertCluster = db.prepare(`
    INSERT INTO entity_clusters (canonical_name, representative_entity_id, signal, size, created_at, updated_at)
    VALUES (@canonical_name, @rep_id, @signal, @size, datetime('now'), datetime('now'))
  `);
  const updateCluster = db.prepare(`
    UPDATE entity_clusters SET canonical_name = @canonical_name, representative_entity_id = @rep_id, signal = @signal, size = @size, updated_at = datetime('now') WHERE id = ?
  `);
  const updateEntityCluster = db.prepare(`UPDATE resolved_entities SET cluster_id = ? WHERE id = ?`);

  // 既存の cluster を全部クリア（冪等性: 再実行で同じ結果を保証）
  db.prepare("UPDATE resolved_entities SET cluster_id = NULL").run();
  db.prepare("DELETE FROM entity_clusters").run();

  let assigned = 0;
  let largestCluster = 0;

  for (const group of multiGroups) {
    // representative = 最短 canonical_name を持つもの（グループ名の短い共通部分を代表とする狙い）
    group.sort((a, b) => (a.canonical_name || "").length - (b.canonical_name || "").length);
    const rep = group[0];
    const clusterCanonical = rep.canonical_name || rep.normalized_key;

    // signal 判定: グループ内で prefix 主体か similarity 主体か
    const signal = detectSignal(group, prefixLen, simThreshold);

    const r = upsertCluster.run({
      canonical_name: clusterCanonical,
      rep_id: rep.id,
      signal,
      size: group.length,
    });
    const clusterId = Number(r.lastInsertRowid);
    for (const e of group) {
      updateEntityCluster.run(clusterId, e.id);
      assigned++;
    }
    if (group.length > largestCluster) largestCluster = group.length;
  }

  log(`クラスタ: ${multiGroups.length}（singleton ${singletons} は cluster_id=null）`);
  log(`最大クラスタサイズ: ${largestCluster}件`);
  log(`cluster_id 割当: ${assigned}件`);

  return {
    entities: entities.length,
    clusters: multiGroups.length,
    singletons,
    largestCluster,
    assigned,
  };
}

/** 共通 prefix の文字数 */
function commonPrefixLen(a, b) {
  if (!a || !b) return 0;
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

/**
 * グループ内のシグナル種別を判定（何によって結合されたか）。
 * 簡易版: 任意2者の prefix シェアが全ペアで prefixLen 以上なら "prefix"
 *         それ以外は "similarity"
 */
function detectSignal(group, prefixLen /* , simThreshold */) {
  for (let i = 0; i < group.length - 1; i++) {
    const shared = commonPrefixLen(group[i].normalized_key, group[i + 1].normalized_key);
    if (shared < prefixLen) return "similarity";
  }
  return "prefix";
}
