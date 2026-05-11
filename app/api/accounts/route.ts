import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { misakaAccounts } from "@/lib/db/schema";
import { requireUser } from "@/lib/api-guard";
import { encrypt } from "@/lib/crypto";
import { createAccountSchema } from "@/lib/schemas";
import { json } from "@/lib/http";

export async function GET(req: NextRequest) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  return json(await db.query.misakaAccounts.findMany({ where: eq(misakaAccounts.userId, guard.user.id) }));
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const body = createAccountSchema.parse(await req.json());
  const [row] = await db.insert(misakaAccounts).values({ userId: guard.user.id, label: body.label, email: body.email, passwordEncrypted: encrypt(body.password) }).returning();
  return json(row, 201);
}
