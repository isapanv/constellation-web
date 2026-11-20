/**
 * Вход по коду из SMS и сессии в httpOnly cookie.
 * В cookie лежит случайный токен, в БД (sessions.token_hash) — только его sha256.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Me, OtpPurpose } from "@/lib/api/types";
import { one, q } from "./db";
import { fail } from "./http";

export const SESSION_COOKIE = "sz_session";
const SESSION_DAYS = 30;
const OTP_TTL_MIN = 5;
const OTP_RESEND_SEC = 60;
const OTP_PER_HOUR = 5;
const OTP_MAX_ATTEMPTS = 5;

const sha256 = (s: string) => createHash("sha256").update(s).digest();
const isProd = process.env.NODE_ENV === "production";

/** «+7 (900) 123-45-67», «8 900 …» → «+79001234567». */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10) d = "7" + d;
  if (!/^7\d{10}$/.test(d)) fail(400, "Введите российский номер: +7 и 10 цифр");
  return "+" + d;
}

export function clientIp(req: Request): string | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  return ip && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null;
}

// ---------- Коды из SMS ----------

export async function sendOtp(phone: string, purpose: OtpPurpose, ip: string | null): Promise<{ resendIn: number; devCode?: string }> {
  const user = await one<{ id: string }>(`SELECT id FROM users WHERE phone = $1 AND status = 'active'`, [phone]);
  if (purpose === "login" && !user) fail(404, "Аккаунта с этим номером нет. Зарегистрируйтесь", "no_account");
  if (purpose === "signup" && user) fail(409, "Этот номер уже зарегистрирован. Войдите", "already_registered");

  // Ограничение частоты: SMS стоят денег, и их заказывают боты
  const recent = await one<{ last_sec: number | null; per_hour: number }>(
    `SELECT extract(epoch FROM now() - max(created_at))::float8 AS last_sec,
            count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS per_hour
     FROM otp_codes WHERE phone = $1`,
    [phone],
  );
  if (recent?.last_sec != null && recent.last_sec < OTP_RESEND_SEC)
    fail(429, `Новый код можно запросить через ${Math.ceil(OTP_RESEND_SEC - recent.last_sec)} с`, "too_soon");
  if ((recent?.per_hour ?? 0) >= OTP_PER_HOUR) fail(429, "Слишком много попыток. Попробуйте через час", "too_many");

  if (isProd) {
    // TODO: подключить SMS-провайдера (договор, тариф — вопрос к финансисту). До этого вход в проде не работает.
    fail(503, "Отправка SMS ещё не подключена", "sms_unavailable");
  }

  const code = !isProd && process.env.SMS_DEV_CODE ? process.env.SMS_DEV_CODE : String(randomInt(0, 10000)).padStart(4, "0");
  await q(
    `INSERT INTO otp_codes (phone, purpose, code_hash, ip, expires_at) VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
    [phone, purpose, sha256(`${phone}:${code}`), ip, OTP_TTL_MIN],
  );

  console.info(`[dev] Код для ${phone}: ${code}`);
  return { resendIn: OTP_RESEND_SEC, devCode: code };
}

export async function verifyOtp(phone: string, purpose: OtpPurpose, code: string): Promise<void> {
  const row = await one<{ id: string; code_hash: Buffer; attempts: number }>(
    `SELECT id, code_hash, attempts FROM otp_codes
     WHERE phone = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose],
  );
  if (!row) fail(400, "Код истёк. Запросите новый", "expired");
  if (row!.attempts >= OTP_MAX_ATTEMPTS) fail(429, "Слишком много неверных попыток. Запросите новый код", "too_many");
  const ok = timingSafeEqual(row!.code_hash, sha256(`${phone}:${code}`));
  if (!ok) {
    await q(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [row!.id]);
    fail(400, "Неверный код", "wrong_code");
  }
  await q(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [row!.id]);
}

// ---------- Сессии ----------

export async function createSession(userId: string, req: Request): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await q(
    `INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at) VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))`,
    [userId, sha256(token), req.headers.get("user-agent")?.slice(0, 300) ?? null, clientIp(req), SESSION_DAYS],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function revokeSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await q(`UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Текущий пользователь по cookie или null. */
export async function currentUserId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const row = await one<{ user_id: string }>(
    `UPDATE sessions s SET last_seen_at = now()
     FROM users u
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.id = s.user_id AND u.status = 'active'
     RETURNING s.user_id`,
    [sha256(token)],
  );
  return row?.user_id ?? null;
}

export async function requireUser(): Promise<string> {
  const id = await currentUserId();
  if (!id) fail(401, "Войдите в аккаунт", "unauthorized");
  return id!;
}

export async function loadMe(userId: string): Promise<Me> {
  const row = await one<{ id: string; phone: string; display_name: string | null; slug: string | null; client_mode: boolean | null; specialist_mode: boolean | null }>(
    `SELECT u.id, u.phone, p.display_name, p.slug, p.client_mode, p.specialist_mode
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1`,
    [userId],
  );
  if (!row) fail(401, "Войдите в аккаунт", "unauthorized");
  return {
    user: { id: row!.id, phone: row!.phone },
    profile: row!.display_name
      ? { displayName: row!.display_name, slug: row!.slug!, clientMode: !!row!.client_mode, specialistMode: !!row!.specialist_mode }
      : null,
  };
}
