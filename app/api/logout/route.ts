import { NextResponse } from "next/server";
import { COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * [auth] ログアウト。dash_session Cookie を削除して /login へ。
 * 緊急時のローカルログアウト用（端末からのサインアウト）。
 */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const res = NextResponse.redirect(new URL("/login", origin), { status: 303 });
  res.cookies.set(COOKIE_NAME, "", sessionCookieOptions(0));
  return res;
}
