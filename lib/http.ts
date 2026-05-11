import { NextRequest, NextResponse } from "next/server";
export function json(data: unknown, status = 200) { return NextResponse.json(data, { status }); }
export function getIp(req: NextRequest) { return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown"; }
export async function readJson<T>(req: NextRequest): Promise<T> { return req.json() as Promise<T>; }
