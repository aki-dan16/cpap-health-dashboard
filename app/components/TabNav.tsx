"use client";

export interface TabDef {
  key: string;
  label: string;
}

export const TABS: TabDef[] = [
  { key: "summary", label: "🏠 サマリー" },
  { key: "trend", label: "📈 CPAPトレンド" },
  { key: "history", label: "📋 全履歴" },
  { key: "blood", label: "🩸 血液検査" },
  { key: "weight", label: "⚖️ 体重・DXA" },
  { key: "med", label: "💊 薬・サプリ" },
];

export default function TabNav({
  active,
  onChange,
}: {
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <nav className="sticky top-0 z-20 -mx-4 mb-6 border-b border-gray-800 bg-[#0f0f0f]/95 px-4 py-2 backdrop-blur">
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={[
                "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sky-500/20 text-sky-300"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
