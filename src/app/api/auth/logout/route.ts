import { revokeSession } from "@/server/auth";
import { handler } from "@/server/http";

export const POST = handler(async () => {
  await revokeSession();
  return Response.json({ ok: true });
});
