import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { misakaAccounts } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { json } from "@/lib/http";
const createSchema = z.object({ userId: z.string(), label: z.string(), email: z.email(), password: z.string().min(1) });
export async function GET(req: NextRequest) { const userId = req.nextUrl.searchParams.get("userId"); return json(await db.query.misakaAccounts.findMany({ where: userId ? eq(misakaAccounts.userId, userId) : undefined })); }
export async function POST(req: NextRequest) { const body = createSchema.parse(await req.json()); const [row] = await db.insert(misakaAccounts).values({ userId: body.userId, label: body.label, email: body.email, passwordEncrypted: encrypt(body.password) }).returning(); return json(row, 201); }
