import { getDb } from "@/lib/db";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

export const dynamic = "force-dynamic";

function SortHeader({ label, field, current, center }) {
  const isActive = current === field;
  return (
    <th className={`${center ? "text-center" : "text-left"} py-3 px-3 text-xs font-medium`}>
      <Link
        href={`/admin/events?sort=${field}`}
        className={`hover:text-blue-600 ${isActive ? "text-blue-600 underline" : "text-gray-500"}`}
      >
        {label}
      </Link>
    </th>
  );
}

export default async function AdminEventsPage({ searchParams }) {
  const sp = await searchParams;
  const sortKey = sp?.sort || "created_at";
  const db = getDb();

  const orderClauses = {
    created_at: "e.created_at DESC",
    event_date: "e.event_date ASC",
    entry_end_date: "e.entry_end_date ASC",
    race_count: "race_count ASC",
    title: "e.title ASC",
  };
  const orderBy = orderClauses[sortKey] || orderClauses.created_at;

  // Join race count per event
  const events = db.prepare(`
    SELECT e.id, e.source_event_id, e.title, e.sport_type, e.prefecture, e.event_date,
           e.entry_status, e.entry_end_date, e.venue_name, e.source_site, e.source_url, e.is_active,
           e.description, e.scraped_at, e.created_at,
           COUNT(r.id) as race_count
    FROM events e
    LEFT JOIN event_races r ON r.event_id = e.id
    GROUP BY e.id
    ORDER BY ${orderBy} LIMIT 200
  `).all();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
      COUNT(DISTINCT sport_type) as sports,
      COUNT(DISTINCT prefecture) as prefectures
    FROM events
  `).get();

  const runnetStats = db.prepare(`
    SELECT
      COUNT(*) as count,
      MAX(scraped_at) as latest_scraped_at
    FROM events WHERE source_site = 'runnet' AND scraped_at IS NOT NULL
  `).get();

  const detailStats = db.prepare(`
    SELECT
      SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END) as with_detail,
      COUNT(DISTINCT event_id) as with_races
    FROM events e
    LEFT JOIN (SELECT DISTINCT event_id FROM event_races) r ON r.event_id = e.id
    WHERE e.source_site = 'runnet' AND e.scraped_at IS NOT NULL
  `).get();

  const totalRaces = db.prepare("SELECT COUNT(*) as c FROM event_races").get().c;

  const noRaceCount = db.prepare(
    "SELECT COUNT(*) as c FROM events WHERE id NOT IN (SELECT DISTINCT event_id FROM event_races)"
  ).get().c;

  const moshicomCount = db.prepare(
    "SELECT COUNT(*) as c FROM events WHERE source_url LIKE '%moshicom%'"
  ).get().c;

  const deadlineStats = db.prepare(`
    SELECT
      SUM(CASE WHEN entry_end_date BETWEEN date('now') AND date('now', '+7 days') THEN 1 ELSE 0 END) as d7,
      SUM(CASE WHEN entry_end_date BETWEEN date('now') AND date('now', '+3 days') THEN 1 ELSE 0 END) as d3,
      SUM(CASE WHEN entry_end_date = date('now') THEN 1 ELSE 0 END) as d0
    FROM events WHERE is_active = 1
  `).get();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">データ管理</h1>
      <p className="text-sm text-gray-500 mb-4">
        リスクデータの管理・確認
      </p>
      <AdminNav />

      {/* 統計 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-13 gap-3 mb-8">
        {[
          { label: "総数", value: stats.total },
          { label: "有効", value: stats.active },
          { label: "都道府県", value: stats.prefectures },
          { label: "RUNNET件数", value: runnetStats.count },
          { label: "moshicom系", value: moshicomCount },
          { label: "詳細取得済", value: `${detailStats.with_detail}/${runnetStats.count}` },
          { label: "race登録済", value: detailStats.with_races },
          { label: "race未登録", value: noRaceCount, warn: noRaceCount > 0 },
          { label: "総race数", value: totalRaces },
          { label: "締切7日以内", value: deadlineStats.d7 || 0, warn: deadlineStats.d7 > 0 },
          { label: "締切3日以内", value: deadlineStats.d3 || 0, warn: deadlineStats.d3 > 0 },
          { label: "当日締切", value: deadlineStats.d0 || 0, warn: deadlineStats.d0 > 0 },
          { label: "最新取得", value: runnetStats.latest_scraped_at ? new Date(runnetStats.latest_scraped_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-" },
        ].map((s) => (
          <div key={s.label} className={`card p-3 text-center ${s.warn ? "border-orange-200 bg-orange-50" : ""}`}>
            <p className={`text-xl font-bold ${s.warn ? "text-orange-600" : "text-gray-900"}`}>{typeof s.value === "number" ? s.value : <span className="text-xs">{s.value}</span>}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* テーブル */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500">ID</th>
                <SortHeader label="タイトル" field="title" current={sortKey} />
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500">都道府県</th>
                <SortHeader label="開催日" field="event_date" current={sortKey} />
                <SortHeader label="締切" field="entry_end_date" current={sortKey} />
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500">会場</th>
                <SortHeader label="race数" field="race_count" current={sortKey} center />
                <th className="text-center py-3 px-3 text-xs font-medium text-gray-500">詳細</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500">ソース</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-gray-500">event_id</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const isMoshicom = e.source_url?.includes("moshicom");
                return (
                <tr key={e.id} className={`border-t border-gray-100 hover:bg-gray-50 ${e.race_count === 0 ? "bg-orange-50/50" : ""}`}>
                  <td className="py-2 px-3 text-gray-400">{e.id}</td>
                  <td className="py-2 px-3">
                    <Link href={`/marathon/${e.id}`} className="text-blue-600 hover:underline font-medium">
                      {e.title}
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{e.prefecture || "-"}</td>
                  <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{e.event_date || "-"}</td>
                  <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{e.entry_end_date || "-"}</td>
                  <td className="py-2 px-3 text-gray-600 text-xs">{e.venue_name ? e.venue_name.substring(0, 15) : "-"}</td>
                  <td className="py-2 px-3 text-center">
                    {e.race_count > 0 ? (
                      <span className="text-green-600 font-medium">{e.race_count}</span>
                    ) : (
                      <span className="text-orange-400">0</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {e.description ? (
                      <span className="text-green-500" title="詳細取得済">●</span>
                    ) : (
                      <span className="text-gray-300" title="未取得">○</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-gray-400 text-xs whitespace-nowrap">
                    {e.source_site}
                    {isMoshicom && <span className="ml-1 text-purple-500 font-medium" title="moshicom系">M</span>}
                  </td>
                  <td className="py-2 px-3 text-gray-400 text-xs">{e.source_event_id || "-"}</td>
                </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-400">
                    データがありません。seedを実行してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
