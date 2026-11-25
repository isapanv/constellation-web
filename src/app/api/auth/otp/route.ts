import { z } from "zod";
import { clientIp, normalizePhone, sendOtp } from "@/server/auth";
import { handler, readJson } from "@/server/http";

/** Отправить код из SMS. В режиме разработки код возвращается в ответе (devCode) и пишется в терминал. */
export const POST = handler(async (req) => {
  const body = await readJson(req, z.object({ phone: z.string().max(40), purpose: z.enum(["signup", "login"]) }));
  const res = await sendOtp(normalizePhone(body.phone), body.purpose, clientIp(req));
  return Response.json(res);
});
