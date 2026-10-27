import { clearTokenCookie } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearTokenCookie(res);
  return res;
}
