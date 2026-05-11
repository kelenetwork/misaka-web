import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export type SessionUser = { id: string; role: "user" | "admin" };

type GuardResult = { ok: true; user: SessionUser } | { ok: false; response: NextResponse };

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function requireUser(req: NextRequest): Promise<GuardResult> {
  const session = await auth.api.getSession({ headers: req.headers });
  const rawUser = session?.user as { id?: unknown; role?: unknown } | undefined;
  if (!rawUser?.id || typeof rawUser.id !== "string") return { ok: false, response: errorResponse("unauthorized", 401) };
  return { ok: true, user: { id: rawUser.id, role: rawUser.role === "admin" ? "admin" : "user" } };
}

export async function requireAdmin(req: NextRequest): Promise<GuardResult> {
  const guard = await requireUser(req);
  if (!guard.ok) return guard;
  if (guard.user.role !== "admin") return { ok: false, response: errorResponse("forbidden", 403) };
  return guard;
}
