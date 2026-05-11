import { NextRequest } from "next/server";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applications, users } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { getIp, json } from "@/lib/http";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const app = await db.query.applications.findFirst({ where: eq(applications.id, id) }); if (!app) return json({ error: "not_found" }, 404);
  const tempPassword = crypto.randomUUID().replaceAll("-", "").slice(0, 16); const passwordHash = await argon2.hash(tempPassword);
  const [user] = await db.insert(users).values({ username: app.username, email: app.email, passwordHash }).returning();
  await db.update(applications).set({ status: "approved", reviewedBy: user.id, reviewedAt: new Date() }).where(eq(applications.id, id));
  await logAudit(user.id, "application.approved", id, { tempPassword, emailTodo: true }, getIp(req));
  return json({ ok: true, userId: user.id });
}
