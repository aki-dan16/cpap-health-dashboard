import { safeNextPath } from "@/lib/auth";

export const metadata = {
  title: "ログイン｜CPAP Health Dashboard",
};

/**
 * [auth] ログインフォーム。パスワード1フィールドのみ。
 * /api/login に POST。ブラウザ/iCloudキーチェーン/Windowsのパスワード保存が
 * 効くよう、form/input に name と autocomplete を付ける。
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error === "1";
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : "/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#161616] p-8 shadow-xl">
        <h1 className="text-lg font-medium text-gray-100">CPAP Health Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">パスワードを入力してください</p>

        <form method="POST" action="/api/login" name="login" className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />

          <div>
            <label htmlFor="password" className="sr-only">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              placeholder="パスワード"
              className="w-full rounded-lg border border-white/10 bg-[#0f0f0f] px-3 py-2.5 text-gray-100 placeholder-gray-500 outline-none focus:border-white/30"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">パスワードが違います</p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-gray-100 px-3 py-2.5 font-medium text-[#0f0f0f] transition-colors hover:bg-white"
          >
            ログイン
          </button>
        </form>
      </div>
    </main>
  );
}
