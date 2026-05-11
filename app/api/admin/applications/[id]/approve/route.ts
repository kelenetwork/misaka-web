import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applications, users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api-guard";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getIp, json } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const app = await db.query.applications.findFirst({ where: eq(applications.id, id) });
  if (!app) return json({ error: "not_found" }, 404);
  if (app.status !== "pending") return json({ error: "already_reviewed" }, 409);

  // Generate temp password
  const tempPassword = crypto.randomBytes(9).toString("base64").replace(/[/+=]/g, "").slice(0, 12);

  // Create user via better-auth so credential hash + account row are wired correctly
  const ctx = await auth.$context;
  const hashed = await ctx.password.hash(tempPassword);

  const newUser = await ctx.internalAdapter.createUser({
    email: app.email,
    name: app.username,
    emailVerified: true,
  });

  await ctx.internalAdapter.linkAccount({
    userId: newUser.id,
    providerId: "credential",
    accountId: newUser.id,
    password: hashed,
  });

  // Set our extra fields (username + role/status)
  await db.update(users).set({
    username: app.username,
    role: "user",
    status: "active",
    updatedAt: new Date(),
  }).where(eq(users.id, newUser.id));

  await db.update(applications).set({
    status: "approved",
    reviewedBy: guard.user.id,
    reviewedAt: new Date(),
  }).where(eq(applications.id, id));

  await logAudit(
    guard.user.id,
    "application.approved",
    id,
    { createdUserId: newUser.id, username: app.username, email: app.email },
    getIp(req)
  );

  return json({ ok: true, userId: newUser.id, tempPassword });
}
