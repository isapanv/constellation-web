-- Справочники. code совпадает с id во фронте (src/lib/team-search/dictionaries.ts).
BEGIN;

INSERT INTO cities (name, region, metro_area) VALUES
  ('Санкт-Петербург', 'Санкт-Петербург', 'spb'),
  ('Ленинградская область', 'Ленинградская область', 'spb'),
  ('Москва', 'Москва', 'msk');

INSERT INTO roles (code, name, category, default_rate_unit, budget_share, is_post) VALUES
  ('director', 'Режиссёр',                  'production', 'shift',   25, false),
  ('dop',      'Оператор-постановщик',      'camera',     'shift',   18, false),
  ('gaffer',   'Гаффер',                    'light',      'shift',    9, false),
  ('sound',    'Звукорежиссёр на площадке', 'sound',      'shift',    5, false),
  ('art',      'Художник-постановщик',      'art',        'shift',   10, false),
  ('producer', 'Продюсер',                  'production', 'project', 14, false),
  ('writer',   'Сценарист',                 'production', 'project',  8, false),
  ('editor',   'Монтажёр',                  'post',       'project', 14, true),
  ('colorist', 'Колорист',                  'post',       'project',  7, true);

INSERT INTO formats (code, name) VALUES
  ('ad', 'Рекламный ролик'), ('clip', 'Музыкальный клип'), ('corp', 'Корпоративное видео'),
  ('social', 'Контент для соцсетей'), ('image', 'Имиджевый фильм'), ('event', 'Ивент-съёмка'),
  ('short', 'Короткий метр');

INSERT INTO style_tags (code, name) VALUES
  ('fashion', 'Fashion'), ('urban', 'Городская среда'), ('dynamic', 'Динамичный монтаж'),
  ('minimal', 'Минимализм'), ('warm', 'Тёплая палитра'), ('handheld', 'Ручная камера'),
  ('doc', 'Документальный'), ('staged_light', 'Постановочный свет'), ('night', 'Ночная съёмка'),
  ('food', 'Фуд'), ('product', 'Предметная съёмка'), ('music', 'Музыкальная эстетика');

COMMIT;
