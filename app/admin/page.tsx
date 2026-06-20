"use client";

import { useEffect, useState } from "react";

interface IndexRow {
  date: string;
  pageId: string;
}

export default function AdminPage() {
  const [index, setIndex] = useState<IndexRow[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/pageindex", { cache: "no-store" });
        const data = await res.json();
        setIndex(data.index ?? []);
        setError(data.error ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "取得に失敗しました。");
      }
      setLoading(false);
    })();
  }, []);

  const json = JSON.stringify(
    Object.fromEntries(index.map((r) => [r.date, r.pageId])),
    null,
    2
  );

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-bold text-gray-100">
        🔧 Admin：日付 → page_id インデックス
      </h1>
      <p className="mt-1 text-xs text-gray-500">
        DB-A（CPAP夜ログ）全行の page_id 逆引き。既存レコード更新時に使用。
      </p>

      {/* [38] 認証導入までの注意 */}
      <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
        ⚠️ このルートは現在認証なしで閲覧可能です。デプロイ前に [38] Basic認証（middleware/proxy）で保護してください。
      </div>

      {loading ? (
        <p className="mt-6 text-gray-500">読み込み中…</p>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-400">{index.length} 件</span>
            <button
              onClick={copy}
              className="rounded-md border border-gray-700 bg-[#161616] px-3 py-1 text-xs text-gray-200 hover:bg-gray-800"
            >
              {copied ? "コピーしました" : "JSONをコピー"}
            </button>
          </div>

          <div className="mt-2 overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-[#1a1a1a] text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left">日付</th>
                  <th className="px-3 py-2 text-left">page_id</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {index.map((r) => (
                  <tr key={r.pageId} className="hover:bg-[#161616]">
                    <td className="px-3 py-2 text-gray-200">{r.date || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-400">
                      {r.pageId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-6 text-sm font-semibold text-gray-300">JSON</h2>
          <pre className="mt-2 max-h-80 overflow-auto rounded-xl border border-gray-800 bg-[#0d0d0d] p-3 text-xs text-gray-300">
            {json}
          </pre>
        </>
      )}
    </div>
  );
}
