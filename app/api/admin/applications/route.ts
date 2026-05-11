import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { json } from "@/lib/http";
export async function GET() { return json(await db.query.applications.findMany({ where: eq(applications.status, "pending") })); }
