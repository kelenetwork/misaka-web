import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { misakaAccounts } from "@/lib/db/schema";
import { requireUser } from "@/lib/api-guard";
import { encrypt } from "@/lib/crypto";
import { patchAccountSchema } from "@/lib/schemas";
import { json } from "@/lib/http";

async function getOwnedAccount(id: string, user: { id: string; role: "user" | "admin" }) {
  const account = await db.query.misakaAccounts.findFirst({ where: eq(misakaAccounts.id, id) });
  if (!account) return { ok: false as const, response: json({ error: "not_found" }, 404) };
  if (account.userId !== user.id && user.role !== "admin") return { ok: false as const, response: json({ error: "forbidden" }, 403) };
  return { ok: true as const, account };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const { id } = await params;
  const owned = await getOwnedAccount(id, guard.user); if (!owned.ok) return owned.response;
  return json(owned.account);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const { id } = await params;
  const owned = await getOwnedAccount(id, guard.user); if (!owned.ok) return owned.response;
  const { password, ...body } = patchAccountSchema.parse(await req.json());
  const set = { ...body, ...(password ? { passwordEncrypted: encrypt(password), sessionCacheEncrypted: null, lastLoginAt: null } : {}) };
  const [row] = await db.update(misakaAccounts).set(set).where(eq(misakaAccounts.id, id)).returning();
  return json(row);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const { id } = await params;
  const owned = await getOwnedAccount(id, guard.user); if (!owned.ok) return owned.response;
  await db.delete(misakaAccounts).where(eq(misakaAccounts.id, id));
  return json({ ok: true });
}
