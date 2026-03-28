import { notFound } from "next/navigation";
import Link from "next/link";
import { getSportBySlug } from "@/lib/sport-config";
import { siteConfig } from "@/lib/site-config";
import { PREFECTURE_NAME_TO_SLUG } from "@/lib/seo-mappings";
import { getMarathonDetailPageData } from "@/lib/marathon-detail-service";
import { extractTrailTags } from "@/lib/trail-tags";
import {
  buildEventQuickFacts,
  buildEventComparisonSummary,
} from "@/lib/event-detail-highlights";
import {
  getRelatedEvents,
  getAlternativeEvents,
  buildSearchLinksFromEvent,
} from "@/lib/event-related";
import {
  buildDecisionSignals,
  buildDecisionSummary,
} from "@/lib/event-decision-signals";
import Breadcrumbs from "@/components/Breadcrumbs";
import ExternalLinkCard from "@/components/ExternalLinkCard";
import {
  MarathonDetailHero,
  MarathonDetailOverview,
  MarathonDetailServices,
  MarathonDetailPricing,
  MarathonDetailSchedule,
  MarathonDetailTimeLimits,
  MarathonDetailFaq,
  MarathonDetailOrganizer,
  MarathonDetailUrgency,
  MarathonDetailPopularity,
  MarathonViewTracker,
} from "@/components/marathon-detail";
import { ConflictDetailBanner } from "@/components/VerificationConflictBadge";
import OrganizerUpdateLink from "@/components/event-detail/OrganizerUpdateLink";
import OrganizerVerifiedBadge from "@/components/OrganizerVerifiedBadge";
import {
  EventCommentsSection,
  EventTermsSection,
  EventCourseSection,
  EventDayGuideSection,
  EventQuickFactsCard,
  EventComparisonCard,
  RelatedEventsSection,
  AlternativeEventsSection,
  EventSearchLinksSection,
  EventCompareActions,
  EventSaveActions,
  EventDecisionSignalsCard,
  ReviewInsightsCard,
  EventResultsLink,
  EventPhotoGallery,
  ReviewContextPhotos,
  PostEventCTA,
  CommunityVoicesSection,
  EventEngagementBar,
  CommunityNavLinks,
} from "@/components/event-detail";
import SnsShareButtons from "@/components/SnsShareButtons";

/**
 * Phase49→Phase55: 汎用スポーツ詳細ページ（大幅情報強化）
 *
 * /[sportSlug]/[id] にマッチ。
 * /marathon/[id] は既存ルートが優先されるため、ここに来るのは他スポーツのみ。
 *
 * Phase55: getMarathonDetailPageData() を利用し、marathon_details テーブルの
 * 全フィールドを活用した情報量の多い詳細ページへ進化。
 */

// --- Helpers ---

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function buildEventJsonLd(data, sport) {
  const baseUrl = siteConfig.siteUrl;

  // location/startDate が不足する場合は Event schema を出さない
  const placeName = data.venue_name || [data.prefecture, data.city].filter(Boolean).join("");
  if (!placeName && !data.prefecture) return null;
  if (!data.event_date) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: data.title,
    url: `${baseUrl}/${sport.slug}/${data.id}`,
    startDate: data.event_date,
  };

  const desc = data.summary || data.description;
  if (desc) jsonLd.description = desc.slice(0, 300);

  // location（必須）
  const address = { "@type": "PostalAddress", addressCountry: "JP" };
  if (data.prefecture) address.addressRegion = data.prefecture;
  if (data.city) address.addressLocality = data.city;
  if (data.venue_address) address.streetAddress = data.venue_address;
  jsonLd.location = { "@type": "Place", name: placeName || data.prefecture || "会場未定", address };

  // eventStatus
  if (data.entry_status === "cancelled") jsonLd.eventStatus = "https://schema.org/EventCancelled";
  else if (data.entry_status === "postponed") jsonLd.eventStatus = "https://schema.org/EventPostponed";
  else jsonLd.eventStatus = "https://schema.org/EventScheduled";

  jsonLd.eventAttendanceMode = "https://schema.org/OfflineEventAttendanceMode";

  // organizer
  if (data.organizer) {
    const org = { "@type": "Organization", name: data.organizer.name };
    if (data.organizer.url || data.official_url) org.url = data.organizer.url || data.official_url;
    jsonLd.organizer = org;
  }

  // offers
  if (data.races && data.races.length > 0) {
    const fees = data.races.map((r) => r.fee_min).filter((f) => f && f > 0);
    if (fees.length > 0) {
      const offer = {
        "@type": "Offer",
        priceCurrency: "JPY",
        price: String(Math.min(...fees)),
        url: data.entry_url || data.source_url || `${baseUrl}/${sport.slug}/${data.id}`,
      };
      if (data.entry_status === "open") offer.availability = "https://schema.org/InStock";
      else if (data.entry_status === "closed") offer.availability = "https://schema.org/SoldOut";
      if (data.entry_end_date) offer.validThrough = data.entry_end_date;
      if (data.entry_start_date) offer.validFrom = data.entry_start_date;
      jsonLd.offers = offer;
    }
  }

  const sameAs = [];
  if (data.source_url) sameAs.push(data.source_url);
  if (data.official_url && data.official_url !== data.source_url) sameAs.push(data.official_url);
  if (sameAs.length > 0) jsonLd.sameAs = sameAs;

  return jsonLd;
}

// --- Metadata ---

export async function generateMetadata({ params }) {
  const { sportSlug, id } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport || !sport.enabled) return {};

  try {
    const data = getMarathonDetailPageData(id);
    if (!data || data.sport_type !== sport.sportTypeForDb) return {};

    const datePart = data.event_date
      ? `（${formatShortDate(data.event_date)}開催）`
      : "";
    const locationPart = data.prefecture || "";
    const entryPart = data.entry_status === "open" ? "エントリー受付中。" : "";

    const description = `${data.title}${datePart}の開催日、開催地、種目、エントリー情報を確認できます。${locationPart ? `${locationPart}で開催。` : ""}${entryPart}`;

    return {
      title: data.title,
      description,
      openGraph: {
        title: `${data.title} | ${siteConfig.siteName}`,
        description,
        type: "website",
      },
    };
  } catch {
    return {};
  }
}

// --- Page ---

export default async function SportDetailPage({ params }) {
  const { sportSlug, id } = await params;
  const sport = getSportBySlug(sportSlug);
  if (!sport || !sport.enabled) notFound();

  let data;
  try {
    data = getMarathonDetailPageData(id);
  } catch {
    notFound();
  }
  if (!data) notFound();

  // sport_type ガード: /trail/123 で marathon イベントが表示されるのを防ぐ
  if (data.sport_type !== sport.sportTypeForDb) notFound();

  const prefectureSlug = data.prefecture
    ? PREFECTURE_NAME_TO_SLUG[data.prefecture]
    : null;
  const eventMonth = data.event_month ? parseInt(data.event_month) : null;

  const breadcrumbs = [
    { label: "トップ", href: "/" },
    { label: sport.label, href: `/${sport.slug}` },
    { label: data.title },
  ];

  const eventJsonLd = buildEventJsonLd(data, sport);

  // Phase52: trail タグ抽出
  const trailTags = sport.slug === "trail" ? extractTrailTags(data) : [];

  // Phase57: 要点・ハイライト・比較UI
  const quickFacts = buildEventQuickFacts(data);

  // Phase228: データ出典ラベル
  const sourceLabel = data.source_site === "runnet" ? "RUNNET" : data.source_site;
  const hasMoshicom = data.official_url?.includes("moshicom");
  const dataSource = hasMoshicom ? `${sourceLabel} / moshicom` : sourceLabel;
  const comparison = buildEventComparisonSummary(data);

  // Phase58: 回遊強化
  const p58RelatedEvents = getRelatedEvents(data, { limit: 6 });
  const p58ExcludeIds = new Set(p58RelatedEvents.map((e) => e.id));
  const p58AlternativeEvents = getAlternativeEvents(data, {
    limit: 4,
    excludeIds: p58ExcludeIds,
  });
  const p58SearchLinks = buildSearchLinksFromEvent(data, {
    sportSlug: sport.slug,
  });

  // Phase59: 判断シグナル
  const { signals: decisionSignals } = buildDecisionSignals(data);
  const decisionSummary = buildDecisionSummary(data);

  // 関連リンク
  const relatedLinks = [];
  if (prefectureSlug) {
    relatedLinks.push({
      label: `${data.prefecture}の${sport.label}大会`,
      href: `/${sport.slug}/prefecture/${prefectureSlug}`,
    });
  }
  if (eventMonth && eventMonth >= 1 && eventMonth <= 12) {
    relatedLinks.push({
      label: `${eventMonth}月開催の${sport.label}大会`,
      href: `/${sport.slug}/month/${eventMonth}`,
    });
  }
  if (sport.slug === "trail") {
    relatedLinks.push({
      label: "🔥 トレイル人気ランキング",
      href: "/trail/ranking",
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* JSON-LD: location/startDate 不足時は出力しない */}
      {eventJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
        />
      )}

      {/* パンくず */}
      <Breadcrumbs items={breadcrumbs} />

      {/* A. Hero */}
      <MarathonDetailHero data={data} />

      {/* Phase52: trail 専用タグチップ */}
      {trailTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 -mt-4">
          <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg">
            ⛰️ トレイルラン
          </span>
          {trailTags.map((tag) => (
            <span
              key={tag.label}
              className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg"
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Phase134: 運営確認バッジ */}
      {data.organizer_verified && data.organizer_verified !== "unconfirmed" && (
        <div className="mb-2">
          <OrganizerVerifiedBadge
            status={data.organizer_verified}
            updatedAt={data.updated_at}
            context="detail"
            size="md"
          />
        </div>
      )}

      {/* Phase39: 相互検証の矛盾警告 */}
      {data.verification_conflict_level >= 2 && (
        <div className="mt-2">
          <ConflictDetailBanner
            level={data.verification_conflict_level}
            summary={data.verification_conflict_summary}
          />
        </div>
      )}

      {/* Phase59: アクションバー（比較・あとで見る） */}
      <div className="flex items-center gap-3 mt-3">
        <EventCompareActions
          eventId={data.id}
          eventTitle={data.title}
          sourcePage={`${sport.slug}_detail`}
        />
        <EventSaveActions
          eventId={data.id}
          eventTitle={data.title}
          sourcePage={`${sport.slug}_detail`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-2">
        {/* メインカラム */}
        <div className="lg:col-span-2 space-y-6">
          {/* Phase59: 検討時のポイント */}
          <EventDecisionSignalsCard
            signals={decisionSignals}
            summary={decisionSummary}
          />

          {/* Phase57→228: この大会の要点（データ出典・情報確認統合） */}
          <EventQuickFactsCard quickFacts={quickFacts} dataSource={dataSource} freshness={data.freshness} />

          {/* B2. 締切傾向・緊急度 */}
          <MarathonDetailUrgency
            urgency={data.urgency}
            entryHistory={data.entryHistory}
            entryStatus={data.entry_status}
          />

          {/* C. 大会概要 */}
          <MarathonDetailOverview data={data} />

          {/* Phase57: 比較メモ */}
          <EventComparisonCard comparison={comparison} />

          {/* Phase58: この条件でもっと探す */}
          <EventSearchLinksSection searchLinks={p58SearchLinks} />

          {/* Phase58: 似た条件の大会 */}
          <RelatedEventsSection
            events={p58RelatedEvents}
            sportSlug={sport.slug}
          />

          {/* Phase58: 代わりに検討しやすい大会 */}
          <AlternativeEventsSection
            events={p58AlternativeEvents}
            sportSlug={sport.slug}
          />

          {/* D2. サービス・設備 */}
          <MarathonDetailServices
            services={data.services}
            parkingInfo={data.parking_info}
          />

          {/* E. 種目・参加費 */}
          <MarathonDetailPricing pricing={data.pricing} races={data.races} />

          {/* F. コース・競技情報 */}
          <EventCourseSection
            courseInfo={data.course_info}
            raceMethodText={data.race_method_text}
            cutoffText={data.cutoff_text}
            timeLimits={data.time_limits}
            races={data.races}
          />

          {/* G. タイムスケジュール */}
          <MarathonDetailSchedule schedule={data.schedule} />

          {/* H. 当日ガイド */}
          <EventDayGuideSection
            receptionPlace={data.reception_place}
            receptionTimeText={data.reception_time_text}
            transitText={data.transit_text}
            parkingInfo={data.parking_info}
            accessInfo={data.access_info}
            venueName={data.venue_name}
            venueAddress={data.venue_address}
            mapUrl={data.map_url}
            eventId={data.id}
            eventTitle={data.title}
          />

          {/* I. FAQ */}
          <MarathonDetailFaq faq={data.faq} />

          {/* J. 主催者 */}
          <MarathonDetailOrganizer organizer={data.organizer} />

          {/* K. 規約・注意事項 */}
          <EventTermsSection
            cancellationPolicy={data.cancellation_policy}
            notes={data.notes}
            termsText={data.terms_text}
            pledgeText={data.pledge_text}
            refundPolicyText={data.refund_policy_text}
            registrationRequirementsText={data.registration_requirements_text}
            healthManagementText={data.health_management_text}
          />

          {/* L. 口コミ・レビュー */}
          <ReviewInsightsCard insights={data.reviewInsights} />
          <EventCommentsSection reviews={data.reviews} eventId={data.id} eventTitle={data.title} sportType={data.sport_type} reviewsPath={`/${sport.slug}/${data.id}/reviews`} />
          <ReviewContextPhotos reviewInsights={data.reviewInsights} galleryGrouped={data.galleryGrouped} />

          {/* 大会結果 */}
          <EventResultsLink
            eventId={data.id}
            eventTitle={data.title}
            resultsPath={`/${sport.slug}/${data.id}/results`}
            resultsSummary={data.resultsSummary}
          />

          {/* Phase160: 写真ギャラリー */}
          <EventPhotoGallery
            photos={data.galleryPhotos}
            grouped={data.galleryGrouped}
            photoCount={data.photoCount}
            photosPath={`/${sport.slug}/${data.id}/photos`}
          />

          {/* Phase194: エンゲージメント指標 */}
          <EventEngagementBar engagement={data.engagement} />

          {/* Phase193: コミュニティセクション */}
          <CommunityVoicesSection
            reviews={data.reviews}
            reviewSummary={data.reviewSummary}
            reviewInsights={data.reviewInsights}
            eventId={data.id}
            eventTitle={data.title}
            sportType={data.sport_type}
            reviewsPath={`/${sport.slug}/${data.id}/reviews`}
          />

          {/* Phase197: コミュニティ導線 */}
          <CommunityNavLinks
            eventId={data.id}
            eventTitle={data.title}
            sportSlug={sport.slug}
            reviewCount={data.reviews?.length || 0}
            photoCount={data.photoCount || 0}
            hasResults={!!data.resultsSummary}
          />

          {/* Phase174: 参加後CTA */}
          <PostEventCTA
            eventId={data.id}
            eventTitle={data.title}
            sportType={data.sport_type}
            eventDate={data.event_date}
            photosPath={`/${sport.slug}/${data.id}/photos`}
          />

          {/* 掲載情報に関する注意 */}
          <p className="text-[11px] text-gray-400 mt-2">
            ※ 最新の情報・申込条件は公式サイトでご確認ください。
          </p>

          {/* Phase129: 運営向け情報修正リクエスト導線 */}
          <OrganizerUpdateLink eventId={data.id} eventTitle={data.title} />
        </div>

        {/* サイドバー */}
        <div className="space-y-6">
          {/* 外部リンク（計測付き） */}
          <ExternalLinkCard
            sourceUrl={data.source_url}
            officialUrl={data.official_url}
            moshicomUrl={data.moshicom_url}
            sourcePriority={data.source_priority}
            eventId={data.id}
            eventTitle={data.title}
          />

          {/* Phase237: SNSシェア */}
          <div className="card p-5">
            <SnsShareButtons
              url={`${siteConfig.siteUrl}/${sport.slug}/${data.id}`}
              title={data.title}
            />
          </div>

          {/* Phase46: 人気指数 */}
          <MarathonDetailPopularity eventId={data.id} />

          {/* 開催地情報 */}
          {(data.prefecture || data.city || data.venue_name) && (
            <div className="card p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">開催地</h3>
              <dl className="space-y-2 text-sm">
                {data.prefecture && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">都道府県</dt>
                    <dd className="text-gray-900">
                      {prefectureSlug ? (
                        <Link
                          href={`/${sport.slug}/prefecture/${prefectureSlug}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {data.prefecture}
                        </Link>
                      ) : (
                        data.prefecture
                      )}
                    </dd>
                  </div>
                )}
                {data.city && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">市区町村</dt>
                    <dd className="text-gray-900">{data.city}</dd>
                  </div>
                )}
                {data.venue_name && (
                  <div>
                    <dt className="text-gray-500 mb-1">会場</dt>
                    <dd className="text-gray-900">{data.venue_name}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

        </div>
      </div>

      {/* 閲覧ログ記録 */}
      <MarathonViewTracker marathonId={data.id} />

      {/* 関連する条件で探す */}
      {relatedLinks.length > 0 && (
        <div className="mt-10 pt-8 border-t border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            関連する条件で探す
          </h2>
          <div className="flex flex-wrap gap-2">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-block px-3 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200
                           rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
