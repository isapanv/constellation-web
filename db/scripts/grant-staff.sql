-- Выдать роль сотрудника платформы. Единственный способ получить первого админа:
-- через интерфейс админом стать нельзя, дальше роли выдаёт уже админ на /admin/staff.
--
-- Человек должен сначала зарегистрироваться на сайте обычным способом (по SMS).
--
--   psql -d sozvezdie -v phone=+79991234567 -v role=admin -f db/scripts/grant-staff.sql
--
-- role: admin | moderator | matcher. Действующая роль заменяется новой. Всё пишется в журнал.

\set ON_ERROR_STOP on
SELECT set_config('sz.phone', :'phone', false), set_config('sz.role', :'role', false);

DO $$
DECLARE
  v_user uuid;
  v_role staff_role := current_setting('sz.role')::staff_role;
  v_old  staff_role;
BEGIN
  SELECT id INTO v_user FROM users WHERE phone = current_setting('sz.phone') AND status = 'active';
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Нет активного пользователя с телефоном % (формат +79991234567)', current_setting('sz.phone');
  END IF;

  UPDATE staff_members SET revoked_at = now() WHERE user_id = v_user AND revoked_at IS NULL
  RETURNING role INTO v_old;

  INSERT INTO staff_members (user_id, role, note) VALUES (v_user, v_role, 'выдано скриптом grant-staff.sql');
  INSERT INTO admin_audit_log (actor_id, action, entity_type, entity_id, details)
  VALUES (NULL, 'staff.grant', 'staff', v_user, jsonb_build_object('role', v_role, 'previous', v_old, 'via', 'console'));

  RAISE NOTICE 'Готово: % теперь %', current_setting('sz.phone'), v_role;
END $$;
