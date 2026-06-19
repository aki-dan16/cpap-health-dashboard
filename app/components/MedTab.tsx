"use client";

interface Med {
  name: string;
  dose: string;
  timing: string;
  purpose: string;
}

const RX: Med[] = [
  {
    name: "リベルサス",
    dose: "3mg",
    timing: "毎朝起床直後・空腹・水120ml以下・服用後30分絶食",
    purpose: "GLP-1減量",
  },
  { name: "アムロジピン", dose: "5mg", timing: "毎朝", purpose: "降圧（CCB）" },
  {
    name: "ロサルタン",
    dose: "50mg",
    timing: "毎朝",
    purpose: "降圧（ARB）+腎保護",
  },
  {
    name: "ロスバスタチン",
    dose: "5mg",
    timing: "毎晩",
    purpose: "脂質（スタチン）",
  },
  {
    name: "デュピクセント",
    dose: "300mg SC",
    timing: "2週に1回",
    purpose: "アトピー",
  },
];

const SUPP_AM = [
  "O.N.E. Multivitamin",
  "Nordic Naturals Omega-3 2cap（計4cap/日）",
  "Magnesium Glycinate 1cap",
];

const SUPP_PM = [
  "Nordic Naturals Omega-3 2cap",
  "Magnesium Glycinate 2cap",
  "Metagenics D3 5000+K",
  "NAC 600mg",
  "Melatonin 3mg（就寝前）",
];

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
          KSM-66アシュワガンダ（ALT高値のため7月採血後まで開始中止）
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
