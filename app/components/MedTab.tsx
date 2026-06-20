"use client";

import { RX, SUPP_AM, SUPP_PM, SUPP_HOLD } from "@/lib/constants";

export default function MedTab() {
  return (
    <div className="space-y-6">
      {/* 処方薬 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">💊 処方薬</h2>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[#1a1a1a] text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">薬剤</th>
                <th className="px-3 py-2 text-left">用量</th>
                <th className="px-3 py-2 text-left">タイミング</th>
                <th className="px-3 py-2 text-left">目的</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {RX.map((m) => (
                <tr key={m.name} className="hover:bg-[#161616]">
                  <td className="px-3 py-2 font-medium text-gray-100">{m.name}</td>
                  <td className="px-3 py-2 text-gray-300">{m.dose}</td>
                  <td className="px-3 py-2 text-gray-400">{m.timing}</td>
                  <td className="px-3 py-2 text-gray-300">{m.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* サプリ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SuppCard title="🌅 サプリ（朝）" items={SUPP_AM} />
        <SuppCard title="🌙 サプリ（夜）" items={SUPP_PM} />
      </div>

      {/* 保留中 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">⏸ 保留中</h2>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          {SUPP_HOLD}
        </div>
      </section>
    </div>
  );
}

function SuppCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-xl border border-gray-800 bg-[#161616] p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-300">{title}</h2>
      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s} className="flex items-start gap-2 text-sm text-gray-200">
            <span className="mt-1 text-gray-600">•</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
