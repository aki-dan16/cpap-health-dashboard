/**
 * [auth] HMAC署名Cookieセッションのユーティリティ。
 *
 * - Web Crypto API（crypto.subtle）で実装。Next.js 16 の proxy は Node ランタイム
 *   だが、Web Crypto は Node/Edge 両方でグローバルに使えるため Node 専用の
 *   'crypto' は使わない（ランタイム差で壊れないようにする）。
 * - トークン形式： base64url(payload) + "." + base64url(signature)
 *   payload は { iat: 発行epoch秒 } の JSON。
 * - 秘密(AUTH_SECRET)は payload に埋めない。署名が鍵依存なので、AUTH_SECRET を
 *   差し替えると既存Cookieが一斉に無効化される（＝デバイス紛失時の緊急全ログアウト）。
 */

const encoder = new TextEncoder();

export const COOKIE_NAME = "dash_session";
// 365日（秒）。ローリングで毎アクセスこの値に延長する。
export const SESSION_MAX_AGE = 365 * 24 * 60 * 60;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * 定数時間比較。長さ差・内容差から情報が漏れないように、早期returnせず
 * 長い方の長さでループして差分をORで畳み込む。パスワード照合に使う。
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/** セッショントークンを発行（要 AUTH_SECRET）。 */
export async function sign(): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify({ iat: nowSec() })));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  const sigB64 = base64urlEncode(new Uint8Array(sig));
  return `${payloadB64}.${sigB64}`;
}

/**
 * トークンを検証。crypto.subtle.verify は定数時間比較なので timing-safe。
 * 署名が鍵依存のため AUTH_SECRET 差し替えで自動的に全Cookieが無効化される。
 */
export async function verify(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    sigBytes = base64urlDecode(sigB64);
  } catch {
    return false;
  }
  try {
    const key = await importKey(secret);
    return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payloadB64));
  } catch {
    return false;
  }
}

/** dash_session Cookie の属性。maxAge=0 で削除。 */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * ?next= のオープンリダイレクト対策。先頭が "/" の相対パスのみ許可。
 * "//"・"http(s)://"・バックスラッシュ等の外部/プロトコル相対は "/" 扱い。
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.includes("\\")) return "/";
  return next;
}
