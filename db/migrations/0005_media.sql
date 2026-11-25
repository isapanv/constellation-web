-- =====================================================================
-- «Созвездие» — медиафайлы и аватар профиля.
--
-- РЕШЕНИЕ (20.11): на этапе MVP байты картинок храним прямо в PostgreSQL (bytea).
--   Почему: один сервер, одна резервная копия, данные гарантированно в РФ, ноль новых сервисов.
--   Предел: только картинки и только после сжатия на сервере (аватар ~30–60 КБ, работа портфолио ≤ ~400 КБ).
--   Видео в базу не кладём никогда: для него ссылка на VK Видео / Rutube (portfolio_items.external_url).
--   Переезд в объектное хранилище (Yandex Object Storage, Selectel S3): data = NULL, путь в storage_key,
--   таблица и API не меняются.
-- =====================================================================

BEGIN;

CREATE TYPE media_purpose AS ENUM ('avatar', 'portfolio');

CREATE TABLE media_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES users (id),
  purpose     media_purpose NOT NULL,
  -- после обработки на сервере всегда WebP; JPEG/PNG оставлены на случай хранения оригиналов
  mime        text NOT NULL CHECK (mime IN ('image/webp', 'image/jpeg', 'image/png')),
  size_bytes  integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 2 * 1024 * 1024),
  width       integer NOT NULL CHECK (width BETWEEN 1 AND 4096),
  height      integer NOT NULL CHECK (height BETWEEN 1 AND 4096),
  sha256      bytea NOT NULL CHECK (length(sha256) = 32),
  data        bytea,                                  -- байты, пока храним в БД
  storage_key text,                                   -- путь в объектном хранилище после переезда
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((data IS NULL) <> (storage_key IS NULL)),
  CHECK (data IS NULL OR length(data) = size_bytes)
);
-- Картинки уже сжаты: не тратим время базы на повторное сжатие в TOAST
ALTER TABLE media_files ALTER COLUMN data SET STORAGE EXTERNAL;
CREATE INDEX media_files_owner_idx ON media_files (owner_id, created_at DESC);

-- Аватар: либо одна из готовых медведиц (public/avatars/<preset>.webp), либо своя картинка, либо ничего (инициалы)
ALTER TABLE profiles DROP COLUMN avatar_key;           -- не использовался ни кодом, ни сидами
ALTER TABLE profiles
  ADD COLUMN avatar_preset   text CHECK (avatar_preset IN ('director', 'actor', 'writer', 'editor', 'camera', 'makeup',
                                                           'gaffer', 'sound', 'art', 'colorist', 'clapper', 'producer')),
  ADD COLUMN avatar_media_id uuid REFERENCES media_files (id) ON DELETE SET NULL,
  ADD CONSTRAINT profiles_one_avatar CHECK (avatar_preset IS NULL OR avatar_media_id IS NULL);

-- Своя картинка в аватаре — только своя и только загруженная как аватар
CREATE FUNCTION check_profile_avatar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.avatar_media_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM media_files m
       WHERE m.id = NEW.avatar_media_id AND m.owner_id = NEW.user_id AND m.purpose = 'avatar') THEN
    RAISE EXCEPTION 'Аватар должен быть картинкой этого пользователя, загруженной как аватар'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'profiles_avatar_owner';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_avatar_owner BEFORE INSERT OR UPDATE OF avatar_media_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION check_profile_avatar();

COMMIT;
