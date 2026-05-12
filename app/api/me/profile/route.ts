import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { getIp, json } from "@/lib/http";

const schema = z.object({
  username: z.string().min(3).max(32).optional(),
});

/** 用户改自己资料（目前只有 username）。 */
export async function PATCH(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.response;
  const body = schema.parse(await req.json());

  const updates: Record<string, unknown> = {};
  if (body.username !== undefined) {
    // 检查冲突
    const conflict = await db.query.users.findFirst({
      where: and(eq(users.username, body.username), ne(users.id, guard.user.id)),
    });
    if (conflict) return json({ error: "username_exists" }, 409);
    updates.username = body.username;
  }

  if (Object.keys(updates).length === 0) {
    return json({ error: "no_changes" }, 400);
  }

  updates.updatedAt = new Date();

  await db.update(users).set(updates).where(eq(users.id, guard.user.id));
  await logAudit(guard.user.id, "user.profile_updated", guard.user.id, updates, getIp(req));
  return json({ ok: true });
}
