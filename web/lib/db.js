import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "sports-event.db");
const SCHEMA_PATH = path.join(process.cwd(), "..", "sql", "001_create_tables.sql");

let _db = null;

export function getDb() {
  if (!_db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("busy_timeout = 5000");
    _db.pragma("foreign_keys = ON");

    if (fs.existsSync(SCHEMA_PATH)) {
      const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
      _db.exec(schema);
    }

    // Phase35-36: 新カラム追加マイグレーション
    const migrations = [
      "ALTER TABLE marathon_details ADD COLUMN services_json TEXT",
      "ALTER TABLE marathon_details ADD COLUMN parking_info TEXT",
      "ALTER TABLE event_races ADD COLUMN category TEXT",
      "ALTER TABLE event_races ADD COLUMN note TEXT",
      // Phase36: 締切履歴・シグナル
      "ALTER TABLE events ADD COLUMN entry_signals_json TEXT",
      "ALTER TABLE events ADD COLUMN urgency_label TEXT",
      "ALTER TABLE events ADD COLUMN urgency_level TEXT",
      // Phase37: 定期監視・鮮度
      "ALTER TABLE events ADD COLUMN last_verified_at TEXT",
      "ALTER TABLE events ADD COLUMN monitor_error_count INTEGER DEFAULT 0",
      "ALTER TABLE events ADD COLUMN monitor_last_error TEXT",
      // Phase39: 相互検証・矛盾検知
      "ALTER TABLE events ADD COLUMN verification_conflict INTEGER DEFAULT 0",
      "ALTER TABLE events ADD COLUMN verification_conflict_level INTEGER DEFAULT 0",
      "ALTER TABLE events ADD COLUMN verification_conflict_summary TEXT",
      "ALTER TABLE events ADD COLUMN verification_conflict_updated_at TEXT",
      "ALTER TABLE events ADD COLUMN verification_status TEXT DEFAULT 'unverified'",
      // Phase40: 通知UI強化
      "ALTER TABLE notifications ADD COLUMN read_at TEXT",
      "ALTER TABLE notifications ADD COLUMN link_url TEXT",
      // Phase55: 詳細ページ情報拡充
      "ALTER TABLE marathon_details ADD COLUMN registration_requirements_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN health_management_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN terms_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN pledge_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN refund_policy_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN reception_place TEXT",
      "ALTER TABLE marathon_details ADD COLUMN reception_time_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN transit_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN race_method_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN cutoff_text TEXT",
      "ALTER TABLE marathon_details ADD COLUMN timetable_text TEXT",
      // Phase72: 募集状態監視強化
      "ALTER TABLE events ADD COLUMN official_entry_status TEXT",
      "ALTER TABLE events ADD COLUMN official_entry_status_label TEXT",
      "ALTER TABLE events ADD COLUMN official_checked_at TEXT",
      "ALTER TABLE events ADD COLUMN official_deadline_text TEXT",
      "ALTER TABLE events ADD COLUMN official_capacity_text TEXT",
      "ALTER TABLE events ADD COLUMN official_status_source_url TEXT",
      "ALTER TABLE events ADD COLUMN official_status_confidence INTEGER DEFAULT 0",
      "ALTER TABLE events ADD COLUMN official_status_note TEXT",
      // Phase79: 精度強化 — ソース種別・unknown理由
      "ALTER TABLE events ADD COLUMN official_status_source_type TEXT",
      "ALTER TABLE events ADD COLUMN official_unknown_reason TEXT",
      // Phase131: 運営確認ステータス
      "ALTER TABLE events ADD COLUMN organizer_verified TEXT DEFAULT 'unconfirmed'",
      "ALTER TABLE events ADD COLUMN organizer_verified_at TEXT",
      "ALTER TABLE events ADD COLUMN organizer_verified_note TEXT",
      // Phase148: 大会結果拡張
      "ALTER TABLE event_results ADD COLUMN sport_type TEXT",
      "ALTER TABLE event_results ADD COLUMN bib_number TEXT",
      "ALTER TABLE event_results ADD COLUMN overall_rank INTEGER",
      "ALTER TABLE event_results ADD COLUMN gender_rank INTEGER",
      "ALTER TABLE event_results ADD COLUMN age_rank INTEGER",
      "ALTER TABLE event_results ADD COLUMN finish_time TEXT",
      "ALTER TABLE event_results ADD COLUMN net_time TEXT",
      "ALTER TABLE event_results ADD COLUMN category_name TEXT",
      "ALTER TABLE event_results ADD COLUMN gender TEXT",
      "ALTER TABLE event_results ADD COLUMN age_group TEXT",
      "ALTER TABLE event_results ADD COLUMN finish_status TEXT DEFAULT 'finished'",
      "ALTER TABLE event_results ADD COLUMN is_public INTEGER DEFAULT 1",
      "ALTER TABLE event_results ADD COLUMN runner_name_hash TEXT",
      // Phase138: 口コミ機能拡張
      "ALTER TABLE event_reviews ADD COLUMN sport_type TEXT",
      "ALTER TABLE event_reviews ADD COLUMN rating_overall INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN rating_course INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN rating_access INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN rating_venue INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN rating_beginner INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN review_title TEXT",
      "ALTER TABLE event_reviews ADD COLUMN review_body TEXT",
      "ALTER TABLE event_reviews ADD COLUMN participant_type TEXT",
      "ALTER TABLE event_reviews ADD COLUMN visit_type TEXT",
      "ALTER TABLE event_reviews ADD COLUMN year_joined INTEGER",
      "ALTER TABLE event_reviews ADD COLUMN nickname TEXT",
      "ALTER TABLE event_reviews ADD COLUMN status TEXT DEFAULT 'published'",
      "ALTER TABLE event_reviews ADD COLUMN recommended_for TEXT",
      // 口コミ認証必須化: user_id紐付け
      "ALTER TABLE event_reviews ADD COLUMN user_id INTEGER",
      // Phase205: 大会タグ
      "ALTER TABLE events ADD COLUMN tags_json TEXT",
      // MOSHICOM統合: ソース優先度・URL
      "ALTER TABLE marathon_details ADD COLUMN source_priority TEXT DEFAULT 'runnet'",
      "ALTER TABLE marathon_details ADD COLUMN source_updated_at TEXT",
      "ALTER TABLE marathon_details ADD COLUMN moshicom_url TEXT",
      // Phase220: 人気指数カラム（計算済みスコア格納）
      "ALTER TABLE events ADD COLUMN popularity_score INTEGER DEFAULT 0",
      "ALTER TABLE events ADD COLUMN popularity_label TEXT",
      "ALTER TABLE events ADD COLUMN popularity_key TEXT",
      // Phase240: 巡回パトロール — 手動対応フラグ
      "ALTER TABLE events ADD COLUMN patrol_status TEXT DEFAULT 'auto'",
      "ALTER TABLE events ADD COLUMN patrol_note TEXT",
      // hojokin: ソース追跡カラム
      "ALTER TABLE hojokin_items ADD COLUMN source_name TEXT",
      "ALTER TABLE hojokin_items ADD COLUMN source_url TEXT",
      "ALTER TABLE hojokin_items ADD COLUMN detail_url TEXT",
      // organizations 連携
      "ALTER TABLE hojokin_items ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
      "ALTER TABLE kyoninka_entities ADD COLUMN organization_id INTEGER REFERENCES organizations(id)",
    ];
    for (const sql of migrations) {
      try { _db.exec(sql); } catch { /* duplicate column → ignore */ }
    }

    // データクレンジング: タイトルに「テスト」「test」を含む未公開相当レコードを非公開化
    try {
      _db.exec(`
        UPDATE hojokin_items
        SET is_published = 0, updated_at = datetime('now')
        WHERE (title LIKE '%テスト%' OR title LIKE '%test%')
          AND is_published = 1
      `);
    } catch { /* table may not exist yet — ignore */ }

    // Phase205: event_tags テーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS event_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id),
        UNIQUE(event_id, tag)
      )
    `);

    // Phase72: 募集状態変更ログテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS entry_status_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        previous_label TEXT,
        new_label TEXT,
        change_source TEXT DEFAULT 'monitor',
        confidence INTEGER DEFAULT 0,
        detected_signals_json TEXT,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entry_status_changes_event
        ON entry_status_changes(event_id, created_at DESC)
    `);

    // Phase130: 運営修正依頼テーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS organizer_update_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER,
        event_name TEXT NOT NULL,
        official_url TEXT,
        requester_role TEXT NOT NULL,
        correction_items TEXT,
        correction_content TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_organizer_requests_status
        ON organizer_update_requests(status, created_at DESC)
    `);

    // Phase132: 管理メモテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS admin_event_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        note_type TEXT NOT NULL,
        note_text TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_admin_event_notes_event
        ON admin_event_notes(event_id, created_at DESC)
    `);

    // Phase148: ユーザー結果紐付けテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS user_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        result_id INTEGER NOT NULL,
        event_id INTEGER NOT NULL,
        verified INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (result_id) REFERENCES event_results(id),
        FOREIGN KEY (event_id) REFERENCES events(id),
        UNIQUE(user_id, result_id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_user_results_user
        ON user_results(user_id, created_at DESC)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_results_event_year
        ON event_results(event_id, result_year, overall_rank)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_results_bib
        ON event_results(event_id, result_year, bib_number)
    `);

    // Phase158: 大会写真テーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS event_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        sport_type TEXT,
        image_url TEXT NOT NULL,
        thumbnail_url TEXT,
        image_type TEXT DEFAULT 'other',
        caption TEXT,
        alt_text TEXT,
        source_type TEXT DEFAULT 'editorial',
        source_url TEXT,
        display_order INTEGER DEFAULT 0,
        status TEXT DEFAULT 'published',
        uploaded_by INTEGER,
        taken_year INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_photos_event
        ON event_photos(event_id, status, display_order)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_photos_type
        ON event_photos(event_id, image_type, status)
    `);

    // Phase171: ユーザー大会メモテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS event_memos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        event_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        memo_text TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (event_id) REFERENCES events(id),
        UNIQUE(user_id, event_id, category)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_memos_user_event
        ON event_memos(user_id, event_id, updated_at DESC)
    `);

    // Phase138: 口コミインデックス
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_reviews_event_status
        ON event_reviews(event_id, status, created_at DESC)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_reviews_sport
        ON event_reviews(sport_type, status, created_at DESC)
    `);

    // Phase220: パフォーマンス最適化インデックス
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created
        ON event_activity_logs(created_at, event_id, action_type)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_event
        ON event_activity_logs(event_id, action_type, created_at)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_favorites_event
        ON favorites(event_id)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_races_event
        ON event_races(event_id, sort_order)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_sport_date
        ON events(sport_type, event_date)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_popularity
        ON events(popularity_score DESC)
    `);

    // MOSHICOM統合検証ログ
    _db.exec(`
      CREATE TABLE IF NOT EXISTS merge_verification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        runnet_title TEXT NOT NULL,
        moshicom_title TEXT,
        moshicom_url TEXT,
        moshicom_id TEXT,
        score INTEGER DEFAULT 0,
        matched INTEGER DEFAULT 0,
        all_candidates_json TEXT,
        search_error TEXT,
        selector_errors_json TEXT,
        human_review TEXT DEFAULT 'pending',
        review_result TEXT,
        review_note TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mvl_event
        ON merge_verification_logs(event_id)
    `);

    // Phase228: 運営管理画面 — 問い合わせテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inquiry_type TEXT NOT NULL DEFAULT 'general',
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'normal',
        assignee TEXT,
        event_id INTEGER,
        target_url TEXT,
        source_page TEXT,
        admin_memo TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_inquiries_status
        ON inquiries(status, priority, created_at DESC)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_inquiries_type
        ON inquiries(inquiry_type, status, created_at DESC)
    `);

    // Phase228: 問い合わせ返信・メモ履歴
    _db.exec(`
      CREATE TABLE IF NOT EXISTS inquiry_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inquiry_id INTEGER NOT NULL,
        note_type TEXT NOT NULL DEFAULT 'memo',
        note_text TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (inquiry_id) REFERENCES inquiries(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_inquiry_notes_inquiry
        ON inquiry_notes(inquiry_id, created_at DESC)
    `);

    // Phase228: スクレイピング実行ログ
    _db.exec(`
      CREATE TABLE IF NOT EXISTS scraping_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_name TEXT NOT NULL,
        job_type TEXT NOT NULL DEFAULT 'list',
        status TEXT NOT NULL DEFAULT 'running',
        total_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        new_count INTEGER DEFAULT 0,
        update_count INTEGER DEFAULT 0,
        error_summary TEXT,
        details_json TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scraping_logs_source
        ON scraping_logs(source_name, created_at DESC)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scraping_logs_status
        ON scraping_logs(status, created_at DESC)
    `);

    // Phase228: 管理操作ログ（将来のロール設計の土台）
    _db.exec(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        details_json TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user
        ON admin_audit_logs(user_id, created_at DESC)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action
        ON admin_audit_logs(action, created_at DESC)
    `);

    // Phase229: ログイン試行制限テーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        email TEXT PRIMARY KEY,
        fail_count INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        last_attempt_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Phase229: users テーブル拡張（パスワード変更日時）
    const userPasswordMigrations = [
      "ALTER TABLE users ADD COLUMN password_changed_at TEXT",
      "ALTER TABLE users ADD COLUMN last_login_at TEXT",
    ];
    for (const sql of userPasswordMigrations) {
      try { _db.exec(sql); } catch { /* duplicate column → ignore */ }
    }

    // Phase230: パスワードリセットトークンテーブル
    _db.exec(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_prt_token
        ON password_reset_tokens(token)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_prt_user
        ON password_reset_tokens(user_id, created_at DESC)
    `);

    // 掲載効果分析: event_placements（掲載区分履歴）
    _db.exec(`
      CREATE TABLE IF NOT EXISTS event_placements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        placement TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_placements_event
        ON event_placements(event_id, placement, started_at DESC)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_placements_placement
        ON event_placements(placement, started_at DESC)
    `);

    // 掲載効果分析: event_impressions（表示回数・日次集計）
    _db.exec(`
      CREATE TABLE IF NOT EXISTS event_impressions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        placement TEXT NOT NULL,
        impression_date TEXT NOT NULL,
        impressions INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id),
        UNIQUE(event_id, placement, impression_date)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_impressions_event
        ON event_impressions(event_id, placement, impression_date)
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_impressions_date
        ON event_impressions(impression_date, placement)
    `);

    // Phase240: 巡回パトロール再取得ログ
    _db.exec(`
      CREATE TABLE IF NOT EXISTS patrol_refetch_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        source_url TEXT,
        source_site TEXT,
        status TEXT NOT NULL,
        failure_reason TEXT,
        failure_detail TEXT,
        updated_fields TEXT,
        remaining_missing TEXT,
        races_added INTEGER DEFAULT 0,
        duration_ms INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patrol_refetch_logs_event
        ON patrol_refetch_logs(event_id, created_at DESC)
    `);

    // event_activity_logs に placement カラム追加
    const placementMigrations = [
      "ALTER TABLE event_activity_logs ADD COLUMN placement TEXT",
    ];
    for (const sql of placementMigrations) {
      try { _db.exec(sql); } catch { /* duplicate column → ignore */ }
    }
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_placement
        ON event_activity_logs(placement, action_type, created_at)
    `);

    // マイカレンダー: ユーザーカレンダーイベント
    _db.exec(`
      CREATE TABLE IF NOT EXISTS user_calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        event_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'considering',
        entry_date TEXT,
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (event_id) REFERENCES events(id),
        UNIQUE(user_id, event_id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_uce_user
        ON user_calendar_events(user_id, status, created_at DESC)
    `);

    // マイカレンダー: ユーザー参加記録
    _db.exec(`
      CREATE TABLE IF NOT EXISTS user_event_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        event_id INTEGER NOT NULL,
        finish_time TEXT,
        net_time TEXT,
        overall_rank INTEGER,
        gender_rank INTEGER,
        age_rank INTEGER,
        is_personal_best INTEGER DEFAULT 0,
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (event_id) REFERENCES events(id),
        UNIQUE(user_id, event_id)
      )
    `);
    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_uer_user
        ON user_event_results(user_id, created_at DESC)
    `);

    // ============================================================
    // SaaS Navi: 共通ナビ基盤テーブル
    // 既存 events 系テーブルには一切影響しない追加テーブル群
    // ============================================================

    // providers: ベンダー / 提供者
    _db.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        url TEXT,
        logo_url TEXT,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // items: 中立化されたアイテムテーブル（SaaS ツール等）
    _db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE,
        category TEXT,
        subcategory TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        description TEXT,
        summary TEXT,
        url TEXT,
        hero_image_url TEXT,
        prefecture TEXT,
        city TEXT,
        date_primary TEXT,
        date_secondary TEXT,
        price_min INTEGER,
        price_max INTEGER,
        popularity_score REAL DEFAULT 0,
        provider_id INTEGER REFERENCES providers(id),
        source_site TEXT,
        source_item_id TEXT,
        extension_json TEXT,
        is_published INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_items_category ON items(category)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_items_status ON items(status)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_items_provider ON items(provider_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_items_popularity ON items(popularity_score DESC)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_items_published ON items(is_published)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_items_slug ON items(slug)`);

    // saas_details: SaaS固有の検索/フィルタ用属性
    _db.exec(`
      CREATE TABLE IF NOT EXISTS saas_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL UNIQUE REFERENCES items(id),
        price_monthly INTEGER,
        price_display TEXT,
        has_free_plan INTEGER DEFAULT 0,
        has_free_trial INTEGER DEFAULT 0,
        trial_days INTEGER,
        company_size_min INTEGER,
        company_size_max INTEGER,
        company_size_label TEXT,
        api_available INTEGER DEFAULT 0,
        mobile_app INTEGER DEFAULT 0,
        support_type TEXT,
        deployment_type TEXT DEFAULT 'cloud',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_saas_price ON saas_details(price_monthly)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_saas_free_plan ON saas_details(has_free_plan)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_saas_free_trial ON saas_details(has_free_trial)`);

    // item_variants: プラン / バリアント
    _db.exec(`
      CREATE TABLE IF NOT EXISTS item_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        name TEXT NOT NULL,
        attributes_json TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_item_variants_item ON item_variants(item_id, sort_order)`);

    // item_tags: タグ / 特徴
    _db.exec(`
      CREATE TABLE IF NOT EXISTS item_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        tag TEXT NOT NULL,
        tag_group TEXT DEFAULT 'feature',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(item_id, tag)
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_item_tags_item ON item_tags(item_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag)`);

    // item_reviews: アイテムレビュー
    _db.exec(`
      CREATE TABLE IF NOT EXISTS item_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        user_id INTEGER REFERENCES users(id),
        rating_overall REAL,
        review_title TEXT,
        review_body TEXT,
        ratings_json TEXT,
        company_size TEXT,
        usage_period TEXT,
        is_approved INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_item_reviews_item ON item_reviews(item_id, is_approved)`);

    // item_favorites: アイテムお気に入り（既存 favorites テーブルは events 用なので分離）
    _db.exec(`
      CREATE TABLE IF NOT EXISTS item_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        item_id INTEGER NOT NULL REFERENCES items(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_key, item_id)
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_item_favorites_user ON item_favorites(user_key)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_item_favorites_item ON item_favorites(item_id)`);

    // item_saved_searches: アイテム保存検索
    _db.exec(`
      CREATE TABLE IF NOT EXISTS item_saved_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        name TEXT,
        filters_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_item_saved_searches_user ON item_saved_searches(user_key)`);

    // yutai_items: 株主優待 本体データ
    _db.exec(`
      CREATE TABLE IF NOT EXISTS yutai_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category TEXT,
        confirm_months TEXT,
        min_investment INTEGER,
        benefit_summary TEXT,
        dividend_yield REAL,
        benefit_yield REAL,
        is_published INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_yutai_items_category ON yutai_items(category)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_yutai_items_published ON yutai_items(is_published)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_yutai_items_slug ON yutai_items(slug)`);

    // yutai_favorites: 株主優待お気に入り
    _db.exec(`
      CREATE TABLE IF NOT EXISTS yutai_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        yutai_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_key, yutai_id)
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_yutai_favorites_user ON yutai_favorites(user_key)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_yutai_favorites_item ON yutai_favorites(yutai_id)`);

    // hojokin_items: 補助金 本体データ
    _db.exec(`
      CREATE TABLE IF NOT EXISTS hojokin_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category TEXT,
        target_type TEXT,
        max_amount INTEGER,
        subsidy_rate TEXT,
        deadline TEXT,
        status TEXT DEFAULT 'open',
        provider_name TEXT,
        summary TEXT,
        is_published INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_hojokin_items_category ON hojokin_items(category)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_hojokin_items_published ON hojokin_items(is_published)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_hojokin_items_slug ON hojokin_items(slug)`);

    // hojokin_favorites: 補助金お気に入り
    _db.exec(`
      CREATE TABLE IF NOT EXISTS hojokin_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        hojokin_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_key, hojokin_id)
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_hojokin_favorites_user ON hojokin_favorites(user_key)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_hojokin_favorites_item ON hojokin_favorites(hojokin_id)`);

    // nyusatsu_items: 入札ナビ 本体データ
    _db.exec(`
      CREATE TABLE IF NOT EXISTS nyusatsu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category TEXT,
        issuer_name TEXT,
        target_area TEXT,
        deadline TEXT,
        budget_amount INTEGER,
        bidding_method TEXT,
        summary TEXT,
        status TEXT DEFAULT 'open',
        is_published INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_nyusatsu_items_category ON nyusatsu_items(category)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_nyusatsu_items_published ON nyusatsu_items(is_published)`);

    // nyusatsu_items: P2 拡張カラム（既存テーブルへの後方互換追加）
    const nyusatsuCols = _db.prepare("PRAGMA table_info('nyusatsu_items')").all().map(c => c.name);
    if (!nyusatsuCols.includes("qualification")) _db.exec("ALTER TABLE nyusatsu_items ADD COLUMN qualification TEXT");
    if (!nyusatsuCols.includes("announcement_url")) _db.exec("ALTER TABLE nyusatsu_items ADD COLUMN announcement_url TEXT");
    if (!nyusatsuCols.includes("contact_info")) _db.exec("ALTER TABLE nyusatsu_items ADD COLUMN contact_info TEXT");
    if (!nyusatsuCols.includes("delivery_location")) _db.exec("ALTER TABLE nyusatsu_items ADD COLUMN delivery_location TEXT");
    if (!nyusatsuCols.includes("has_attachment")) _db.exec("ALTER TABLE nyusatsu_items ADD COLUMN has_attachment INTEGER DEFAULT 0");
    if (!nyusatsuCols.includes("announcement_date")) _db.exec("ALTER TABLE nyusatsu_items ADD COLUMN announcement_date TEXT");
    if (!nyusatsuCols.includes("contract_period")) _db.exec("ALTER TABLE nyusatsu_items ADD COLUMN contract_period TEXT");
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_nyusatsu_items_slug ON nyusatsu_items(slug)`);

    // nyusatsu_favorites: 入札ナビお気に入り
    _db.exec(`
      CREATE TABLE IF NOT EXISTS nyusatsu_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        nyusatsu_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_key, nyusatsu_id)
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_nyusatsu_favorites_user ON nyusatsu_favorites(user_key)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_nyusatsu_favorites_item ON nyusatsu_favorites(nyusatsu_id)`);

    // minpaku_items: 民泊ナビ 本体データ
    _db.exec(`
      CREATE TABLE IF NOT EXISTS minpaku_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category TEXT,
        area TEXT,
        property_type TEXT,
        capacity INTEGER,
        price_per_night INTEGER,
        min_nights INTEGER DEFAULT 1,
        host_name TEXT,
        rating REAL,
        review_count INTEGER DEFAULT 0,
        summary TEXT,
        status TEXT DEFAULT 'active',
        is_published INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_minpaku_items_category ON minpaku_items(category)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_minpaku_items_published ON minpaku_items(is_published)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_minpaku_items_slug ON minpaku_items(slug)`);

    // minpaku_favorites: 民泊ナビお気に入り
    _db.exec(`
      CREATE TABLE IF NOT EXISTS minpaku_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        minpaku_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_key, minpaku_id)
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_minpaku_favorites_user ON minpaku_favorites(user_key)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_minpaku_favorites_item ON minpaku_favorites(minpaku_id)`);

    // food_recall_items: 食品リコール監視
    _db.exec(`
      CREATE TABLE IF NOT EXISTS food_recall_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        product_name TEXT NOT NULL,
        manufacturer TEXT,
        category TEXT,
        recall_type TEXT DEFAULT 'voluntary',
        reason TEXT,
        risk_level TEXT DEFAULT 'unknown',
        affected_area TEXT,
        lot_number TEXT,
        recall_date TEXT,
        status TEXT DEFAULT 'active',
        consumer_action TEXT,
        source_url TEXT,
        manufacturer_url TEXT,
        summary TEXT,
        is_published INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_food_recall_items_slug ON food_recall_items(slug)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_food_recall_items_published ON food_recall_items(is_published)`);

    // sanpai_items: 産廃処理業者
    _db.exec(`
      CREATE TABLE IF NOT EXISTS sanpai_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        company_name TEXT NOT NULL,
        corporate_number TEXT,
        prefecture TEXT,
        city TEXT,
        license_type TEXT DEFAULT 'other',
        waste_category TEXT DEFAULT 'industrial',
        business_area TEXT,
        status TEXT DEFAULT 'active',
        risk_level TEXT DEFAULT 'none',
        penalty_count INTEGER NOT NULL DEFAULT 0,
        latest_penalty_date TEXT,
        source_name TEXT,
        source_url TEXT,
        detail_url TEXT,
        notes TEXT,
        is_published INTEGER NOT NULL DEFAULT 1,
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_sanpai_items_slug ON sanpai_items(slug)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_sanpai_items_published ON sanpai_items(is_published)`);

    // kyoninka_entities: 許認可・登録事業者
    _db.exec(`
      CREATE TABLE IF NOT EXISTS kyoninka_entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        entity_name TEXT NOT NULL,
        normalized_name TEXT,
        corporate_number TEXT,
        prefecture TEXT,
        city TEXT,
        address TEXT,
        entity_status TEXT DEFAULT 'active',
        primary_license_family TEXT DEFAULT 'other',
        registration_count INTEGER NOT NULL DEFAULT 0,
        latest_update_date TEXT,
        source_name TEXT,
        source_url TEXT,
        notes TEXT,
        is_published INTEGER NOT NULL DEFAULT 1,
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_kyoninka_entities_slug ON kyoninka_entities(slug)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_kyoninka_entities_published ON kyoninka_entities(is_published)`);

    // shitei_items: 指定管理・委託公募案件
    _db.exec(`
      CREATE TABLE IF NOT EXISTS shitei_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        municipality_name TEXT,
        prefecture TEXT,
        facility_category TEXT DEFAULT 'other',
        facility_name TEXT,
        recruitment_status TEXT DEFAULT 'unknown',
        application_start_date TEXT,
        application_deadline TEXT,
        opening_date TEXT,
        contract_start_date TEXT,
        contract_end_date TEXT,
        summary TEXT,
        eligibility TEXT,
        application_method TEXT,
        detail_url TEXT,
        source_name TEXT,
        source_url TEXT,
        attachment_count INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        is_published INTEGER NOT NULL DEFAULT 1,
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_shitei_items_slug ON shitei_items(slug)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_shitei_items_published ON shitei_items(is_published)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_shitei_items_prefecture ON shitei_items(prefecture)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_shitei_items_category ON shitei_items(facility_category)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_shitei_items_status ON shitei_items(recruitment_status)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_shitei_items_deadline ON shitei_items(application_deadline)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_shitei_items_municipality ON shitei_items(municipality_name)`);

    // shitei_favorites: 指定管理 ウォッチリスト
    _db.exec(`
      CREATE TABLE IF NOT EXISTS shitei_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        shitei_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_key, shitei_id)
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_shitei_favorites_user ON shitei_favorites(user_key)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_shitei_favorites_item ON shitei_favorites(shitei_id)`);

    // ─── 自動化共通基盤 ─────────────────────

    // data_sources: ドメイン横断ソース管理
    _db.exec(`
      CREATE TABLE IF NOT EXISTS data_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_type TEXT DEFAULT 'web',
        source_url TEXT,
        fetch_method TEXT DEFAULT 'manual',
        status TEXT DEFAULT 'active',
        review_policy TEXT DEFAULT 'review_required',
        publish_policy TEXT DEFAULT 'manual',
        run_frequency TEXT DEFAULT 'daily',
        last_success_at TEXT,
        last_checked_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_data_sources_domain ON data_sources(domain_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_data_sources_status ON data_sources(status)`);

    // sync_runs: 同期実行履歴
    _db.exec(`
      CREATE TABLE IF NOT EXISTS sync_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id TEXT NOT NULL,
        source_id INTEGER REFERENCES data_sources(id),
        run_type TEXT DEFAULT 'manual',
        run_status TEXT DEFAULT 'running',
        fetched_count INTEGER NOT NULL DEFAULT 0,
        created_count INTEGER NOT NULL DEFAULT 0,
        updated_count INTEGER NOT NULL DEFAULT 0,
        unchanged_count INTEGER NOT NULL DEFAULT 0,
        review_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT,
        error_summary TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_runs_domain ON sync_runs(domain_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_runs_source ON sync_runs(source_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(run_status)`);

    // change_logs: 差分記録
    _db.exec(`
      CREATE TABLE IF NOT EXISTS change_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id TEXT NOT NULL,
        sync_run_id INTEGER REFERENCES sync_runs(id),
        source_id INTEGER REFERENCES data_sources(id),
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        entity_slug TEXT,
        change_type TEXT NOT NULL,
        field_name TEXT,
        before_value TEXT,
        after_value TEXT,
        confidence_score REAL DEFAULT 1.0,
        requires_review INTEGER NOT NULL DEFAULT 0,
        reviewed_at TEXT,
        reviewed_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_change_logs_domain ON change_logs(domain_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_change_logs_sync_run ON change_logs(sync_run_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_change_logs_entity ON change_logs(entity_type, entity_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_change_logs_review ON change_logs(requires_review)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_change_logs_type ON change_logs(change_type)`);

    // admin_notifications: 管理画面内通知
    _db.exec(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id TEXT,
        notification_type TEXT NOT NULL DEFAULT 'info',
        title TEXT NOT NULL,
        message TEXT,
        related_entity_type TEXT,
        related_entity_id INTEGER,
        read_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_notifications_domain ON admin_notifications(domain_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read_at)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(notification_type)`);

    // ai_extractions: AI下書き・構造化抽出結果
    _db.exec(`
      CREATE TABLE IF NOT EXISTS ai_extractions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        entity_slug TEXT,
        source_url TEXT,
        extraction_type TEXT DEFAULT 'detail_page',
        input_text_length INTEGER,
        extracted_json TEXT,
        missing_fields TEXT,
        review_reasons TEXT,
        confidence_score REAL DEFAULT 0.5,
        quality_level TEXT DEFAULT 'draft',
        summary_text TEXT,
        llm_model TEXT,
        llm_tokens_used INTEGER,
        applied_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_extractions_domain ON ai_extractions(domain_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_extractions_entity ON ai_extractions(entity_type, entity_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_extractions_quality ON ai_extractions(quality_level)`);

    // ─── 共通基盤: 事業者/法人エンティティ ─────────────────────

    // organizations: ドメイン横断の法人・事業者マスタ
    _db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        normalized_name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        entity_type TEXT DEFAULT 'company',
        corporate_number TEXT,
        prefecture TEXT,
        city TEXT,
        address TEXT,
        merged_into_id INTEGER REFERENCES organizations(id),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_organizations_normalized ON organizations(normalized_name)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_organizations_corporate ON organizations(corporate_number)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active)`);
    _db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_corp_unique ON organizations(corporate_number) WHERE corporate_number IS NOT NULL`);

    // organization_name_variants: 名寄せ用の表記ゆれ記録
    _db.exec(`
      CREATE TABLE IF NOT EXISTS organization_name_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        raw_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        source_domain TEXT,
        source_entity_type TEXT,
        source_entity_id INTEGER,
        match_method TEXT DEFAULT 'exact',
        confidence REAL DEFAULT 1.0,
        verified_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_org_variants_org ON organization_name_variants(organization_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_org_variants_normalized ON organization_name_variants(normalized_name)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_org_variants_raw ON organization_name_variants(raw_name)`);

    // ─── 行政処分DB ─────────────────────

    // administrative_actions: 行政処分案件
    _db.exec(`
      CREATE TABLE IF NOT EXISTS administrative_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        organization_id INTEGER REFERENCES organizations(id),
        organization_name_raw TEXT NOT NULL,
        action_type TEXT NOT NULL DEFAULT 'other',
        action_date TEXT,
        authority_name TEXT,
        authority_level TEXT DEFAULT 'national',
        prefecture TEXT,
        city TEXT,
        industry TEXT,
        summary TEXT,
        detail TEXT,
        legal_basis TEXT,
        penalty_period TEXT,
        source_url TEXT,
        source_name TEXT,
        is_published INTEGER NOT NULL DEFAULT 0,
        review_status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_actions_slug ON administrative_actions(slug)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_actions_org ON administrative_actions(organization_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON administrative_actions(action_type)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_actions_date ON administrative_actions(action_date)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_actions_prefecture ON administrative_actions(prefecture)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_actions_published ON administrative_actions(is_published)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_actions_review ON administrative_actions(review_status)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_actions_industry ON administrative_actions(industry)`);

    // administrative_action_favorites: お気に入り
    _db.exec(`
      CREATE TABLE IF NOT EXISTS administrative_action_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_key TEXT NOT NULL,
        action_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_key, action_id)
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_aa_favorites_user ON administrative_action_favorites(user_key)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_aa_favorites_action ON administrative_action_favorites(action_id)`);

    // watched_organizations: 企業ウォッチ
    _db.exec(`
      CREATE TABLE IF NOT EXISTS watched_organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        organization_name TEXT NOT NULL,
        industry TEXT NOT NULL DEFAULT '',
        note TEXT,
        last_seen_action_date TEXT,
        last_notified_action_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, organization_name, industry)
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_watched_orgs_user ON watched_organizations(user_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_watched_orgs_name ON watched_organizations(organization_name)`);
    // 既存テーブルへのカラム追加（冪等）
    try { _db.exec("ALTER TABLE watched_organizations ADD COLUMN last_notified_action_date TEXT"); } catch {}

    // risk_alerts: 行政処分アラート（一般ユーザー向け）
    _db.exec(`
      CREATE TABLE IF NOT EXISTS risk_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        watched_org_id INTEGER REFERENCES watched_organizations(id) ON DELETE CASCADE,
        action_id INTEGER REFERENCES administrative_actions(id) ON DELETE CASCADE,
        organization_name TEXT NOT NULL,
        industry TEXT NOT NULL DEFAULT '',
        action_type TEXT NOT NULL DEFAULT 'other',
        action_date TEXT,
        title TEXT NOT NULL,
        body TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_risk_alerts_user ON risk_alerts(user_id)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_risk_alerts_read ON risk_alerts(user_id, is_read)`);
    _db.exec(`CREATE INDEX IF NOT EXISTS idx_risk_alerts_created ON risk_alerts(created_at)`);
    // 冪等性保証: (user_id, action_id) 重複挿入防止
    _db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_alerts_unique ON risk_alerts(user_id, action_id) WHERE action_id IS NOT NULL`);
  }
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
