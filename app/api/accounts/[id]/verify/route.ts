import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { misakaAccounts } from "@/lib/db/schema";
import { requireUser } from "@/lib/api-guard";
import { MisakaClient } from "@/lib/misaka/client";
import { logAudit } from "@/lib/audit";
import { getIp, json } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const account = await db.query.misakaAccounts.findFirst({ where: eq(misakaAccounts.id, id) });
  if (!account) return json({ error: "not_found" }, 404);
  if (account.userId !== guard.user.id && guard.user.role !== "admin") {
    return json({ error: "forbidden" }, 403);
  }

  try {
    const client = new MisakaClient(account);
    await client.login();
    const info = (await client.getSessionInfo()) as { id?: number; email?: string };
    const balance = (await client.getBalance()) as {
      balance?: number;
      unbilled_charges?: number;
      promotional_credits?: number;
    };

    await db
      .update(misakaAccounts)
      .set({ status: "active", rateLimitedUntil: null, lastLoginAt: new Date() })
      .where(eq(misakaAccounts.id, id));

    await logAudit(
      guard.user.id,
      "account.verified",
      id,
      {
        label: account.label,
        misakaUserId: info.id,
        balance: balance.balance,
      },
      getIp(req),
    );

    return json({
      ok: true,
      misaka: {
        id: info.id,
        email: info.email,
      },
      balance: {
        balance: balance.balance ?? 0,
        unbilled: balance.unbilled_charges ?? 0,
        promotional: balance.promotional_credits ?? 0,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/401|403|invalid|credentials|password/i.test(msg)) {
      await db.update(misakaAccounts).set({ status: "invalid" }).where(eq(misakaAccounts.id, id));
    }
    await logAudit(guard.user.id, "account.verify_failed", id, { error: msg }, getIp(req));
    return json({ error: "verify_failed", detail: msg.slice(0, 300) }, 502);
  }
}
