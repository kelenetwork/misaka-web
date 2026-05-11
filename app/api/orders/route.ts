import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { json } from "@/lib/http";
export async function GET(req: NextRequest) { const userId = req.nextUrl.searchParams.get("userId"); return json(await db.query.orders.findMany({ where: userId ? eq(orders.userId, userId) : undefined })); }
