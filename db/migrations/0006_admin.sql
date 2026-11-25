-- =====================================================================
-- «Созвездие» — режим администратора (сотрудники платформы).
--
-- РЕШЕНИЕ (25.11): админка — для команды платформы, а не для владельцев организаций.
--   Роли сотрудников:
--     admin     — всё, включая выдачу ролей, смену статуса проекта и журнал действий;
--     moderator — пользователи (блокировка), аватары;
--     matcher   — очередь ручного подбора, просмотр проектов и карточек пользователей.
--   Права по ролям описаны в коде (src/server/admin/access.ts), в базе — только сама роль.
--   Админом нельзя стать через интерфейс: первую роль выдаёт db/scripts/grant-staff.sql.
--
-- 152-ФЗ: сотрудники видят телефоны и профили. Поэтому журнал пишет не только изменения,
--   но и просмотры карточек пользователей и проектов. Журнал только дописывается.
-- =====================================================================

BEGIN;

CREATE TYPE staff_role AS ENUM ('admin', 'moderator', 'matcher');

-- Роль сотрудника. История сохраняется: отзыв = revoked_at, новая роль = новая строка.
CREATE TABLE staff_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id),
  role        staff_role NOT NULL,
  granted_by  uuid REFERENCES users (id),             -- NULL — выдано скриптом из консоли
  granted_at  timestamptz NOT NULL DEFAULT now(),
  revoked_by  uuid REFERENCES users (id),
  revoked_at  timestamptz,
  note        text CHECK (length(note) <= 500),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at),
  CHECK (granted_by IS NULL OR granted_by <> user_id)  -- себе роль не выдают
);
-- у человека одна действующая роль
CREATE UNIQUE INDEX staff_members_active_uq ON staff_members (user_id) WHERE revoked_at IS NULL;

-- Блокировка: статус 'blocked' уже есть в user_status, добавляем когда, кто и почему.
ALTER TABLE users
  ADD COLUMN blocked_at   timestamptz,
  ADD COLUMN blocked_by   uuid REFERENCES users (id),
  ADD COLUMN block_reason text CHECK (length(block_reason) BETWEEN 3 AND 500);
ALTER TABLE users
  ADD CONSTRAINT users_blocked_consistent CHECK ((status = 'blocked') = (blocked_at IS NOT NULL)),
  ADD CONSTRAINT users_blocked_reason CHECK (status <> 'blocked' OR block_reason IS NOT NULL);

-- Журнал действий сотрудников. Только INSERT: изменить или удалить запись нельзя даже админу.
CREATE TABLE admin_audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    uuid REFERENCES users (id),             -- NULL — скрипт из консоли
  action      text NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),  -- user.block, project.view …
  entity_type text NOT NULL CHECK (entity_type IN ('user', 'project', 'match_request', 'staff', 'avatar')),
  entity_id   uuid,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,     -- причина, было/стало; без телефонов и текстов брифа
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_entity_idx ON admin_audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX admin_audit_actor_idx ON admin_audit_log (actor_id, created_at DESC);
CREATE INDEX admin_audit_created_idx ON admin_audit_log (created_at DESC);

CREATE FUNCTION admin_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Журнал действий нельзя менять или удалять' USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER admin_audit_no_update BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION admin_audit_append_only();

-- Ручной подбор: кто взял заявку и когда (assigned_to уже есть)
ALTER TABLE manual_match_requests ADD COLUMN assigned_at timestamptz;
ALTER TABLE manual_match_requests
  ADD CONSTRAINT manual_match_assigned CHECK (status <> 'in_progress' OR assigned_to IS NOT NULL);

COMMIT;
