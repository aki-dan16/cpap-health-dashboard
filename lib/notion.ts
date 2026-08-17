import { Client } from "@notionhq/client";
import { parseDateTs } from "@/lib/health";
import { todayInTz, diffDaysIso } from "@/lib/tz";
import { HIDDEN_TASK_MATCHERS } from "@/lib/constants";
import type {
  MedicationEntry,
  UpcomingTask,
  NextInjection,
} from "@/lib/types";

/**
 * Notion API v5（@notionhq/client 5.x）対応。
 * v5 では「データベース」が複数の「データソース」を持つモデルに変わり、
 * 旧来の `databases.query({ database_id })` は廃止された。
 * そのため、まず database_id から data_source_id を取得し、
 * `dataSources.query({ data_source_id })` でレコードを取得する。
 */

let cachedClient: Client | null = null;

export function getNotionClient(): Client {
  if (!process.env.NOTION_TOKEN) {
    throw new Error(
      "NOTION_TOKEN が設定されていません。.env.local を確認してください。"
    );
  }
  if (!cachedClient) {
    cachedClient = new Client({ auth: process.env.NOTION_TOKEN });
  }
  return cachedClient;
}

// database_id -> data_source_id のメモ化（プロセス内）
const dataSourceCache = new Map<string, string>();

async function resolveDataSourceId(databaseId: string): Promise<string> {
  const cached = dataSourceCache.get(databaseId);
  if (cached) return cached;

  const notion = getNotionClient();
  const db = (await notion.databases.retrieve({
    database_id: databaseId,
  })) as { data_sources?: { id: string; name: string }[] };

  const dataSources = db.data_sources ?? [];
  if (dataSources.length === 0) {
    throw new Error(
      `データベース ${databaseId} にデータソースが見つかりません。インテグレーションに共有されているか確認してください。`
    );
  }
  const id = dataSources[0].id;
  dataSourceCache.set(databaseId, id);
  return id;
}

/**
 * data_source_id を直接指定して全ページを取得する（created_time 付き）。
 * 日付同値時の tiebreak 等でページのメタ情報が要る場合に使う。
 */
export async function queryAllPagesByDataSource(
  dataSourceId: string
): Promise<{ createdTime: string; props: Record<string, unknown> }[]> {
  const notion = getNotionClient();

  const out: { createdTime: string; props: Record<string, unknown> }[] = [];
  let cursor: string | undefined = undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results) {
      const p = page as {
        created_time?: string;
        properties?: Record<string, unknown>;
      };
      if (p.properties) {
        out.push({ createdTime: p.created_time ?? "", props: p.properties });
      }
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  return out;
}

/**
 * data_source_id を直接指定して全レコードの properties を取得する。
 * database_id を持たず data_source_id が既知の場合（E. 次回タスク等）に使う。
 */
export async function queryAllRowsByDataSource(
  dataSourceId: string
): Promise<Record<string, unknown>[]> {
  const pages = await queryAllPagesByDataSource(dataSourceId);
  return pages.map((p) => p.props);
}

/**
 * 指定データベース（database_id）の全レコードを取得する。
 * database_id から data_source_id を解決してから取得する。
 */
export async function queryAllRows(
  databaseId: string
): Promise<Record<string, unknown>[]> {
  const dataSourceId = await resolveDataSourceId(databaseId);
  return queryAllRowsByDataSource(dataSourceId);
}

/**
 * [41] 「日付 → page_id」インデックス。
 * NotionでSQL/viewクエリが使えない制約下で、既存レコード更新時の page_id 逆引きに使う。
 */
export async function queryDatePageIndex(
  databaseId: string
): Promise<{ date: string; pageId: string }[]> {
  const notion = getNotionClient();
  const dataSourceId = await resolveDataSourceId(databaseId);

  const out: { date: string; pageId: string }[] = [];
  let cursor: string | undefined = undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results) {
      const p = page as {
        id: string;
        properties?: Record<string, unknown>;
      };
      out.push({ date: getTitle(p.properties?.["日付"]), pageId: p.id });
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  return out;
}

/* ---------- プロパティ抽出ヘルパー ---------- */

type AnyProp = unknown;

export function getTitle(prop: AnyProp): string {
  const arr = (prop as { title?: { plain_text: string }[] })?.title;
  if (!Array.isArray(arr)) return "";
  return arr.map((t) => t.plain_text).join("").trim();
}

export function getText(prop: AnyProp): string {
  const arr = (prop as { rich_text?: { plain_text: string }[] })?.rich_text;
  if (!Array.isArray(arr)) return "";
  return arr.map((t) => t.plain_text).join("").trim();
}

export function getNumber(prop: AnyProp): number | null {
  const n = (prop as { number?: number | null })?.number;
  return typeof n === "number" ? n : null;
}

export function getSelect(prop: AnyProp): string | null {
  return (prop as { select?: { name: string } | null })?.select?.name ?? null;
}

/** date プロパティの開始日を YYYY-MM-DD で返す（時刻付きISOでも日付部のみに正規化）。 */
export function getDate(prop: AnyProp): string | null {
  const start = (prop as { date?: { start?: string | null } | null })?.date
    ?.start;
  return start ? start.slice(0, 10) : null;
}

/**
 * D. 投薬ログ DB を取得し、日付降順（最新が先頭）で返す。
 * NOTION_MEDICATION_DB_ID 未設定時の呼び出し可否は呼び出し元（API Route）が判定する。
 */
export async function getMedicationLog(
  databaseId: string
): Promise<MedicationEntry[]> {
  const props = await queryAllRows(databaseId);
  const rows: MedicationEntry[] = props.map((p) => ({
    date: getTitle(p["日付"]),
    drug: getSelect(p["薬剤"]),
    dose: getText(p["用量"]),
    site: getSelect(p["部位"]),
    nextDue: getDate(p["次回予定"]),
    memo: getText(p["メモ"]),
  }));
  rows.sort((a, b) => parseDateTs(b.date) - parseDateTs(a.date));
  return rows;
}

/**
 * E. 次回タスク DB（data_source_id 指定）を取得する。
 * filter: 状態 ≠ 完了 / sort: 並び順 昇順。並び順が無い行は末尾へ。
 * 取得・整形はクライアント側（既存の getMedicationLog と同じ流儀）で行う。
 */
export async function getUpcomingTasks(
  dataSourceId: string
): Promise<UpcomingTask[]> {
  const props = await queryAllRowsByDataSource(dataSourceId);
  return props
    .map((p) => ({
      title: getTitle(p["タスク"]),
      priority: getSelect(p["重要度"]),
      status: getSelect(p["状態"]),
      detail: getText(p["詳細"]),
      due: getDate(p["期限"]),
      contact: getText(p["連絡先"]),
      order: getNumber(p["並び順"]),
    }))
    .filter((t) => t.status !== "完了") // filter: 状態 ≠ 完了
    // 表示除外（完了扱い等・恒久的にはNotion側で管理）
    .filter((t) => !HIDDEN_TASK_MATCHERS.some((m) => t.title.includes(m)))
    .sort(
      (a, b) =>
        (a.order ?? Number.POSITIVE_INFINITY) -
        (b.order ?? Number.POSITIVE_INFINITY) // sort: 並び順 昇順
    )
    .map((t) => ({
      title: t.title,
      priority: t.priority,
      status: t.status,
      detail: t.detail,
      due: t.due,
      contact: t.contact,
    }));
}

/**
 * D. 投薬ログ（data_source_id 指定）から Dupixent / Zepbound の「次回注射」を算出する。
 * 薬剤ごとに日付（title文字列）降順・同値は created_time 降順で並べ、
 * 「次回予定」が入った最新の1行を採用する。残日数は Pacific/Honolulu の当日基準。
 * 返却順は Zepbound → Dupixent の固定。
 */
export async function getNextInjections(
  dataSourceId: string
): Promise<NextInjection[]> {
  const pages = await queryAllPagesByDataSource(dataSourceId);
  const rows = pages.map((pg) => ({
    date: getTitle(pg.props["日付"]),
    drug: getSelect(pg.props["薬剤"]),
    dose: getText(pg.props["用量"]),
    nextDue: getDate(pg.props["次回予定"]),
    createdTime: pg.createdTime,
  }));

  const todayHst = todayInTz("HST", new Date());
  const targets: NextInjection["drug"][] = ["Zepbound", "Dupixent"];
  const result: NextInjection[] = [];

  for (const drug of targets) {
    const chosen = rows
      .filter((r) => r.drug === drug)
      .sort((a, b) => {
        const byDate = parseDateTs(b.date) - parseDateTs(a.date);
        if (byDate !== 0) return byDate;
        // 日付同値は created_time が新しい方を優先
        return (Date.parse(b.createdTime) || 0) - (Date.parse(a.createdTime) || 0);
      })
      .find((r) => r.nextDue != null); // 次回予定が空の行はスキップ

    if (!chosen || !chosen.nextDue) continue;

    result.push({
      drug,
      lastDate: chosen.date,
      nextDate: chosen.nextDue,
      dose: chosen.dose || null,
      daysUntil: diffDaysIso(chosen.nextDue, todayHst),
    });
  }

  return result;
}
