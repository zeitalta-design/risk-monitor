export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { getArticleBySlug, getAllArticleSlugs, CURATED_ARTICLES } from "@/lib/curated-articles";
import { getDb } from "@/lib/db";
import { getEventDisplayStatus } from "@/lib/entry-status";
import Breadcrumbs from "@/components/Breadcrumbs";

/**
 * Phase204: 大会まとめ記事ページ
 *
 * SEO向けランキング型コンテンツ。
 * /articles/[slug]
 */

export function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  return {
    title: `${article.title} | ${siteConfig.siteName}`,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
      url: `${siteConfig.baseUrl}/articles/${slug}`,
    },
    alternates: {
      canonical: `${siteConfig.baseUrl}/articles/${slug}`,
    },
  };
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  // ランキングデータ取得
  const events = getArticleEvents(article.query);

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    url: `${siteConfig.baseUrl}/articles/${slug}`,
    publisher: {
      "@type": "Organization",
      name: siteConfig.siteName,
    },
    dateModified: new Date().toISOString().split("T")[0],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Breadcrumbs items={[
          { label: "ホーム", href: "/" },
          { label: "まとめ記事", href: "/articles" },
          { label: article.title },
        ]} />

        {/* ヘッダー */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
          {article.title}
        </h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {article.intro}
        </p>

        {/* タグ */}
        <div className="flex flex-wrap gap-2 mb-6">
          {article.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        {/* ランキングリスト */}
        <div className="space-y-4">
          {events.map((event, idx) => (
            <div key={event.id} className="card p-4 flex gap-4">
              <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/marathon/${event.id}`}
                  className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors"
                >
                  {event.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {event.prefecture && (
                    <span className="text-xs text-gray-500">{event.prefecture}</span>
                  )}
                  {event.event_date && (
                    <span className="text-xs text-gray-400">{event.event_date}</span>
                  )}
                  {event.entry_status === "open" && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-green-50 text-green-600 rounded">
                      エントリー受付中
                    </span>
                  )}
                </div>
                {event.description && (
                  <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {event.description.slice(0, 120)}
                  </p>
                )}
                {/* 追加メトリクス */}
                <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-400">
                  {event.avg_rating && (
                    <span>★ {Number(event.avg_rating).toFixed(1)}({event.review_count}件)</span>
                  )}
                  {event.photo_count > 0 && (
                    <span>📸 {event.photo_count}枚</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {events.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">
            現在該当する大会がありません。
          </p>
        )}

        {/* 関連記事 */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 mb-3">関連するまとめ記事</h2>
          <div className="space-y-2">
            {CURATED_ARTICLES.filter((a) => a.slug !== slug).slice(0, 3).map((a) => (
              <Link
                key={a.slug}
                href={`/articles/${a.slug}`}
                className="block text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                {a.title} →
              </Link>
            ))}
          </div>
        </div>

        {/* 下部導線 */}
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/rankings" className="text-blue-600 hover:text-blue-800">
            ランキング一覧
          </Link>
          <Link href="/marathon" className="text-blue-600 hover:text-blue-800">
            大会を探す
          </Link>
        </div>
      </div>
    </>
  );
}

function getArticleEvents({ type, sportType, limit = 10 }) {
  try {
    const db = getDb();
    const sportFilter = sportType ? "AND e.sport_type = ?" : "";
    const sportParam = sportType ? [sportType] : [];

    // 簡易クエリ — ランキングAPIと同じロジック
    let sql;
    switch (type) {
      case "review_top":
        sql = `
          SELECT e.id, e.title, e.event_date, e.prefecture, e.entry_status, e.description, e.sport_type,
                 AVG(COALESCE(r.rating_overall, r.rating)) as avg_rating, COUNT(r.id) as review_count
          FROM events e
          INNER JOIN event_reviews r ON r.event_id = e.id AND (r.status = 'published' OR r.status IS NULL)
          WHERE e.is_active = 1 AND e.event_date >= date('now') ${sportFilter}
          GROUP BY e.id HAVING review_count >= 2
          ORDER BY avg_rating DESC, review_count DESC LIMIT ?`;
        break;
      case "photo_rich":
        sql = `
          SELECT e.id, e.title, e.event_date, e.prefecture, e.entry_status, e.description, e.sport_type,
                 COUNT(p.id) as photo_count
          FROM events e
          INNER JOIN event_photos p ON p.event_id = e.id AND (p.status = 'published' OR p.status IS NULL)
          WHERE e.is_active = 1 AND e.event_date >= date('now') ${sportFilter}
          GROUP BY e.id HAVING photo_count >= 1
          ORDER BY photo_count DESC LIMIT ?`;
        break;
      default:
        sql = `
          SELECT e.id, e.title, e.event_date, e.prefecture, e.entry_status, e.description, e.sport_type,
                 e.popularity_score
          FROM events e
          WHERE e.is_active = 1 AND e.event_date >= date('now') ${sportFilter}
          ORDER BY e.popularity_score DESC LIMIT ?`;
        break;
    }

    const events = db.prepare(sql).all(...sportParam, limit);
    return events.map((e) => {
      const ds = getEventDisplayStatus(e);
      return { ...e, entry_status: ds.status };
    });
  } catch {
    return [];
  }
}
