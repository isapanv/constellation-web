-- =====================================================================
-- «Созвездие» — коды подтверждения из SMS (вход и регистрация через API).
-- Код храним только хешем; живёт 5 минут; не больше 5 попыток ввода.
-- Ограничение частоты отправки (SMS стоят денег, их заказывают боты) — в коде API по этой таблице.
-- =====================================================================

BEGIN;

CREATE TYPE otp_purpose AS ENUM ('signup', 'login');

CREATE TABLE otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{9,14}$'),
  purpose     otp_purpose NOT NULL,
  code_hash   bytea NOT NULL,               -- sha256(phone + ':' + code)
  attempts    smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX otp_codes_phone_idx ON otp_codes (phone, created_at DESC);

COMMIT;
