"use client";

import {
  RX,
  SUPP_AM,
  SUPP_PM,
  SUPP_HOLD,
  MED_BADGE_COLOR,
  MED_BADGE_COLOR_DEFAULT,
} from "@/lib/constants";
import type { MedicationEntry } from "@/lib/types";
import { todayInTz, diffDaysIso, type LocationTz } from "@/lib/tz";

function isDupixent(drug: string | null): boolean {
  return drug != null && /dupixent|デュピクセント/i.test(drug);
}

/** 日付降順（getMedicationLog の返り値の順）の中から、次回予定が入った最新の1件を返す */
function latestNextDue(entries: MedicationEntry[]): MedicationEntry | null {
  return entries.find((e) => e.nextDue != null) ?? null;
}

export default function MedTab({
  medication = [],
  locTz = "HST",
}: {
  medication?: MedicationEntry[];
  locTz?: LocationTz;
}) {
  const todayStr = todayInTz(locTz, new Date());
  const dupixentNext = latestNextDue(medication.filter((e) => isDupixent(e.drug)));
  const dupixentDiff =
    dupixentNext?.nextDue != null
      ? diffDaysIso(dupixentNext.nextDue, todayStr)
      : null;

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

      {/* 投薬ログ（Notion D. 投薬ログ DB） */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">💉 投薬ログ</h2>

        {dupixentNext?.nextDue && (
          <div
            className={`mb-3 rounded-xl border p-4 ${
              dupixentDiff != null && dupixentDiff < 0
                ? "border-red-500/40 bg-red-500/10"
                : "border-sky-500/40 bg-sky-500/10"
            }`}
          >
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-lg">💉</span>
              <span className="font-bold">次回予定（Dupixent）</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-100">
                {dupixentNext.nextDue}
              </span>
              {dupixentDiff != null && (
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                    dupixentDiff < 0
                      ? "bg-red-500/20 text-red-300"
                      : "bg-sky-500/20 text-sky-300"
                  }`}
                >
                  {dupixentDiff < 0
                    ? `⚠️ 要更新（${Math.abs(dupixentDiff)}日超過）`
                    : dupixentDiff === 0
                      ? "本日"
                      : `あと${dupixentDiff}日`}
                </span>
              )}
            </div>
          </div>
        )}

        {medication.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-700 bg-[#141414] px-4 py-6 text-center text-sm text-gray-500">
            記録なし
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[#1a1a1a] text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left">日付</th>
                  <th className="px-3 py-2 text-left">薬剤</th>
                  <th className="px-3 py-2 text-left">用量</th>
                  <th className="px-3 py-2 text-left">部位</th>
                  <th className="px-3 py-2 text-left">メモ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {medication.map((m, i) => (
                  <tr key={`${m.date}-${i}`} className="hover:bg-[#161616]">
                    <td className="px-3 py-2 text-gray-300">{m.date}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          (m.drug && MED_BADGE_COLOR[m.drug]) ??
                          MED_BADGE_COLOR_DEFAULT
                        }`}
                      >
                        {m.drug ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-300">{m.dose || "—"}</td>
                    <td className="px-3 py-2 text-gray-400">{m.site ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-400">{m.memo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
