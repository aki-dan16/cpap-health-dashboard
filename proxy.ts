import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  verify,
  COOKIE_NAME,
  SESSION_MAX_AGE,
  sessionCookieOptions,
} from "@/lib/auth";

/**
 * [auth] Cookieセッション認証（候補B改）。Next.js 16 の proxy 規約。
 * 全ルート（/admin・/api 含む）を HMAC署名Cookie で保護する。
 *
 * 挙動：
 *  - BASIC_AUTH_PASSWORD / AUTH_SECRET 未設定 → 全ルート503（フェイルクローズド）
 *  - 除外パス（/login・/api/login・/api/logout・静的）は素通し（無限リダイレクト防止）
 *  - dash_session Cookie が有効 → 通す＋Max-Ageを365日へ延長（ローリング）
 *  - 無効/無し → /login?next=<元のパス> へリダイレクト
 */

// 認証不要パス。除外しないと /login 自身もブロックされ無限リダイレクトになる。
const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/logout"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // matcher でも除外しているが二重防御（静的アセット）
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export async function proxy(req: NextRequest) {
  const pass = process.env.BASIC_AUTH_PASSWORD;
  const secret = process.env.AUTH_SECRET;

  // フェイルクローズド：必須envが無ければ全ルート503（無防備公開を防ぐ）
  if (!pass || !secret) {
    return new NextResponse(
      "認証の環境変数(BASIC_AUTH_PASSWORD / AUTH_SECRET)が未設定です。Vercelの環境変数を設定してください。",
      { status: 503 }
    );
  }

  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (await verify(token)) {
    // ローリング：有効アクセスのたびに Max-Age を365日へ延長
    const res = NextResponse.next();
    res.cookies.set(COOKIE_NAME, token!, sessionCookieOptions(SESSION_MAX_AGE));
    return res;
  }

  // 無効/無し → /login?next=<元のパス（クエリ含む）>
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 静的アセット等を除く全ルートを保護（/admin・/api 含む）。現行の流儀を踏襲。
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
