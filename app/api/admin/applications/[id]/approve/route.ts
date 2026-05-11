import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applications, setupTokens } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { getIp, json } from "@/lib/http";

const SETUP_TOKEN_TTL_HOURS = 48;

/**
 * 审批通过：
 * 1. 不立刻创建 user
 * 2. 生成 24+ 小时有效的 setup_token
 * 3. 返回 setupUrl 给 admin 看，admin 把链接转给申请人，申请人自助设密码完成注册
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const app = await db.query.applications.findFirst({ where: eq(applications.id, id) });
  if (!app) return json({ error: "not_found" }, 404);
  if (app.status !== "pending") return json({ error: "already_reviewed" }, 409);

  // 生成 32 字节 url-safe 随机 token
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_HOURS * 3600_000);

  await db.transaction((tx) => {
    tx.insert(setupTokens)
      .values({
        token,
        applicationId: id,
        username: app.username,
        email: app.email,
        approvedBy: guard.user.id,
        expiresAt,
      })
      .run();
    tx.update(applications)
      .set({
        status: "approved",
        reviewedBy: guard.user.id,
        reviewedAt: new Date(),
      })
      .where(eq(applications.id, id))
      .run();
  });

  await logAudit(
    guard.user.id,
    "application.approved",
    id,
    { username: app.username, email: app.email, expiresAt: expiresAt.toISOString() },
    getIp(req),
  );

  // 拼 setup URL，使用请求 origin 兼容 dev/prod
  const origin = req.nextUrl.origin;
  const setupUrl = `${origin}/setup?token=${token}`;

  return json({
    ok: true,
    setupUrl,
    expiresAt: expiresAt.toISOString(),
    expiresInHours: SETUP_TOKEN_TTL_HOURS,
  });
}
