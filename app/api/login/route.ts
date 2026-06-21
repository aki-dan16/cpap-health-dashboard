import { NextResponse } from "next/server";
import {
  sign,
  safeEqual,
  safeNextPath,
  COOKIE_NAME,
  SESSION_MAX_AGE,
  sessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * [auth] ログイン。パスワードを BASIC_AUTH_PASSWORD と timing-safe 比較し、
 * 一致したら dash_session Cookie（HMAC署名・365日）を発行する。
 */
export async function POST(req: Request) {
  const pass = process.env.BASIC_AUTH_PASSWORD;
  const secret = process.env.AUTH_SECRET;

  // フェイルクローズド：必須envが未設定なら503
  if (!pass || !secret) {
    return new NextResponse(
      "認証設定が未完了です（BASIC_AUTH_PASSWORD / AUTH_SECRET）。",
      { status: 503 }
    );
  }

  const form = await req.formData();
  const input = String(form.get("password") ?? "");
  const next = safeNextPath(String(form.get("next") ?? ""));
  const origin = new URL(req.url).origin;

  // 不一致 → /login?error=1（next は引き継ぐ）。303でGETに戻す。
  if (!safeEqual(input, pass)) {
    return NextResponse.redirect(
      new URL(`/login?error=1&next=${encodeURIComponent(next)}`, origin),
      { status: 303 }
    );
  }

  // 一致 → トークン発行＋Cookieセットして元のパスへ
  const token = await sign();
  const res = NextResponse.redirect(new URL(next, origin), { status: 303 });
  res.cookies.set(COOKIE_NAME, token, sessionCookieOptions(SESSION_MAX_AGE));
  return res;
}
