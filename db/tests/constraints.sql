-- Проверка правил целостности на демо-данных. Ничего не меняет: всё в откатываемой транзакции.
--   psql -d sozvezdie -f db/tests/constraints.sql
-- Каждая строка вывода: PASS — ограничение сработало, FAIL — пропустило ошибку.

BEGIN;

CREATE TEMP TABLE results (n serial, name text, ok boolean);

CREATE FUNCTION pg_temp.expect_error(p_name text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    SET CONSTRAINTS ALL IMMEDIATE;   -- проверяем отложенные триггеры сразу
    INSERT INTO results (name, ok) VALUES (p_name, false);
    RAISE EXCEPTION 'rollback_case';
  EXCEPTION
    WHEN raise_exception THEN NULL;  -- наш откат после FAIL
    WHEN OTHERS THEN INSERT INTO results (name, ok) VALUES (p_name, true);
  END;
  SET CONSTRAINTS ALL DEFERRED;
END $$;

CREATE FUNCTION pg_temp.expect_ok(p_name text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  INSERT INTO results (name, ok) VALUES (p_name, true);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results (name, ok) VALUES (p_name || ' — ' || SQLERRM, false);
END $$;

-- ---------- Аккаунт и профиль ----------
SELECT pg_temp.expect_error('Телефон уникален',
  $q$INSERT INTO users (phone) VALUES ('+79991000001')$q$);
SELECT pg_temp.expect_error('Телефон в формате E.164',
  $q$INSERT INTO users (phone) VALUES ('8 999 123-45-67')$q$);
SELECT pg_temp.expect_error('Адрес профиля без пробелов (кейс /u/…%20…)',
  $q$UPDATE profiles SET slug = 'the_feature_is bugging' WHERE slug = 'demo-ficha-bagova'$q$);
SELECT pg_temp.expect_error('Адрес профиля уникален',
  $q$UPDATE profiles SET slug = 'demo-ficha-bagova' WHERE slug = 'demo-ivan-t'$q$);
SELECT pg_temp.expect_error('Одно действующее согласие каждого типа',
  $q$INSERT INTO consents (user_id, consent_type, text_version) SELECT user_id, 'pdn_processing', 'v2' FROM profiles WHERE slug = 'demo-ficha-bagova'$q$);

-- ---------- Роли специалиста ----------
SELECT pg_temp.expect_error('Только одна основная роль',
  $q$INSERT INTO specialist_roles (user_id, role_id, level, years, is_primary, rate_min, rate_unit)
     SELECT user_id, (SELECT id FROM roles WHERE code = 'gaffer'), 'middle', 3, true, 30000, 'shift' FROM profiles WHERE slug = 'demo-ficha-bagova'$q$);
SELECT pg_temp.expect_ok('Дополнительные роли: до трёх',
  $q$INSERT INTO specialist_roles (user_id, role_id, level, years, rate_min, rate_unit)
     SELECT p.user_id, r.id, 'middle', 3, 30000, 'shift' FROM profiles p, roles r
     WHERE p.slug = 'demo-ficha-bagova' AND r.code IN ('gaffer', 'art', 'director')$q$);
SELECT pg_temp.expect_error('Пятая роль запрещена',
  $q$INSERT INTO specialist_roles (user_id, role_id, level, years, rate_min, rate_unit)
     SELECT user_id, (SELECT id FROM roles WHERE code = 'sound'), 'middle', 3, 20000, 'shift' FROM profiles WHERE slug = 'demo-ficha-bagova'$q$);

-- ---------- Календарь ----------
SELECT pg_temp.expect_error('Импорт календаря только с подключением',
  $q$INSERT INTO availability (user_id, date_from, date_to, source) SELECT user_id, '2026-12-01', '2026-12-01', 'calendar_import' FROM profiles WHERE slug = 'demo-ivan-t'$q$);
SELECT pg_temp.expect_error('Даты занятости: начало не позже конца',
  $q$INSERT INTO availability (user_id, date_from, date_to, source) SELECT user_id, '2026-12-05', '2026-12-01', 'manual' FROM profiles WHERE slug = 'demo-ivan-t'$q$);

-- ---------- Проекты ----------
SELECT pg_temp.expect_error('Владелец проекта — ровно один (человек или компания)',
  $q$INSERT INTO projects (created_by, title) SELECT id, 'x' FROM users WHERE phone = '+79991009999'$q$);
SELECT pg_temp.expect_error('Из черновика — только с полным брифом',
  $q$INSERT INTO projects (owner_user_id, created_by, title, status) SELECT id, id, 'x', 'matching' FROM users WHERE phone = '+79991009999'$q$);
SELECT pg_temp.expect_error('Бюджет: от ≤ до',
  $q$UPDATE projects SET budget_min = 900000 WHERE title LIKE 'Ролик к запуску%'$q$);

-- ---------- Версии брифа (вопрос №1) ----------
SELECT pg_temp.expect_error('Слот нельзя привязать к несуществующей версии брифа',
  $q$INSERT INTO role_slots (project_id, project_version, role_id) SELECT id, 2, 1 FROM projects WHERE title LIKE 'Ролик к запуску%'$q$);

SELECT pg_temp.expect_ok('Конфигурация версии 1 со своими слотами',
  $q$INSERT INTO team_configurations (id, project_id, project_version, tier, total_cost, team_score, algorithm_version)
     SELECT 'cf000000-0000-4000-8000-000000000001', id, 1, 'optimum', 476000, 92, 'rules-v1' FROM projects WHERE title LIKE 'Ролик к запуску%';
     INSERT INTO configuration_members (configuration_id, project_id, project_version, slot_id, specialist_id, score, score_breakdown, cost, rank)
     SELECT 'cf000000-0000-4000-8000-000000000001', s.project_id, 1, s.id, p.user_id, 95, '{}', 180000, 1
     FROM role_slots s, profiles p WHERE s.sort_order = 0 AND s.project_version = 1 AND p.slug = 'demo-ivan-t'$q$);

SELECT pg_temp.expect_ok('Бриф изменён: версия 2, слоты скопированы',
  $q$UPDATE projects SET version = 2, status = 'draft' WHERE title LIKE 'Ролик к запуску%';
     INSERT INTO project_versions (project_id, version, snapshot) SELECT id, 2, '{}' FROM projects WHERE title LIKE 'Ролик к запуску%';
     INSERT INTO role_slots (project_id, project_version, role_id, qty, level_min, shifts, slot_budget, must_have, sort_order)
     SELECT project_id, 2, role_id, qty, level_min, shifts, slot_budget, must_have, sort_order FROM role_slots WHERE project_version = 1$q$);

SELECT pg_temp.expect_error('Кандидат конфигурации v1 не может ссылаться на слот v2',
  $q$INSERT INTO configuration_members (configuration_id, project_id, project_version, slot_id, specialist_id, score, score_breakdown, cost, rank)
     SELECT 'cf000000-0000-4000-8000-000000000001', s.project_id, 1, s.id, p.user_id, 90, '{}', 120000, 1
     FROM role_slots s, profiles p WHERE s.sort_order = 1 AND s.project_version = 2 AND p.slug = 'demo-ficha-bagova'$q$);
SELECT pg_temp.expect_error('Один состав каждого уровня на версию',
  $q$INSERT INTO team_configurations (project_id, project_version, tier, total_cost, team_score, algorithm_version)
     SELECT id, 1, 'optimum', 1, 1, 'x' FROM projects WHERE title LIKE 'Ролик к запуску%'$q$);

-- ---------- Приглашения ----------
SELECT pg_temp.expect_ok('Приглашение отправлено',
  $q$INSERT INTO invitations (id, project_id, slot_id, specialist_id, cost, expires_at)
     SELECT 'a1000000-0000-4000-8000-000000000001', s.project_id, s.id, p.user_id, 120000, now() + interval '48 hours'
     FROM role_slots s, profiles p WHERE s.sort_order = 1 AND s.project_version = 1 AND p.slug = 'demo-ficha-bagova'$q$);
SELECT pg_temp.expect_error('Второе активное приглашение на тот же слот тому же человеку',
  $q$INSERT INTO invitations (project_id, slot_id, specialist_id, cost, expires_at)
     SELECT s.project_id, s.id, p.user_id, 120000, now() + interval '48 hours'
     FROM role_slots s, profiles p WHERE s.sort_order = 1 AND s.project_version = 1 AND p.slug = 'demo-ficha-bagova'$q$);
SELECT pg_temp.expect_error('Слот приглашения из другого проекта',
  $q$INSERT INTO projects (id, owner_user_id, created_by, title) SELECT 'b0000000-0000-4000-8000-0000000000ff', id, id, 'другой' FROM users WHERE phone = '+79991009999';
     INSERT INTO invitations (project_id, slot_id, specialist_id, cost, expires_at)
     SELECT 'b0000000-0000-4000-8000-0000000000ff', s.id, p.user_id, 1, now() + interval '1 day'
     FROM role_slots s, profiles p WHERE s.sort_order = 2 AND s.project_version = 1 AND p.slug = 'demo-timur-a'$q$);
SELECT pg_temp.expect_error('Не больше 3 открытых приглашений у специалиста',
  $q$INSERT INTO invitations (project_id, slot_id, specialist_id, cost, expires_at)
     SELECT s.project_id, s.id, p.user_id, 1, now() + interval '1 day'
     FROM role_slots s, profiles p WHERE s.sort_order IN (0, 2, 3) AND s.project_version = 1 AND p.slug = 'demo-ficha-bagova'$q$);
SELECT pg_temp.expect_error('Принятое приглашение — с датой ответа',
  $q$UPDATE invitations SET status = 'accepted' WHERE id = 'a1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_error('Отмена после принятия — только с причиной (вопрос №9)',
  $q$UPDATE invitations SET status = 'cancelled', cancelled_at = now() WHERE id = 'a1000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.expect_ok('Принял, потом отказался с причиной',
  $q$UPDATE invitations SET status = 'accepted', responded_at = now() WHERE id = 'a1000000-0000-4000-8000-000000000001';
     UPDATE invitations SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'Заболел' WHERE id = 'a1000000-0000-4000-8000-000000000001'$q$);

-- ---------- Отзывы и связи ----------
SELECT pg_temp.expect_error('Нельзя оставить отзыв самому себе',
  $q$INSERT INTO reviews (project_id, author_id, target_id, direction, would_work_again)
     SELECT pr.id, p.user_id, p.user_id, 'specialist_to_specialist', 'yes' FROM projects pr, profiles p WHERE pr.title LIKE 'Ролик к запуску%' AND p.slug = 'demo-ivan-t'$q$);
SELECT pg_temp.expect_error('Пара «работали вместе» хранится один раз (user_a < user_b)',
  $q$INSERT INTO collaboration_edges (user_a, user_b) SELECT GREATEST(user_a, user_b), LEAST(user_a, user_b) FROM collaboration_edges LIMIT 1$q$);
SELECT pg_temp.expect_error('Одна открытая заявка на ручной подбор на слот',
  $q$INSERT INTO manual_match_requests (project_id, slot_id, reason, due_at)
     SELECT project_id, id, 'мало кандидатов', now() + interval '24 hours' FROM role_slots WHERE sort_order = 5 AND project_version = 1;
     INSERT INTO manual_match_requests (project_id, slot_id, reason, due_at)
     SELECT project_id, id, 'повтор', now() + interval '24 hours' FROM role_slots WHERE sort_order = 5 AND project_version = 1$q$);

-- ---------- Медиафайлы и аватар (миграция 0005) ----------
SELECT pg_temp.expect_ok('Своя картинка в аватаре',
  $q$INSERT INTO media_files (id, owner_id, purpose, mime, size_bytes, width, height, sha256, data)
     SELECT 'f0000000-0000-4000-8000-000000000001', user_id, 'avatar', 'image/webp', 3, 1, 1, decode(repeat('ab', 32), 'hex'), '\x010203'
     FROM profiles WHERE slug = 'demo-ficha-bagova';
     UPDATE profiles SET avatar_media_id = 'f0000000-0000-4000-8000-000000000001' WHERE slug = 'demo-ficha-bagova'$q$);
SELECT pg_temp.expect_error('Чужая картинка в аватаре не ставится',
  $q$UPDATE profiles SET avatar_media_id = 'f0000000-0000-4000-8000-000000000001' WHERE slug = 'demo-ivan-t'$q$);
SELECT pg_temp.expect_error('Аватар — либо медведица, либо своя картинка',
  $q$UPDATE profiles SET avatar_preset = 'camera' WHERE slug = 'demo-ficha-bagova'$q$);
SELECT pg_temp.expect_error('Только известные медведицы',
  $q$UPDATE profiles SET avatar_preset = 'hacker' WHERE slug = 'demo-ivan-t'$q$);
SELECT pg_temp.expect_error('Размер файла совпадает с байтами',
  $q$INSERT INTO media_files (owner_id, purpose, mime, size_bytes, width, height, sha256, data)
     SELECT user_id, 'portfolio', 'image/webp', 99, 1, 1, decode(repeat('ab', 32), 'hex'), '\x010203' FROM profiles WHERE slug = 'demo-ivan-t'$q$);
SELECT pg_temp.expect_error('Только картинки, не видео и не исполняемые файлы',
  $q$INSERT INTO media_files (owner_id, purpose, mime, size_bytes, width, height, sha256, data)
     SELECT user_id, 'portfolio', 'video/mp4', 3, 1, 1, decode(repeat('ab', 32), 'hex'), '\x010203' FROM profiles WHERE slug = 'demo-ivan-t'$q$);

SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name FROM results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS passed, count(*) FILTER (WHERE NOT ok) AS failed FROM results;

ROLLBACK;
