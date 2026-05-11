import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { json } from "@/lib/http";

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.response;

  await db.update(users).set({ telegramUserId: null }).where(eq(users.id, guard.user.id));
  return json({ ok: true });
}
