import { Client } from "@notionhq/client";

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
 * 指定データベースの全レコードをページネーションを辿って取得する。
 */
export async function queryAllRows(
  databaseId: string
): Promise<Record<string, unknown>[]> {
  const notion = getNotionClient();
  const dataSourceId = await resolveDataSourceId(databaseId);

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
