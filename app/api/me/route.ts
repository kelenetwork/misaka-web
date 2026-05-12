import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { getIp, json } from "@/lib/http";

/**
 * 删除自己账号：直接删 users 行；
 * - misaka_accounts / tasks / bind_codes / setup_tokens 都有 onDelete: cascade
 * - orders.userId 是 NOT NULL 外键，cascade 删（orders 表 schema 设定）
 * - audit_logs.actor_id ON DELETE SET NULL，保留历史
 * - session / account 表（better-auth）也 cascade
 *
 * 最后 sign-out 当前 session（前端处理）
 */
export async function DELETE(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.response;

  // admin 角色保护：不能删唯一的 admin
  const targetUser = await db.query.users.findFirst({ where: eq(users.id, guard.user.id) });
  if (!targetUser) return json({ error: "not_found" }, 404);

  if (targetUser.role === "admin") {
    const allAdmins = await db.query.users.findMany({ where: eq(users.role, "admin") });
    if (allAdmins.length <= 1) {
      return json({ error: "last_admin_cannot_delete", detail: "你是系统最后一个管理员，删除会让系统失去管理员。请先提升另一个用户为 admin。" }, 409);
    }
  }

  await logAudit(guard.user.id, "user.self_deleted", guard.user.id, {
    username: targetUser.username,
    email: targetUser.email,
  }, getIp(req));

  // cascade 由 schema 外键处理
  await db.delete(users).where(eq(users.id, guard.user.id));

  return json({ ok: true });
}
