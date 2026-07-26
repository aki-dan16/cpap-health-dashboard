import { Client } from "@notionhq/client";
import { parseDateTs } from "@/lib/health";
import type { MedicationEntry, UpcomingTask } from "@/lib/types";

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
 * data_source_id を直接指定して全レコードをページネーションで取得する。
 * database_id を持たず data_source_id が既知の場合（E. 次回タスク等）に使う。
 */
export async function queryAllRowsByDataSource(
  dataSourceId: string
): Promise<Record<string, unknown>[]> {
  const notion = getNotionClient();

  const rows: Record<string, unknown>[] = [];
  let cursor: string | undefined = undefined;

  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results) {
      // ページオブジェクトの properties を取り出す
      const props = (page as { properties?: Record<string, unknown> })
        .properties;
      if (props) rows.push(props);
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);

  return rows;
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
