import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api-guard";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getIp, json } from "@/lib/http";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  return json(await db.query.users.findMany());
}

const createSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.email(),
  password: z.string().min(8).max(128),
  role: z.enum(["user", "admin"]).optional().default("user"),
});

/** Admin 直接创建用户（绕过 apply 流程）。立刻 active。 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const body = createSchema.parse(await req.json());

  // 防止同 email/username 冲突
  const existingEmail = await db.query.users.findFirst({ where: eq(users.email, body.email) });
  if (existingEmail) return json({ error: "email_exists" }, 409);
  const existingUsername = await db.query.users.findFirst({ where: eq(users.username, body.username) });
  if (existingUsername) return json({ error: "username_exists" }, 409);

  // 通过 better-auth sign-up 创建 user + credential account
  const signUpRes = await auth.api.signUpEmail({
    body: {
      email: body.email,
      password: body.password,
      name: body.username,
    },
    asResponse: true,
  });
  if (!signUpRes.ok) {
    const text = await signUpRes.text().catch(() => "");
    return json({ error: "sign_up_failed", detail: text.slice(0, 200) }, 500);
  }

  const created = await db.query.users.findFirst({ where: eq(users.email, body.email) });
  if (!created) return json({ error: "user_creation_inconsistent" }, 500);

  await db.update(users).set({
    username: body.username,
    role: body.role,
    status: "active",
    emailVerified: true,
    updatedAt: new Date(),
  }).where(eq(users.id, created.id));

  await logAudit(
    guard.user.id,
    "admin.user_created",
    created.id,
    { username: body.username, email: body.email, role: body.role },
    getIp(req),
  );

  return json({ ok: true, userId: created.id, username: body.username, email: body.email, role: body.role }, 201);
}
