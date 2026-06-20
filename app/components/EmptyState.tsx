"use client";

/** [31] 空データタブの Empty State（何を入れれば埋まるかを明示） */
export default function EmptyState({
  icon = "📭",
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-[#141414] py-14 text-center">
      <div className="text-3xl">{icon}</div>
      <p className="mt-2 text-sm font-medium text-gray-300">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
