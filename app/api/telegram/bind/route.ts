import { and, eq, isNull } from "drizzle-orm";
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api-guard";
import { db } from "@/lib/db/client";
import { bindCodes } from "@/lib/db/schema";
import { json } from "@/lib/http";

const BIND_CODE_CHARS = "ACDEFGHJKLMNPQRTUVWXYZ234679";
const EXPIRES_IN_SECONDS = 300;

function generateBindCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const code = Array.from(bytes, (byte) => BIND_CODE_CHARS[byte % BIND_CODE_CHARS.length]).join("");
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export async function POST(req: NextRequest) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.response;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRES_IN_SECONDS * 1000);
  let bindCode = generateBindCode();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.transaction((tx) => {
        tx.update(bindCodes)
          .set({ usedAt: now })
          .where(and(eq(bindCodes.userId, guard.user.id), isNull(bindCodes.usedAt)))
          .run();
        tx.insert(bindCodes).values({ code: bindCode, userId: guard.user.id, expiresAt }).run();
      });
      return json({ bindCode, expiresAt: expiresAt.toISOString(), expiresIn: EXPIRES_IN_SECONDS });
    } catch (error) {
      if (attempt === 4) throw error;
      bindCode = generateBindCode();
    }
  }

  return json({ error: "failed_to_generate_bind_code" }, 500);
}
