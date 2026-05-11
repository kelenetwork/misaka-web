import { db } from "@/lib/db/client";
import { json } from "@/lib/http";
export async function GET() { return json(await db.query.inventorySnapshots.findMany()); }
