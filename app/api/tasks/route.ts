import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import { json } from "@/lib/http";
export async function GET(req: NextRequest) { const userId = req.nextUrl.searchParams.get("userId"); return json(await db.query.tasks.findMany({ where: userId ? eq(tasks.userId, userId) : undefined })); }
export async function POST(req: NextRequest) { const [row] = await db.insert(tasks).values(await req.json()).returning(); return json(row, 201); }
