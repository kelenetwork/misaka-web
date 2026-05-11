import { NextRequest } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { setupTokens } from "@/lib/db/schema";
import { json } from "@/lib/http";

/** 验证 token 是否有效，给 /setup 页面 mount 时调用。 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return json({ error: "missing_token" }, 400);

  const row = await db.query.setupTokens.findFirst({
    where: and(
      eq(setupTokens.token, token),
      isNull(setupTokens.usedAt),
      gt(setupTokens.expiresAt, new Date()),
    ),
  });
  if (!row) return json({ error: "invalid_or_expired" }, 410);

  return json({
    ok: true,
    username: row.username,
    email: row.email,
    expiresAt: row.expiresAt.toISOString(),
  });
}
