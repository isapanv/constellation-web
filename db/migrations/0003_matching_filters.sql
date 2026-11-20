-- =====================================================================
-- «Созвездие» — Шаг 1 конвейера подбора в SQL: жёсткие фильтры по слоту.
-- Скоринг и сборку трёх составов делает backend в коде (правила и веса),
-- а эта функция быстро отсекает тех, кого показывать нельзя.
-- Те же правила, что во фронтовой демо-версии (src/lib/team-search/matching.ts).
--
--   SELECT * FROM candidates_for_slot('<slot_id>');      -- строгие фильтры
--   SELECT * FROM candidates_for_slot('<slot_id>', 1);   -- уровень на ступень ниже (Шаг 3)
-- =====================================================================

BEGIN;

CREATE FUNCTION candidates_for_slot(p_slot_id uuid, p_relax_levels int DEFAULT 0)
RETURNS TABLE (
  specialist_id uuid,
  display_name  text,
  level         skill_level,
  rate_min      integer,
  rate_unit     rate_unit,
  cost          integer,
  relaxed       boolean,
  busy_share    numeric
)
LANGUAGE sql STABLE AS $$
  WITH slot AS (
    SELECT s.*, r.is_post, p.city_id, p.shoot_dates, p.delivery_date, p.required_legal_status,
           array_position(enum_range(NULL::skill_level), s.level_min) AS min_pos
    FROM role_slots s
    JOIN roles r ON r.id = s.role_id
    JOIN projects p ON p.id = s.project_id
    WHERE s.id = p_slot_id
  ),
  -- дни, по которым проверяем занятость: съёмка — для площадки, окно постпродакшна — для монтажа и цвета
  check_days AS (
    SELECT d::date AS day
    FROM slot, unnest(slot.shoot_dates) AS d
    WHERE NOT slot.is_post
    UNION ALL
    SELECT d::date
    FROM slot, generate_series((SELECT max(x) FROM unnest(slot.shoot_dates) x) + 1, slot.delivery_date, interval '1 day') AS d
    WHERE slot.is_post AND slot.delivery_date IS NOT NULL
  ),
  base AS (
    SELECT sr.user_id, pr.display_name, sr.level, sr.rate_min, sr.rate_unit,
           CASE WHEN sr.rate_unit IN ('shift', 'day') THEN sr.rate_min * coalesce(slot.shifts, 1) ELSE sr.rate_min END AS cost,
           array_position(enum_range(NULL::skill_level), sr.level) AS lvl_pos,
           slot.min_pos, slot.is_post
    FROM slot
    JOIN specialist_roles sr     ON sr.role_id = slot.role_id                                   -- H1 роль (основная или дополнительная)
    JOIN specialist_settings ss  ON ss.user_id = sr.user_id AND ss.open_to_work                 -- D  открыт к работе
    JOIN users u                 ON u.id = sr.user_id AND u.status = 'active'
    JOIN profiles pr             ON pr.user_id = sr.user_id
    JOIN cities c_spec           ON c_spec.id = pr.city_id
    JOIN cities c_proj           ON c_proj.id = slot.city_id
    WHERE (c_spec.metro_area = c_proj.metro_area OR ss.travel_ready)                            -- H2 город или выезд
      AND (ss.legal_status = ANY (slot.required_legal_status)                                   -- H3 документы
           OR (ss.legal_status = 'ooo' AND 'ip' = ANY (slot.required_legal_status)))
  ),
  busy AS (
    SELECT b.user_id,
           CASE WHEN (SELECT count(*) FROM check_days) = 0 THEN 0
                ELSE (SELECT count(*) FROM check_days cd
                      WHERE EXISTS (SELECT 1 FROM availability a
                                    WHERE a.user_id = b.user_id AND a.status = 'busy'
                                      AND cd.day BETWEEN a.date_from AND a.date_to))::numeric
                     / (SELECT count(*) FROM check_days)
           END AS share
    FROM base b
  )
  SELECT b.user_id, b.display_name, b.level, b.rate_min, b.rate_unit, b.cost,
         (b.min_pos IS NOT NULL AND b.lvl_pos < b.min_pos) AS relaxed,
         round(bz.share, 2)
  FROM base b
  JOIN busy bz ON bz.user_id = b.user_id
  WHERE (b.min_pos IS NULL OR b.lvl_pos >= b.min_pos - p_relax_levels)                          -- H4 уровень (+ ослабление)
    AND (CASE WHEN b.is_post THEN bz.share <= 0.5 ELSE bz.share = 0 END)                         -- H5 даты
  ORDER BY relaxed, b.cost;
$$;

COMMIT;
