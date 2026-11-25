-- Демо-сотрудники для локальной разработки админки. На стенд и в прод не применять:
-- там первого админа выдаёт db/scripts/grant-staff.sql по телефону живого человека.
--
-- Входы (код в режиме разработки — 1234):
--   +7 999 100-99-98 — админ
--   +7 999 100-99-97 — модератор
--   +7 999 100-99-96 — подборщик (ручной подбор)

BEGIN;

INSERT INTO users (id, phone, phone_verified_at, adult_confirmed_at, signup_source) VALUES
  ('ad000000-0000-4000-8000-000000000001', '+79991009998', now(), now(), 'seed'),
  ('ad000000-0000-4000-8000-000000000002', '+79991009997', now(), now(), 'seed'),
  ('ad000000-0000-4000-8000-000000000003', '+79991009996', now(), now(), 'seed')
ON CONFLICT DO NOTHING;

-- Профиль нужен, иначе кабинет уводит на онбординг. Режим заказчика — чтобы сотрудник мог проверять сценарии сам.
INSERT INTO profiles (user_id, display_name, slug, client_mode) VALUES
  ('ad000000-0000-4000-8000-000000000001', 'Админ Созвездия', 'demo-staff-admin', true),
  ('ad000000-0000-4000-8000-000000000002', 'Модератор Созвездия', 'demo-staff-moderator', true),
  ('ad000000-0000-4000-8000-000000000003', 'Подборщик Созвездия', 'demo-staff-matcher', true)
ON CONFLICT DO NOTHING;

INSERT INTO staff_members (user_id, role, note)
SELECT u, r::staff_role, 'демо-сид'
FROM (VALUES ('ad000000-0000-4000-8000-000000000001'::uuid, 'admin'),
             ('ad000000-0000-4000-8000-000000000002'::uuid, 'moderator'),
             ('ad000000-0000-4000-8000-000000000003'::uuid, 'matcher')) AS v(u, r)
WHERE NOT EXISTS (SELECT 1 FROM staff_members s WHERE s.user_id = v.u AND s.revoked_at IS NULL);

COMMIT;
