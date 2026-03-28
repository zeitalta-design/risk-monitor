import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/admin-api-guard";
import {
  isMoshicomUrl,
  fetchAndParseMoshicom,
} from "@/lib/moshicom-fetcher";
import {
  isRunnetUrl,
  fetchAndParseRunnet,
} from "@/lib/runnet-fetcher";
import {
  isSportsentryUrl,
  fetchAndParseSportsentry,
} from "@/lib/sportsentry-fetcher";
import { inferPrefecture, isOnlineEvent } from "@/lib/prefecture-inference";
import { inferRaces, isOnlineRace } from "@/lib/race-inference";

/**
 * 失敗理由コード → 日本語メッセージ
 */
const FAILURE_MESSAGES = {
  NO_SOURCE_URL: "元URLが登録されていないため再取得できません",
  FETCH_FAILED: "ソースページのHTML取得に失敗しました",
  UNSUPPORTED_SOURCE: "対応していないURLのため再取得できません",
  PARSE_EMPTY: "ページから必要な情報を抽出できませんでした",
  NO_MISSING_FIELDS_FILLED: "取得はできましたが、欠損項目は埋まりませんでした",
  DB_UPDATE_FAILED: "データベース更新に失敗しました",
  RACES_NOT_FOUND: "種目情報を取得できませんでした",
  UNKNOWN_ERROR: "不明なエラーが発生しました",
};

/**
 * 再取得対象フィールド定義
 */
const FILL_FIELDS = [
  { dbCol: "event_date", parseKey: "event_date", label: "開催日" },
  { dbCol: "event_month", parseKey: "event_month", label: "開催月" },
  { dbCol: "prefecture", parseKey: "prefecture", label: "都道府県" },
  { dbCol: "city", parseKey: "city", label: "市区町村" },
  { dbCol: "venue_name", parseKey: "venue_name", label: "会場" },
  { dbCol: "official_url", parseKey: "official_url", label: "公式URL" },
  { dbCol: "description", parseKey: "description", label: "説明" },
  { dbCol: "hero_image_url", parseKey: "hero_image_url", label: "画像URL" },
  { dbCol: "entry_start_date", parseKey: "entry_start_date", label: "申込開始日" },
  { dbCol: "entry_end_date", parseKey: "entry_end_date", label: "申込終了日" },
  { dbCol: "entry_status", parseKey: "entry_status", label: "受付状況" },
];

/**
 * POST /api/admin/ops/patrol/refetch
 *
 * 巡回パトロールからの再取得API（改善版）
 * - 単体再取得: event_ids = [id]
 * - 一括再取得: event_ids = [id1, id2, ...]
 * - failure_reason / remaining_missing / ステータス分類を返す
 */
export async function POST(request) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  try {
    const body = await request.json();
    const { event_ids, mode = "fill_missing" } = body;

    if (!event_ids || !Array.isArray(event_ids) || event_ids.length === 0) {
      return NextResponse.json(
        { error: "event_ids（配列）は必須です" },
        { status: 400 }
      );
    }

    if (event_ids.length > 100) {
      return NextResponse.json(
        { error: "一度に再取得できるのは100件までです" },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    // ログ挿入用prepared statement
    const insertLog = db.prepare(`
      INSERT INTO patrol_refetch_logs (
        event_id, source_url, source_site, status, failure_reason,
        failure_detail, updated_fields, remaining_missing, races_added,
        duration_ms, created_at
      ) VALUES (
        @event_id, @source_url, @source_site, @status, @failure_reason,
        @failure_detail, @updated_fields, @remaining_missing, @races_added,
        @duration_ms, @created_at
      )
    `);

    // 対象イベントを取得
    const placeholders = event_ids.map(() => "?").join(",");
    const events = db
      .prepare(
        `SELECT id, title, source_url, source_site, event_date, prefecture,
                city, venue_name, official_url, description, hero_image_url,
                entry_start_date, entry_end_date, entry_status, patrol_status
         FROM events WHERE id IN (${placeholders})`
      )
      .all(...event_ids);

    const results = [];

    for (const ev of events) {
      const startTime = Date.now();
      const result = {
        event_id: ev.id,
        title: ev.title,
        source_url: ev.source_url || null,
        source_site: ev.source_site || null,
        status: "FAILED",
        failure_reason: null,
        failure_message: null,
        failure_detail: null,
        changes: [],
        remaining_missing: [],
        races_added: 0,
      };

      // patrol_status が refetch_excluded なら除外
      if (ev.patrol_status === "refetch_excluded") {
        result.status = "FAILED";
        result.failure_reason = "REFETCH_EXCLUDED";
        result.failure_message = "再取得対象外に設定されています";
        logResult(insertLog, ev, result, startTime, now);
        results.push(result);
        continue;
      }

      // source_urlチェック
      if (!ev.source_url) {
        result.failure_reason = "NO_SOURCE_URL";
        result.failure_message = FAILURE_MESSAGES.NO_SOURCE_URL;
        logResult(insertLog, ev, result, startTime, now);
        results.push(result);
        continue;
      }

      try {
        // ソース判定 + フェッチ
        let parsed;
        const url = ev.source_url;
        let detectedSite = null;

        if (isMoshicomUrl(url)) {
          detectedSite = "moshicom";
          console.log(`[Patrol Refetch] event_id=${ev.id} fetching from MOSHICOM: ${url}`);
          parsed = await fetchAndParseMoshicom(url);
        } else if (isRunnetUrl(url)) {
          detectedSite = "runnet";
          console.log(`[Patrol Refetch] event_id=${ev.id} fetching from RUNNET: ${url}`);
          parsed = await fetchAndParseRunnet(url);
        } else if (isSportsentryUrl(url)) {
          detectedSite = "sportsentry";
          console.log(`[Patrol Refetch] event_id=${ev.id} fetching from SPORTSENTRY: ${url}`);
          parsed = await fetchAndParseSportsentry(url);
        } else {
          result.failure_reason = "UNSUPPORTED_SOURCE";
          result.failure_message = FAILURE_MESSAGES.UNSUPPORTED_SOURCE;
          result.failure_detail = `URL: ${url}`;
          logResult(insertLog, ev, result, startTime, now);
          results.push(result);
          continue;
        }

        result.source_site = detectedSite;

        // パース結果チェック
        if (!parsed || !parsed.eventInfo) {
          result.failure_reason = "PARSE_EMPTY";
          result.failure_message = FAILURE_MESSAGES.PARSE_EMPTY;
          result.failure_detail = "パーサーがeventInfoを返しませんでした";
          logResult(insertLog, ev, result, startTime, now);
          results.push(result);
          continue;
        }

        const { eventInfo, races } = parsed;

        // フォールバック: オンライン大会の自動判定
        if (!eventInfo.prefecture) {
          const titleForCheck = eventInfo.title || ev.title || "";
          const descForCheck = eventInfo.description || ev.description || "";
          if (isOnlineEvent(titleForCheck, descForCheck)) {
            // オンライン大会 → prefecture を埋めず、patrol_status を manual_resolved にマーク
            db.prepare("UPDATE events SET patrol_status = 'manual_resolved', patrol_note = 'オンライン大会のため都道府県なし', updated_at = ? WHERE id = ?")
              .run(now, ev.id);
            result.status = "NO_CHANGE";
            result.failure_reason = "ONLINE_EVENT";
            result.failure_message = "オンライン大会のため都道府県は不要です";
            logResult(insertLog, ev, result, startTime, now);
            results.push(result);
            continue;
          }
        }

        // フォールバック: スクレイパーが都道府県を返せなかった場合、テキストから推定
        if (!eventInfo.prefecture) {
          const inferred = inferPrefecture(
            eventInfo.venue_name || ev.venue_name,
            eventInfo.city || ev.city,
            ev.title,
            eventInfo.description || ev.description
          );
          if (inferred.prefecture) {
            eventInfo.prefecture = inferred.prefecture;
            console.log(`[Patrol Refetch] event_id=${ev.id} prefecture inferred: ${inferred.prefecture} (${inferred.source}, ${inferred.confidence})`);
          }
        }

        if (!eventInfo.title && !eventInfo.event_date && !eventInfo.prefecture) {
          result.failure_reason = "PARSE_EMPTY";
          result.failure_message = FAILURE_MESSAGES.PARSE_EMPTY;
          result.failure_detail = "パーサーが主要フィールドを抽出できませんでした";
          logResult(insertLog, ev, result, startTime, now);
          results.push(result);
          continue;
        }

        console.log(`[Patrol Refetch] event_id=${ev.id} parsed fields:`,
          Object.entries(eventInfo).filter(([,v]) => v).map(([k]) => k).join(", "));

        // 現在のDB値を取得
        const current = db
          .prepare(
            `SELECT event_date, event_month, prefecture, city, venue_name,
                    official_url, description, hero_image_url,
                    entry_start_date, entry_end_date, entry_status
             FROM events WHERE id = ?`
          )
          .get(ev.id);

        // フィールド更新判定
        const updates = {};
        const skippedFields = []; // パーサーが返さなかった欠損フィールド

        for (const field of FILL_FIELDS) {
          const currentVal = current[field.dbCol];
          const newVal = eventInfo[field.parseKey];
          const isEmpty = !currentVal || currentVal === "" || currentVal === "unknown";

          if (mode === "fill_missing") {
            if (isEmpty && newVal && newVal !== "" && newVal !== "unknown") {
              updates[field.dbCol] = newVal;
              result.changes.push({
                field: field.label,
                dbCol: field.dbCol,
                from: currentVal || "未設定",
                to: newVal,
              });
            } else if (isEmpty && (!newVal || newVal === "" || newVal === "unknown")) {
              // 欠損のまま＆パーサーも値なし
              skippedFields.push(field.label);
            }
          } else if (mode === "force") {
            if (newVal && newVal !== "" && newVal !== currentVal) {
              updates[field.dbCol] = newVal;
              result.changes.push({
                field: field.label,
                dbCol: field.dbCol,
                from: currentVal || "未設定",
                to: newVal,
              });
            }
          }
        }

        // 種目（event_races）の補完
        const hasRaces = db
          .prepare("SELECT COUNT(*) as c FROM event_races WHERE event_id = ?")
          .get(ev.id).c;

        // フォールバック: スクレイパーが races を返さなかった場合、タイトル/説明文から推定
        let effectiveRaces = races && races.length > 0 ? races : [];
        if (hasRaces === 0 && effectiveRaces.length === 0) {
          const titleForRace = eventInfo.title || ev.title || "";
          const descForRace = eventInfo.description || ev.description || "";

          // オンライン大会は種目推定をスキップ
          if (isOnlineRace(titleForRace, descForRace)) {
            // オンラインだが races がないのは正常 → 手動対応不要としてマーク
            if (!updates.prefecture) {
              // 既にオンライン判定で解決済みでなければスキップフィールドに追加
              skippedFields.push("種目（オンライン大会）");
            }
          } else {
            const inferred = inferRaces(titleForRace, descForRace);
            if (inferred.length > 0) {
              effectiveRaces = inferred;
              console.log(`[Patrol Refetch] event_id=${ev.id} races inferred from title: ${inferred.map(r => r.race_name).join(", ")}`);
            }
          }
        }

        let racesInserted = 0;
        if (hasRaces === 0 && effectiveRaces.length > 0) {
          const insertRace = db.prepare(`
            INSERT INTO event_races (
              event_id, race_name, race_type, distance_km,
              fee_min, fee_max, capacity, time_limit, start_time,
              eligibility, category, note, sort_order, created_at, updated_at
            ) VALUES (
              @event_id, @race_name, @race_type, @distance_km,
              @fee_min, @fee_max, @capacity, @time_limit, @start_time,
              @eligibility, @category, @note, @sort_order, @now, @now
            )
          `);

          for (const race of effectiveRaces) {
            try {
              insertRace.run({
                event_id: ev.id,
                race_name: race.race_name || "不明",
                race_type: race.race_type || null,
                distance_km: race.distance_km || null,
                fee_min: race.fee_min || null,
                fee_max: race.fee_max || null,
                capacity: race.capacity || null,
                time_limit: race.time_limit || null,
                start_time: race.start_time || null,
                eligibility: race.eligibility || null,
                category: race.category || null,
                note: race.note || null,
                sort_order: race.sort_order || 0,
                now,
              });
              racesInserted++;
            } catch (raceErr) {
              console.error(`[Patrol Refetch] event_id=${ev.id} race insert error:`, raceErr.message);
            }
          }

          if (racesInserted > 0) {
            result.changes.push({
              field: "種目",
              dbCol: "event_races",
              from: "未設定",
              to: `${racesInserted}件追加`,
            });
          }
        } else if (hasRaces === 0 && (!races || races.length === 0)) {
          skippedFields.push("種目");
        }

        result.races_added = racesInserted;
        result.remaining_missing = skippedFields;

        // DB更新実行
        try {
          if (Object.keys(updates).length > 0) {
            const setClauses = Object.keys(updates)
              .map((col) => `${col} = @${col}`)
              .concat("updated_at = @updated_at", "scraped_at = @scraped_at")
              .join(", ");

            db.prepare(`UPDATE events SET ${setClauses} WHERE id = @id`).run({
              ...updates,
              updated_at: now,
              scraped_at: now,
              id: ev.id,
            });
          } else {
            // 更新なしでもscraped_atは更新
            db.prepare(
              "UPDATE events SET scraped_at = ? WHERE id = ?"
            ).run(now, ev.id);
          }

          // 種目のみ追加した場合もupdated_atを更新
          if (racesInserted > 0 && Object.keys(updates).length === 0) {
            db.prepare(
              "UPDATE events SET updated_at = ?, scraped_at = ? WHERE id = ?"
            ).run(now, now, ev.id);
          }
        } catch (dbErr) {
          console.error(`[Patrol Refetch] event_id=${ev.id} DB update error:`, dbErr.message);
          result.failure_reason = "DB_UPDATE_FAILED";
          result.failure_message = FAILURE_MESSAGES.DB_UPDATE_FAILED;
          result.failure_detail = dbErr.message;
          logResult(insertLog, ev, result, startTime, now);
          results.push(result);
          continue;
        }

        // ステータス分類
        const hasUpdates = result.changes.length > 0;
        const hasRemaining = skippedFields.length > 0;

        if (hasUpdates && !hasRemaining) {
          result.status = "UPDATED";
        } else if (hasUpdates && hasRemaining) {
          result.status = "PARTIAL";
        } else if (!hasUpdates && hasRemaining) {
          // パーサーはOKだが欠損項目を埋められなかった
          result.status = "MANUAL_REQUIRED";
          result.failure_reason = "NO_MISSING_FIELDS_FILLED";
          result.failure_message = "ソースページにも情報が見つからないため、手動対応が必要です";
        } else {
          // 全フィールドが既に埋まっている
          result.status = "NO_CHANGE";
          result.failure_reason = "NO_MISSING_FIELDS_FILLED";
          result.failure_message = "すべての項目が既に登録済みです";
        }

        console.log(`[Patrol Refetch] event_id=${ev.id} status=${result.status} changes=${result.changes.length} remaining=${skippedFields.join(",")}`);

      } catch (err) {
        console.error(`[Patrol Refetch] event_id=${ev.id} error:`, err);

        // エラー種別の判定
        const errMsg = err.message || "";
        if (errMsg.includes("fetch") || errMsg.includes("timeout") || errMsg.includes("ECONNREFUSED") || errMsg.includes("404") || errMsg.includes("403")) {
          result.failure_reason = "FETCH_FAILED";
          result.failure_message = FAILURE_MESSAGES.FETCH_FAILED;
          result.failure_detail = errMsg;
        } else {
          result.failure_reason = "UNKNOWN_ERROR";
          result.failure_message = FAILURE_MESSAGES.UNKNOWN_ERROR;
          result.failure_detail = errMsg;
        }
      }

      logResult(insertLog, ev, result, startTime, now);
      results.push(result);

      // 連続リクエスト防止
      if (events.length > 1) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    // 要求されたが見つからなかったIDを報告
    const foundIds = new Set(events.map((e) => e.id));
    for (const id of event_ids) {
      if (!foundIds.has(id)) {
        results.push({
          event_id: id,
          title: null,
          status: "FAILED",
          failure_reason: "UNKNOWN_ERROR",
          failure_message: "大会が見つかりませんでした",
          changes: [],
          remaining_missing: [],
        });
      }
    }

    // サマリー集計
    const summary = {
      total: results.length,
      updated: results.filter((r) => r.status === "UPDATED").length,
      partial: results.filter((r) => r.status === "PARTIAL").length,
      no_change: results.filter((r) => r.status === "NO_CHANGE").length,
      manual_required: results.filter((r) => r.status === "MANUAL_REQUIRED").length,
      failed: results.filter((r) => r.status === "FAILED").length,
    };

    console.log(`[Patrol Refetch] Complete: total=${summary.total} updated=${summary.updated} partial=${summary.partial} no_change=${summary.no_change} manual=${summary.manual_required} failed=${summary.failed}`);

    return NextResponse.json({ summary, results });
  } catch (err) {
    console.error("[Patrol Refetch] Fatal error:", err);
    return NextResponse.json(
      { error: "再取得処理でエラーが発生しました", detail: err.message },
      { status: 500 }
    );
  }
}

/**
 * 再取得結果をログテーブルに記録
 */
function logResult(insertLog, ev, result, startTime, now) {
  try {
    insertLog.run({
      event_id: ev.id,
      source_url: ev.source_url || null,
      source_site: result.source_site || ev.source_site || null,
      status: result.status,
      failure_reason: result.failure_reason || null,
      failure_detail: result.failure_detail || null,
      updated_fields: result.changes.length > 0
        ? result.changes.map((c) => c.field).join(", ")
        : null,
      remaining_missing: result.remaining_missing.length > 0
        ? result.remaining_missing.join(", ")
        : null,
      races_added: result.races_added || 0,
      duration_ms: Date.now() - startTime,
      created_at: now,
    });
  } catch (logErr) {
    console.error(`[Patrol Refetch] Log insert error for event_id=${ev.id}:`, logErr.message);
  }
}
