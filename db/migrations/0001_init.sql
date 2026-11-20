-- =====================================================================
-- «Созвездие» — стартовая схема БД (MVP), версия v03
-- PostgreSQL 16+. Применять в пустую базу:  psql -d sozvezdie -f 0001_init.sql
-- Основа: db-structure.md от 19.11.2026 + закрытие открытых вопросов 1, 4–10.
-- Решения, принятые в этой версии, помечены «-- РЕШЕНИЕ v03».
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Перечисления
-- Значения рабочего стиля совпадают с фронтом (src/lib/team-search/types.ts),
-- чтобы у заказчика и специалиста были одни и те же варианты (вопрос №4).
-- ---------------------------------------------------------------------
CREATE TYPE user_status          AS ENUM ('active', 'blocked', 'deleted');
CREATE TYPE auth_provider        AS ENUM ('sms', 'password', 'vk_id', 'yandex_id');
CREATE TYPE consent_type         AS ENUM ('pdn_processing', 'terms', 'marketing', 'analytics_cookies', 'calendar_import');
CREATE TYPE legal_status         AS ENUM ('self_employed', 'ip', 'ooo', 'individual');
CREATE TYPE skill_level          AS ENUM ('junior', 'middle', 'senior', 'lead');
CREATE TYPE rate_unit            AS ENUM ('shift', 'day', 'project', 'hour');
CREATE TYPE org_type             AS ENUM ('agency', 'brand', 'production', 'other');
CREATE TYPE org_member_role      AS ENUM ('owner', 'admin', 'member');

CREATE TYPE revisions_pref       AS ENUM ('1', '2-3', '4+');
CREATE TYPE involvement_pref     AS ENUM ('freedom', 'stages', 'every_step');
CREATE TYPE comm_channel         AS ENUM ('telegram', 'email', 'calls');
CREATE TYPE work_pace            AS ENUM ('fast', 'thorough');
CREATE TYPE test_task_policy     AS ENUM ('no_test', 'paid_only', 'free_small', 'discuss');

CREATE TYPE availability_status  AS ENUM ('busy', 'tentative');
CREATE TYPE availability_source  AS ENUM ('manual', 'platform_project', 'calendar_import');
CREATE TYPE calendar_provider    AS ENUM ('ics_url', 'caldav', 'google', 'yandex');
CREATE TYPE connection_status    AS ENUM ('active', 'error', 'revoked');

CREATE TYPE media_type           AS ENUM ('image', 'video');
CREATE TYPE processing_status    AS ENUM ('pending', 'ready', 'failed');
CREATE TYPE item_visibility      AS ENUM ('public', 'link_only', 'private');
CREATE TYPE moderation_status    AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE project_status       AS ENUM ('draft', 'matching', 'team_selected', 'in_progress', 'delivered', 'cancelled');
CREATE TYPE budget_flex          AS ENUM ('strict', 'pm15', 'negotiable');
CREATE TYPE budget_scope         AS ENUM ('fees', 'fees_equipment');
CREATE TYPE slot_status          AS ENUM ('open', 'manual', 'filled', 'cancelled');
CREATE TYPE team_tier            AS ENUM ('economy', 'optimum', 'premium');
-- РЕШЕНИЕ v03 (вопрос №9): добавлен cancelled — «принял, потом отказался»
CREATE TYPE invitation_status    AS ENUM ('sent', 'viewed', 'accepted', 'declined', 'expired', 'withdrawn', 'cancelled');
CREATE TYPE review_direction     AS ENUM ('client_to_specialist', 'specialist_to_client', 'specialist_to_specialist');
CREATE TYPE yes_no_unsure        AS ENUM ('yes', 'no', 'unsure');
CREATE TYPE rec_event            AS ENUM ('shown', 'opened_card', 'swapped', 'chosen', 'invited', 'accepted', 'declined', 'cancelled');
CREATE TYPE manual_match_status  AS ENUM ('open', 'in_progress', 'done', 'cancelled');
CREATE TYPE notification_channel AS ENUM ('sms', 'email', 'web_push');
CREATE TYPE moderation_entity    AS ENUM ('profile', 'portfolio_item', 'review', 'verification');
CREATE TYPE moderation_action    AS ENUM ('approve', 'reject', 'request_changes', 'verify', 'unverify');

-- Общий триггер updated_at
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- 1. Справочники. code — стабильный ключ, тот же, что во фронте.
-- ---------------------------------------------------------------------
CREATE TABLE cities (
  id     smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  region     text NOT NULL,
  metro_area text NOT NULL   -- агломерация: Петербург и Ленобласть считаем одним городом при подборе
);

CREATE TABLE roles (
  id                smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code              text NOT NULL UNIQUE,
  name              text NOT NULL,
  category          text NOT NULL,                 -- production / camera / light / sound / art / post
  default_rate_unit rate_unit NOT NULL,
  budget_share      smallint NOT NULL CHECK (budget_share BETWEEN 0 AND 100), -- типовая доля для «рассчитаем», %
  is_post           boolean NOT NULL DEFAULT false, -- занятость проверяем по окну постпродакшна, а не по дням съёмки
  remote_ok         boolean NOT NULL DEFAULT false,
  is_mvp            boolean NOT NULL DEFAULT true
);

CREATE TABLE formats (
  id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE style_tags (
  id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL
);

-- ---------------------------------------------------------------------
-- 2. Аккаунт и вход
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone              text,                          -- E.164: +79991234567; NULL только у обезличенных
  phone_verified_at  timestamptz,
  email              text,
  email_verified_at  timestamptz,
  password_hash      text,
  adult_confirmed_at timestamptz,                   -- подтверждение 18+ при регистрации
  status             user_status NOT NULL DEFAULT 'active',
  timezone           text NOT NULL DEFAULT 'Europe/Moscow',
  signup_source      text,
  invited_by         uuid REFERENCES users (id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_login_at      timestamptz,
  deleted_at         timestamptz,
  CONSTRAINT users_phone_format CHECK (phone ~ '^\+[1-9][0-9]{9,14}$'),
  CONSTRAINT users_phone_required CHECK (phone IS NOT NULL OR status = 'deleted'),
  CONSTRAINT users_deleted_consistent CHECK ((status = 'deleted') = (deleted_at IS NOT NULL)),
  CONSTRAINT users_not_self_invited CHECK (invited_by <> id)
);
-- РЕШЕНИЕ v03 (вопросы №6, №8): телефон уникален; email уникален без учёта регистра
CREATE UNIQUE INDEX users_phone_uq ON users (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX users_email_uq ON users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE auth_identities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id),
  provider         auth_provider NOT NULL,
  provider_user_id text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX auth_identities_user_idx ON auth_identities (user_id);

-- РЕШЕНИЕ v03 (вопрос №6): сессии сайта в cookie — храним только хеш токена
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id),
  token_hash   bytea NOT NULL UNIQUE,               -- sha256 от токена из cookie
  user_agent   text,
  device       text,
  ip           inet,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user_active_idx ON sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE consents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id),
  consent_type consent_type NOT NULL,
  text_version text NOT NULL,                       -- версия текста согласия, которую видел человек
  granted_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,
  ip           inet,
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
-- одно действующее согласие каждого типа
CREATE UNIQUE INDEX consents_active_uq ON consents (user_id, consent_type) WHERE revoked_at IS NULL;

-- Каналы уведомлений (решение 05.11: сайт без push → SMS и email)
CREATE TABLE notification_preferences (
  user_id    uuid NOT NULL REFERENCES users (id),
  channel    notification_channel NOT NULL,
  event_type text NOT NULL,                         -- invitation_new, invitation_answered, project_update, …
  enabled    boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel, event_type)
);

-- ---------------------------------------------------------------------
-- 3. Профиль и режимы
-- ---------------------------------------------------------------------
CREATE TABLE profiles (
  user_id             uuid PRIMARY KEY REFERENCES users (id),
  display_name        text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 80),
  show_full_last_name boolean NOT NULL DEFAULT false,
  avatar_key          text,
  city_id             smallint REFERENCES cities (id),
  bio                 text CHECK (length(bio) <= 2000),
  slug                text NOT NULL,
  links               jsonb NOT NULL DEFAULT '{}'::jsonb,
  contacts_hidden     boolean NOT NULL DEFAULT true,
  client_mode         boolean NOT NULL DEFAULT false,
  specialist_mode     boolean NOT NULL DEFAULT false,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- РЕШЕНИЕ v03: адрес профиля только латиница, цифры, «-» и «_» (обсуждение 19.11, ошибка /u/…%20…)
  CONSTRAINT profiles_slug_format CHECK (slug ~ '^[a-z0-9](?:[a-z0-9_-]{1,30}[a-z0-9])$'),
  CONSTRAINT profiles_has_mode CHECK (client_mode OR specialist_mode)
);
CREATE UNIQUE INDEX profiles_slug_uq ON profiles (lower(slug));
CREATE TRIGGER profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Старые адреса профиля → 301 на новый, чтобы не ломались ссылки в чужих портфолио
CREATE TABLE profile_slug_history (
  slug       text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE specialist_settings (
  user_id             uuid PRIMARY KEY REFERENCES users (id),
  open_to_work        boolean NOT NULL DEFAULT true,
  travel_ready        boolean NOT NULL DEFAULT false,
  legal_status        legal_status NOT NULL,
  format_ids          smallint[] NOT NULL DEFAULT '{}',   -- без FK: проверяет приложение
  style_tag_ids       smallint[] NOT NULL DEFAULT '{}',
  verification_level  smallint NOT NULL DEFAULT 0 CHECK (verification_level BETWEEN 0 AND 3),
  completeness        smallint NOT NULL DEFAULT 0 CHECK (completeness BETWEEN 0 AND 100),
  response_rate       numeric(4,3) CHECK (response_rate BETWEEN 0 AND 1),
  median_response_h   numeric(6,1) CHECK (median_response_h >= 0),
  calendar_updated_at timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX specialist_settings_open_idx ON specialist_settings (user_id) WHERE open_to_work;
CREATE INDEX specialist_settings_tags_gin ON specialist_settings USING gin (style_tag_ids);
CREATE TRIGGER specialist_settings_updated BEFORE UPDATE ON specialist_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE specialist_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id),
  role_id    smallint NOT NULL REFERENCES roles (id),
  level      skill_level NOT NULL,
  years      smallint NOT NULL CHECK (years BETWEEN 0 AND 70),
  is_primary boolean NOT NULL DEFAULT false,
  rate_min   integer NOT NULL CHECK (rate_min > 0),
  rate_unit  rate_unit NOT NULL,
  role_attrs jsonb NOT NULL DEFAULT '{}'::jsonb,       -- своя техника, программы и т. п.
  UNIQUE (user_id, role_id)
);
-- РЕШЕНИЕ v03 (вопрос №8): ровно одна основная роль
CREATE UNIQUE INDEX specialist_roles_primary_uq ON specialist_roles (user_id) WHERE is_primary;
CREATE INDEX specialist_roles_match_idx ON specialist_roles (role_id, level);

-- Правило: 1 основная + до 3 дополнительных ролей
CREATE FUNCTION check_max_roles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM specialist_roles WHERE user_id = NEW.user_id) > 4 THEN
    RAISE EXCEPTION 'У специалиста не больше 4 ролей (1 основная + 3 дополнительные)' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER specialist_roles_max AFTER INSERT OR UPDATE ON specialist_roles
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_max_roles();

-- Рабочие предпочтения. Это заявленные предпочтения, не психотест.
-- РЕШЕНИЕ v03 (вопрос №4): четыре поля, общих с брифом, — enum, а не text.
-- РЕШЕНИЕ v03 (вопрос №10): поля персонального тестового задания (макет 18.11).
CREATE TABLE work_style (
  user_id              uuid PRIMARY KEY REFERENCES users (id),
  comm_channel         comm_channel,
  revisions            revisions_pref,
  involvement          involvement_pref,
  pace                 work_pace,
  night_shifts_ok      boolean NOT NULL DEFAULT false,
  weekends_ok          boolean NOT NULL DEFAULT false,
  test_task_policy     test_task_policy,
  test_task_price      integer CHECK (test_task_price >= 0),
  test_task_max_hours  smallint CHECK (test_task_max_hours BETWEEN 1 AND 80),
  test_task_max_days   smallint CHECK (test_task_max_days BETWEEN 1 AND 30),
  test_task_credited   boolean,                        -- засчитывается в гонорар, если взяли в проект
  test_task_note       text CHECK (length(test_task_note) <= 1000),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (test_task_policy IS DISTINCT FROM 'paid_only' OR test_task_price > 0)
);
CREATE TRIGGER work_style_updated BEFORE UPDATE ON work_style FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  inn        text CHECK (inn ~ '^([0-9]{10}|[0-9]{12})$'),
  org_type   org_type NOT NULL,
  created_by uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organizations_inn_uq ON organizations (inn) WHERE inn IS NOT NULL;

CREATE TABLE organization_members (
  org_id      uuid NOT NULL REFERENCES organizations (id),
  user_id     uuid NOT NULL REFERENCES users (id),
  member_role org_member_role NOT NULL DEFAULT 'member',
  PRIMARY KEY (org_id, user_id)
);

-- ---------------------------------------------------------------------
-- 4. Портфолио
-- ---------------------------------------------------------------------
CREATE TABLE portfolio_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users (id),
  title             text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  format_id         smallint REFERENCES formats (id),
  year              smallint CHECK (year BETWEEN 1950 AND 2100),
  description       text,
  my_role_id        smallint REFERENCES roles (id),
  role_note         text,
  client_name       text,
  client_hidden     boolean NOT NULL DEFAULT false,
  style_tag_ids     smallint[] NOT NULL DEFAULT '{}',
  tech_stack        jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_sec      integer CHECK (duration_sec > 0),
  external_url      text,
  external_platform text,
  visibility        item_visibility NOT NULL DEFAULT 'public',
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  is_featured       boolean NOT NULL DEFAULT false,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_items_user_idx ON portfolio_items (user_id, sort_order);
CREATE INDEX portfolio_items_tags_gin ON portfolio_items USING gin (style_tag_ids);
CREATE TRIGGER portfolio_items_updated BEFORE UPDATE ON portfolio_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE portfolio_media (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           uuid NOT NULL REFERENCES portfolio_items (id) ON DELETE CASCADE,
  media_type        media_type NOT NULL,
  storage_key       text NOT NULL,
  mime              text NOT NULL,
  size_bytes        bigint NOT NULL CHECK (size_bytes > 0),
  duration_sec      integer CHECK (duration_sec > 0),
  processing_status processing_status NOT NULL DEFAULT 'pending',
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_media_item_idx ON portfolio_media (item_id, sort_order);

CREATE TABLE portfolio_credits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES portfolio_items (id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users (id),
  external_name text,                                 -- участник не на платформе
  role_id       smallint NOT NULL REFERENCES roles (id),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz,
  CHECK (user_id IS NOT NULL OR external_name IS NOT NULL),
  CHECK (confirmed_at IS NULL OR user_id IS NOT NULL)
);
CREATE INDEX portfolio_credits_user_idx ON portfolio_credits (user_id) WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 5. Календарь
-- ---------------------------------------------------------------------
-- РЕШЕНИЕ v03 (вопрос №10): импорт внешнего календаря — только занятость, без названий событий
CREATE TABLE calendar_connections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users (id),
  provider           calendar_provider NOT NULL,
  feed_url_encrypted bytea,                            -- ссылка на ICS — секрет, храним зашифрованной
  status             connection_status NOT NULL DEFAULT 'active',
  last_synced_at     timestamptz,
  last_error         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  revoked_at         timestamptz,
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);
CREATE INDEX calendar_connections_user_idx ON calendar_connections (user_id) WHERE revoked_at IS NULL;

-- projects объявлен ниже, FK на него добавляется после создания таблицы
CREATE TABLE availability (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users (id),
  date_from     date NOT NULL,
  date_to       date NOT NULL,
  status        availability_status NOT NULL DEFAULT 'busy',
  source        availability_source NOT NULL,
  project_id    uuid,
  connection_id uuid REFERENCES calendar_connections (id) ON DELETE CASCADE,
  external_uid  text,                                  -- UID события из ICS, для повторной синхронизации
  private_note  text,                                  -- видит только сам специалист
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (date_from <= date_to),
  CHECK ((source = 'calendar_import') = (connection_id IS NOT NULL)),
  CHECK ((source = 'platform_project') = (project_id IS NOT NULL)),
  CHECK (source <> 'calendar_import' OR private_note IS NULL)  -- названия чужих событий не храним
);
CREATE INDEX availability_user_dates_idx ON availability (user_id, date_from, date_to);
CREATE UNIQUE INDEX availability_import_uq ON availability (connection_id, external_uid) WHERE connection_id IS NOT NULL;
CREATE TRIGGER availability_updated BEFORE UPDATE ON availability FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Проекты и подбор
-- ---------------------------------------------------------------------
CREATE TABLE projects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id         uuid REFERENCES users (id),
  owner_org_id          uuid REFERENCES organizations (id),
  created_by            uuid NOT NULL REFERENCES users (id),
  title                 text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  format_id             smallint REFERENCES formats (id),
  goal                  text,
  city_id               smallint REFERENCES cities (id),
  prep_start            date,
  shoot_dates           date[] NOT NULL DEFAULT '{}',
  delivery_date         date,
  budget_min            integer CHECK (budget_min >= 0),
  budget_max            integer CHECK (budget_max > 0),
  budget_flex           budget_flex NOT NULL DEFAULT 'pm15',
  budget_scope          budget_scope NOT NULL DEFAULT 'fees',
  style_tag_ids         smallint[] NOT NULL DEFAULT '{}',
  expected_revisions    revisions_pref,
  client_involvement    involvement_pref,
  comm_channel          comm_channel,
  pace                  work_pace,
  required_legal_status legal_status[] NOT NULL DEFAULT '{self_employed,ip}',
  status                project_status NOT NULL DEFAULT 'draft',
  version               integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_one_owner CHECK (num_nonnulls(owner_user_id, owner_org_id) = 1),
  CONSTRAINT projects_budget_range CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max),
  -- уйти из черновика можно только с заполненными обязательными полями брифа
  CONSTRAINT projects_ready_for_matching CHECK (
    status IN ('draft', 'cancelled') OR (
      format_id IS NOT NULL AND city_id IS NOT NULL AND cardinality(shoot_dates) > 0
      AND delivery_date IS NOT NULL AND budget_max IS NOT NULL AND cardinality(required_legal_status) > 0
    )
  )
);
CREATE INDEX projects_owner_user_idx ON projects (owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX projects_owner_org_idx ON projects (owner_org_id) WHERE owner_org_id IS NOT NULL;
CREATE INDEX projects_status_idx ON projects (status);
CREATE TRIGGER projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE availability ADD CONSTRAINT availability_project_fk FOREIGN KEY (project_id) REFERENCES projects (id);

CREATE TABLE project_versions (
  project_id uuid NOT NULL REFERENCES projects (id),
  version    integer NOT NULL CHECK (version >= 1),
  snapshot   jsonb NOT NULL,                        -- бриф целиком на момент запуска подбора
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, version)
);

CREATE TABLE project_references (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  url        text NOT NULL CHECK (url ~* '^https?://'),
  comment    text,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX project_references_project_idx ON project_references (project_id, sort_order);

-- РЕШЕНИЕ v03 (вопрос №1): слоты принадлежат версии брифа.
-- При version+1 бэкенд копирует слоты в новую версию; старые конфигурации ссылаются на свои слоты.
CREATE TABLE role_slots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL,
  project_version  integer NOT NULL,
  role_id          smallint NOT NULL REFERENCES roles (id),
  qty              smallint NOT NULL DEFAULT 1 CHECK (qty BETWEEN 1 AND 20),
  level_min        skill_level,                        -- NULL = «любой»
  shifts           smallint CHECK (shifts BETWEEN 1 AND 60),
  slot_budget      integer CHECK (slot_budget > 0),     -- на роль целиком; NULL = «рассчитаем»
  budget_estimated boolean NOT NULL DEFAULT false,
  must_have        boolean NOT NULL DEFAULT true,
  requirements     jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           slot_status NOT NULL DEFAULT 'open',
  sort_order       integer NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id, project_version) REFERENCES project_versions (project_id, version),
  UNIQUE (id, project_id),
  UNIQUE (id, project_id, project_version)
);
CREATE INDEX role_slots_project_idx ON role_slots (project_id, project_version, sort_order);

CREATE TABLE team_configurations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL,
  project_version   integer NOT NULL,
  tier              team_tier NOT NULL,
  total_cost        integer NOT NULL CHECK (total_cost >= 0),
  team_score        numeric(5,2) NOT NULL CHECK (team_score BETWEEN 0 AND 100),
  algorithm_version text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  chosen_at         timestamptz,
  FOREIGN KEY (project_id, project_version) REFERENCES project_versions (project_id, version),
  UNIQUE (project_id, project_version, tier),       -- вопрос №8
  UNIQUE (id, project_id),
  UNIQUE (id, project_id, project_version)
);
-- в каждой версии брифа выбран не больше чем один состав
CREATE UNIQUE INDEX team_configurations_chosen_uq ON team_configurations (project_id, project_version) WHERE chosen_at IS NOT NULL;

-- Кандидат и слот гарантированно из того же проекта и той же версии брифа, что и конфигурация
CREATE TABLE configuration_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id uuid NOT NULL,
  project_id       uuid NOT NULL,
  project_version  integer NOT NULL,
  slot_id          uuid NOT NULL,
  specialist_id    uuid NOT NULL REFERENCES users (id),
  score            numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  score_breakdown  jsonb NOT NULL,                   -- {portfolio, role, budget, reliability, availability, workStyle}
  cost             integer NOT NULL CHECK (cost >= 0),
  rank             smallint NOT NULL,
  is_alternative   boolean NOT NULL DEFAULT false,
  relaxed          boolean NOT NULL DEFAULT false,    -- попал после ослабления фильтров
  flags            jsonb NOT NULL DEFAULT '[]'::jsonb,
  FOREIGN KEY (configuration_id, project_id, project_version) REFERENCES team_configurations (id, project_id, project_version) ON DELETE CASCADE,
  FOREIGN KEY (slot_id, project_id, project_version) REFERENCES role_slots (id, project_id, project_version),
  UNIQUE (configuration_id, slot_id, specialist_id)
);
CREATE INDEX configuration_members_specialist_idx ON configuration_members (specialist_id);

CREATE TABLE invitations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL,
  slot_id          uuid NOT NULL,
  configuration_id uuid,
  specialist_id    uuid NOT NULL REFERENCES users (id),
  replaces_id      uuid REFERENCES invitations (id),  -- замена после отказа
  cost             integer NOT NULL CHECK (cost >= 0),
  status           invitation_status NOT NULL DEFAULT 'sent',
  decline_reason   text,
  cancel_reason    text,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  viewed_at        timestamptz,
  responded_at     timestamptz,
  cancelled_at     timestamptz,
  expires_at       timestamptz NOT NULL,
  FOREIGN KEY (slot_id, project_id) REFERENCES role_slots (id, project_id),
  FOREIGN KEY (configuration_id, project_id) REFERENCES team_configurations (id, project_id),
  CHECK (expires_at > sent_at),
  CHECK (status NOT IN ('accepted', 'declined') OR responded_at IS NOT NULL),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CHECK (status <> 'cancelled' OR cancel_reason IS NOT NULL)
);
-- вопрос №8: одно активное приглашение на пару «слот — специалист»
CREATE UNIQUE INDEX invitations_active_uq ON invitations (slot_id, specialist_id) WHERE status IN ('sent', 'viewed', 'accepted');
CREATE INDEX invitations_specialist_open_idx ON invitations (specialist_id) WHERE status IN ('sent', 'viewed');
CREATE INDEX invitations_project_idx ON invitations (project_id, slot_id);
CREATE INDEX invitations_expiry_idx ON invitations (expires_at) WHERE status IN ('sent', 'viewed');

-- Правило: у специалиста не больше 3 открытых приглашений
CREATE FUNCTION check_open_invitations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('sent', 'viewed') AND
     (SELECT count(*) FROM invitations WHERE specialist_id = NEW.specialist_id AND status IN ('sent', 'viewed')) > 3 THEN
    RAISE EXCEPTION 'У специалиста уже 3 открытых приглашения' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER invitations_open_limit AFTER INSERT OR UPDATE OF status ON invitations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_open_invitations();

CREATE TABLE reviews (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid NOT NULL REFERENCES projects (id),
  author_id          uuid NOT NULL REFERENCES users (id),
  target_id          uuid NOT NULL REFERENCES users (id),
  direction          review_direction NOT NULL,
  quality            smallint CHECK (quality BETWEEN 1 AND 5),
  deadlines          smallint CHECK (deadlines BETWEEN 1 AND 5),
  communication      smallint CHECK (communication BETWEEN 1 AND 5),
  revisions_handling smallint CHECK (revisions_handling BETWEEN 1 AND 5),
  would_work_again   yes_no_unsure NOT NULL,
  comment            text CHECK (length(comment) <= 2000),
  comment_moderation moderation_status NOT NULL DEFAULT 'pending',
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, author_id, target_id),          -- вопрос №8
  CHECK (author_id <> target_id)
);
CREATE INDEX reviews_target_idx ON reviews (target_id);

-- Журнал рекомендаций — ведём с первого дня (обучающая выборка для будущей модели)
CREATE TABLE recommendation_log (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id       uuid NOT NULL REFERENCES projects (id),
  configuration_id uuid,
  slot_id          uuid,
  specialist_id    uuid REFERENCES users (id),
  event            rec_event NOT NULL,
  position         smallint,
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (configuration_id, project_id) REFERENCES team_configurations (id, project_id),
  FOREIGN KEY (slot_id, project_id) REFERENCES role_slots (id, project_id)
);
CREATE INDEX recommendation_log_project_idx ON recommendation_log (project_id, created_at);

-- Вычисляемая таблица «работали вместе» (после пилота наполняется из портфолио и проектов)
CREATE TABLE collaboration_edges (
  user_a             uuid NOT NULL REFERENCES users (id),
  user_b             uuid NOT NULL REFERENCES users (id),
  portfolio_projects smallint NOT NULL DEFAULT 0,
  platform_projects  smallint NOT NULL DEFAULT 0,
  last_together      date,
  mutual_yes         boolean NOT NULL DEFAULT false,  -- оба ответили «работал бы снова»
  any_no             boolean NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);
CREATE INDEX collaboration_edges_b_idx ON collaboration_edges (user_b);

-- РЕШЕНИЕ v03 (вопрос №5): ручной подбор как очередь задач для команды платформы
CREATE TABLE manual_match_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL,
  slot_id     uuid NOT NULL,
  status      manual_match_status NOT NULL DEFAULT 'open',
  reason      text NOT NULL,                          -- «кандидатов < 2 после ослаблений»
  assigned_to uuid REFERENCES users (id),
  due_at      timestamptz NOT NULL,                   -- обещание заказчику: 24 часа
  created_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz,
  result_note text,
  FOREIGN KEY (slot_id, project_id) REFERENCES role_slots (id, project_id),
  CHECK ((status IN ('done', 'cancelled')) = (closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX manual_match_open_uq ON manual_match_requests (slot_id) WHERE status IN ('open', 'in_progress');
CREATE INDEX manual_match_queue_idx ON manual_match_requests (due_at) WHERE status IN ('open', 'in_progress');

-- РЕШЕНИЕ v03 (вопрос №7): единый журнал модерации и проверок
CREATE TABLE moderation_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type  moderation_entity NOT NULL,
  entity_id    uuid NOT NULL,
  moderator_id uuid NOT NULL REFERENCES users (id),
  action       moderation_action NOT NULL,
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_events_entity_idx ON moderation_events (entity_type, entity_id, created_at);

COMMIT;
