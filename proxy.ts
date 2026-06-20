import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * [38] Basic認証（候補B）。Next.js 16 の proxy 規約（nodejsランタイム）。
 * 全ルート（/admin・/api 含む）を保護する。
 *
 * 挙動：
 *  - BASIC_AUTH_USER / BASIC_AUTH_PASSWORD が設定 → Basic認証を強制
 *  - 未設定 かつ 本番(production) → フェイルクローズドで503（露出させない [41]）
 *  - 未設定 かつ 開発(development) → 素通し（ローカル開発の利便）
 */
export function proxy(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;

  if (user && pass) {
    const header = req.headers.get("authorization");
    if (header?.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      const u = decoded.slice(0, sep);
      const p = decoded.slice(sep + 1);
      if (u === user && p === pass) return NextResponse.next();
    }
    return new NextResponse("認証が必要です。", {
      status: 401,
      headers: {
        "WWW-Authenticate":
          'Basic realm="CPAP Health Dashboard", charset="UTF-8"',
      },
    });
  }

  if (process.env.NODE_ENV === "production") {
    return new NextResponse(
      "Basic認証の環境変数(BASIC_AUTH_USER / BASIC_AUTH_PASSWORD)が未設定です。Vercelの環境変数を設定してください。",
      { status: 503 }
    );
  }
  return NextResponse.next();
}

export const config = {
  // 静的アセット等を除く全ルートを保護
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
