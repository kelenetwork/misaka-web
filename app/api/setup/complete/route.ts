import { NextRequest } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { setupTokens, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getIp, json } from "@/lib/http";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

/**
 * 用 setup_token 完成注册：
 * 1. 验证 token（未使用、未过期）
 * 2. 通过 better-auth API 创建 user + credential account（密码自动 hash）
 * 3. 写 username/role/status
 * 4. 标 token used
 * 5. 直接 sign-in，返回 session cookie，前端跳 /inventory
 */
export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());

  const tokenRow = await db.query.setupTokens.findFirst({
    where: and(
      eq(setupTokens.token, body.token),
      isNull(setupTokens.usedAt),
      gt(setupTokens.expiresAt, new Date()),
    ),
  });
  if (!tokenRow) return json({ error: "invalid_or_expired" }, 410);

  // 防止同 email 被重复创建：better-auth sign-up 会报 USER_ALREADY_EXISTS
  const existing = await db.query.users.findFirst({ where: eq(users.email, tokenRow.email) });
  if (existing) return json({ error: "user_already_exists" }, 409);

  // 调用 better-auth sign-up endpoint 来创建 user + credential account
  // 这样密码 hash + account 表写入都由 better-auth 处理
  const signUpRes = await auth.api.signUpEmail({
    body: {
      email: tokenRow.email,
      password: body.password,
      name: tokenRow.username,
    },
    headers: req.headers,
    asResponse: true,
  });

  if (!signUpRes.ok) {
    const text = await signUpRes.text().catch(() => "");
    return json({ error: "sign_up_failed", detail: text.slice(0, 200) }, 500);
  }

  // 拿新创建的 user id
  const created = await db.query.users.findFirst({ where: eq(users.email, tokenRow.email) });
  if (!created) return json({ error: "user_creation_inconsistent" }, 500);

  await db.update(users).set({
    username: tokenRow.username,
    role: "user",
    status: "active",
    emailVerified: true,
    updatedAt: new Date(),
  }).where(eq(users.id, created.id));

  await db.update(setupTokens).set({ usedAt: new Date() }).where(eq(setupTokens.token, body.token));

  await logAudit(
    null,
    "user.self_setup_complete",
    created.id,
    { username: tokenRow.username, email: tokenRow.email },
    getIp(req),
  );

  // sign-up 已经设置了 set-cookie session，把它转发回客户端
  const setCookie = signUpRes.headers.get("set-cookie");
  const out = json({ ok: true, userId: created.id });
  if (setCookie) out.headers.set("set-cookie", setCookie);
  return out;
}
