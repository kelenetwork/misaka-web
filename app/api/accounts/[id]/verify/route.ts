import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { misakaAccounts } from "@/lib/db/schema";
import { requireUser } from "@/lib/api-guard";
import { MisakaClient } from "@/lib/misaka/client";
import { json } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req); if (!guard.ok) return guard.response;
  const { id } = await params;
  const account = await db.query.misakaAccounts.findFirst({ where: eq(misakaAccounts.id, id) });
  if (!account) return json({ error: "not_found" }, 404);
  if (account.userId !== guard.user.id && guard.user.role !== "admin") return json({ error: "forbidden" }, 403);
  await new MisakaClient(account).login();
  return json({ ok: true });
}
