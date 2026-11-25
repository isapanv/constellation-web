import { z } from "zod";
import { clientIp, createSession, normalizePhone, verifyOtp } from "@/server/auth";
import { one, tx } from "@/server/db";
import { fail, handler, readJson } from "@/server/http";

/** Версия текстов согласий. TODO: заменить на версию от юриста, когда будут финальные тексты. */
const CONSENT_TEXT_VERSION = "draft-2026-11";

const schema = z.object({
  phone: z.string().max(40),
  code: z.string().regex(/^\d{4,6}$/, "Код — 4 цифры"),
  purpose: z.enum(["signup", "login"]),
  consents: z.object({ adult: z.boolean(), terms: z.boolean(), pdn: z.boolean(), marketing: z.boolean() }).optional(),
});

/** Проверить код: регистрация создаёт аккаунт с согласиями, вход — просто сессию. */
export const POST = handler(async (req) => {
  const body = await readJson(req, schema);
  const phone = normalizePhone(body.phone);

  if (body.purpose === "signup") {
    const c = body.consents;
    if (!c?.adult || !c.terms || !c.pdn) fail(422, "Нужны подтверждение 18+, согласие с соглашением и согласие на обработку данных", "consents");
  }
  await verifyOtp(phone, body.purpose, body.code);
  const ip = clientIp(req);

  let userId: string;
  if (body.purpose === "signup") {
    userId = await tx(async (cl) => {
      const u = await cl.query<{ id: string }>(
        `INSERT INTO users (phone, phone_verified_at, adult_confirmed_at, signup_source) VALUES ($1, now(), now(), 'web') RETURNING id`,
        [phone],
      );
      const id = u.rows[0].id;
      await cl.query(`INSERT INTO auth_identities (user_id, provider, provider_user_id) VALUES ($1, 'sms', $2)`, [id, phone]);
      const types = ["pdn_processing", "terms", ...(body.consents!.marketing ? ["marketing"] : [])];
      for (const t of types)
        await cl.query(`INSERT INTO consents (user_id, consent_type, text_version, ip) VALUES ($1, $2, $3, $4)`, [id, t, CONSENT_TEXT_VERSION, ip]);
      return id;
    });
  } else {
    const u = await one<{ id: string }>(`UPDATE users SET last_login_at = now() WHERE phone = $1 AND status = 'active' RETURNING id`, [phone]);
    if (!u) fail(404, "Аккаунта с этим номером нет", "no_account");
    userId = u!.id;
  }

  await createSession(userId, req);
  const profile = await one(`SELECT 1 FROM profiles WHERE user_id = $1`, [userId]);
  return Response.json({ needsOnboarding: !profile });
});
