import { json } from "@/lib/http";
export async function POST() { return json({ bindCode: crypto.randomUUID(), expiresIn: 300, todo: "persist bind code and verify from /start" }); }
