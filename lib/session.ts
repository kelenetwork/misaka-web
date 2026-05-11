import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { users } from "@/lib/db/schema";

export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  role: "user" | "admin";
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const rawId = (session?.user as { id?: string } | undefined)?.id;
  if (!rawId) return null;

  const row = await db.query.users.findFirst({ where: eq(users.id, rawId) });
  if (!row) return null;

  return {
    id: row.id,
    username: row.username ?? row.name ?? row.email.split("@")[0],
    email: row.email,
    role: row.role,
  };
}
