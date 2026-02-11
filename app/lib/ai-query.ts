"use server";

import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { getCrmAuth } from "./crm";
import { prisma } from "./prisma";

const MAX_ROWS = 500;
const MAX_QUERIES = 5;

/** AI 问数使用只读 DB 连接（若配置了 DATABASE_URL_READONLY），避免越权写操作。见 docs/AI_问数_只读数据库用户.md */
let readOnlyPrisma: PrismaClient | null = null;
function getReadOnlyPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL_READONLY;
  if (url) {
    if (!readOnlyPrisma) {
      readOnlyPrisma = new PrismaClient({ datasources: { db: { url } } });
    }
    return readOnlyPrisma;
  }
  return prisma;
}

/** 三种方式（优先级）：Gateway 需 Vercel 绑卡；DeepSeek/OpenAI 直连只需各自 API Key */
const gatewayOpenai = createOpenAI({
  baseURL: process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
});
const deepseekOpenai = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
});
const directOpenai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

/** 直连 DeepSeek/OpenAI 时用 .chat() 走 /chat/completions，否则 SDK 默认走 Responses API 会 404 */
function getOpenAI(): { provider: ReturnType<typeof createOpenAI>; modelId: string; useChat: boolean } {
  if (process.env.AI_GATEWAY_API_KEY) {
    return { provider: gatewayOpenai, modelId: process.env.AI_GATEWAY_MODEL ?? "deepseek/deepseek-v3.2", useChat: false };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return { provider: deepseekOpenai, modelId: process.env.DEEPSEEK_MODEL ?? "deepseek-chat", useChat: true };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: directOpenai, modelId: process.env.OPENAI_MODEL ?? "gpt-4o-mini", useChat: true };
  }
  return { provider: gatewayOpenai, modelId: process.env.AI_GATEWAY_MODEL ?? "deepseek/deepseek-v3.2", useChat: false };
}

function buildSchemaPrompt(auth: { userId: string; role: string }): string {
  const isAdmin = auth.role === "admin";
  const userId = auth.userId;

  return `你是 PostgreSQL 与 CRM 数据专家。根据用户自然语言问题生成 1～${MAX_QUERIES} 条 SELECT 查询（仅当问题需要多步、多角度数据时生成多条），只读 CRM 数据。

## 可用的表（仅限以下 CRM 表，使用表名与列名的数据库实际名称）

- users (id UUID, name VARCHAR, email VARCHAR, role VARCHAR) — 用户/销售人员
- crm_leads (id, customer_name, nickname, city, address, industry, lead_source, contact_phone, created_at, customer_tier, sales_person_id, status, is_key_focus, key_focus_by_admin, deleted_at) — 线索；status: 未跟进|跟进中|有意向|无意向
- crm_opportunities (id, name, lead_id, product_type, status, amount, contact_phone, created_at, expected_close_date, sales_person_id, delivery_person_id, lost_reason, is_key_focus, key_focus_by_admin) — 商机；status: 初步沟通|方案确认|待签约|已赢单|已丢单
- crm_customers (id, name, nickname, city, customer_tier, first_maintenance_date, status, industry, employee_count, tags, main_products, contact_phone, opportunity_id, actual_amount, sales_person_id, created_at, is_key_focus, key_focus_by_admin) — 客户；status: 预备签约|已签约|流失
- crm_follow_ups (id, content, follow_up_by_id, follow_date, contact_person, summary, next_step, customer_needs, status, lead_id, customer_id, opportunity_id, created_at, updated_at) — 跟进记录

关联：crm_leads.sales_person_id -> users.id；crm_opportunities.lead_id -> crm_leads.id, sales_person_id -> users.id；crm_customers.opportunity_id -> crm_opportunities.id, sales_person_id -> users.id；crm_follow_ups.lead_id/customer_id/opportunity_id 关联对应表，follow_up_by_id -> users.id。

## 规则（必须遵守）

1. 每条只能是单独的 SELECT，不要分号、不要多条写在一句里。返回一个查询数组，简单问题 1 条，需要对比/综合时 2～${MAX_QUERIES} 条。
2. 每条默认在末尾加 LIMIT ${MAX_ROWS}，除非用户明确要求更多。
3. 当前用户角色：${isAdmin ? "admin（可查看全部数据）" : "sales（仅能查看自己负责的数据）"}。
4. 若当前用户为 sales，涉及 crm_leads、crm_opportunities、crm_customers 时必须在 WHERE 中加上 sales_person_id 限制，例如 \`sales_person_id = '${userId}'\` 或通过 JOIN users 过滤。
5. 查询 crm_leads 时只查未删除的：deleted_at IS NULL。
6. 使用数据库列名（snake_case），如 customer_name、sales_person_id、created_at。
7. 日期比较使用标准 PostgreSQL 语法，如 created_at >= '2024-01-01'。`;
}

/**
 * 将不可 JSON 序列化的值转为可序列化，避免 Server Action 返回或 JSON.stringify 报错。
 * 已覆盖：BigInt、Date、Symbol、Prisma Decimal、循环引用；其余（undefined/NaN/Infinity 等由 JSON.stringify 处理）。
 */
function sanitizeForJson<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return String(value) as T;
  if (typeof value === "symbol") return String(value) as T;
  if (value instanceof Date) return value.toISOString() as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeForJson(v, seen)) as T;
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]" as T;
    seen.add(value);
    // Prisma / decimal.js 的 Decimal 类型
    const name = Object.getPrototypeOf(value)?.constructor?.name;
    if (name === "Decimal" && typeof (value as { toString?: () => string }).toString === "function") {
      return (value as { toString: () => string }).toString() as T;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeForJson(v, seen);
    return out as T;
  }
  return value;
}

/** DeepSeek 不支持 response_format，用 generateText 返回的 JSON 字符串解析出 queries */
function parseQueriesFromText(text: string): string[] {
  const trimmed = text.trim();
  let jsonStr = trimmed;
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  try {
    const parsed = JSON.parse(jsonStr) as { queries?: string[] };
    if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
    if (parsed?.queries && Array.isArray(parsed.queries)) {
      return parsed.queries.map((s) => String(s).trim()).filter(Boolean);
    }
  } catch {
    // 忽略解析错误，返回空由上层报错
  }
  return [];
}

function validateSelectOnly(sql: string): { ok: true } | { ok: false; error: string } {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  const upper = trimmed.toUpperCase();
  if (!upper.startsWith("SELECT")) {
    return { ok: false, error: "仅允许 SELECT 查询" };
  }
  // 按整词匹配，避免误伤列名如 deleted_at（含 DELETE 子串）
  const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE", "GRANT", "REVOKE", "EXECUTE"];
  for (const kw of forbidden) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(trimmed)) {
      return { ok: false, error: `查询中不允许包含 ${kw}` };
    }
  }
  if (trimmed.includes(";")) {
    return { ok: false, error: "仅允许单条语句" };
  }
  return { ok: true };
}

export type AskAiQuestionResult =
  | { success: true; answer: string; show_raw_table: boolean; rows?: Record<string, unknown>[]; columns?: string[]; executedQueries?: string[] }
  | { success: false; error: string; generatedQueries?: string[] };

/** 保证返回纯 JSON 可序列化对象，避免 RSC 序列化时带上 constructor 等导致 "Functions cannot be passed to Client Components" */
function toSerializable<T extends AskAiQuestionResult>(result: T): T {
  return JSON.parse(JSON.stringify(result)) as T;
}

export async function askAiQuestionAction(question: string): Promise<AskAiQuestionResult> {
  const auth = await getCrmAuth();
  if (!auth) {
    return toSerializable({ success: false, error: "请先登录" });
  }

  const q = question?.trim();
  if (!q) {
    return toSerializable({ success: false, error: "请输入问题" });
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return toSerializable({ success: false, error: "未配置 AI API Key（AI_GATEWAY_API_KEY / DEEPSEEK_API_KEY / OPENAI_API_KEY 任选其一）" });
  }

  try {
    const { provider, modelId, useChat } = getOpenAI();
    const model = useChat ? provider.chat(modelId) : provider(modelId);
    const schemaPrompt = buildSchemaPrompt(auth);
    const db = getReadOnlyPrisma();

    const isDeepSeek = !!process.env.DEEPSEEK_API_KEY;
    let queries: string[];

    if (isDeepSeek) {
      const { text } = await generateText({
        model,
        system: schemaPrompt,
        prompt: `根据以下用户问题生成 1～${MAX_QUERIES} 条 PostgreSQL SELECT 查询。只返回一个 JSON 对象，格式为 {"queries": ["SELECT ...", "SELECT ..."]}，不要其他说明或 markdown。\n\n用户问题：${q}`,
      });
      queries = parseQueriesFromText(text).map((s) => s.replace(/;\s*$/, ""));
    } else {
      const { object } = await generateObject({
        model,
        system: schemaPrompt,
        prompt: `根据以下用户问题生成 1～${MAX_QUERIES} 条 PostgreSQL SELECT 查询，以 JSON 数组形式返回（如 ["SELECT ...", "SELECT ..."]）。简单问题一条即可，需要多步或多角度时多条。不要解释。\n\n用户问题：${q}`,
        schema: z.object({
          queries: z.array(z.string()).min(1).max(MAX_QUERIES),
        }),
      });
      queries = object.queries.map((s) => s.trim().replace(/;\s*$/, "")).filter(Boolean);
    }

    if (queries.length === 0) {
      return toSerializable({ success: false, error: "未生成有效查询" });
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[AI 问数] 即将执行 SQL：");
      queries.forEach((sql, i) => console.log(`  [${i + 1}]`, sql));
    }

    const allResults: Record<string, unknown>[][] = [];
    for (const rawQuery of queries) {
      const validation = validateSelectOnly(rawQuery);
      if (!validation.ok) {
        return toSerializable({ success: false, error: validation.error, generatedQueries: queries });
      }
      const rows = (await db.$queryRawUnsafe(rawQuery)) as Record<string, unknown>[];
      allResults.push(rows.slice(0, MAX_ROWS));
    }

    const firstNonEmpty = allResults.find((r) => r.length > 0);
    const limited = firstNonEmpty ?? allResults[0] ?? [];
    const columns = limited.length > 0 ? Object.keys(limited[0]) : [];

    const dataSnippet = allResults
      .map((rows, i) => `【查询 ${i + 1}】共 ${rows.length} 条\n${JSON.stringify(sanitizeForJson(rows.slice(0, 30)), null, 2)}`)
      .join("\n\n");
    const summaryPrompt = `用户问题：${q}\n\n以下为 ${allResults.length} 个查询的原始结果（每份已截取前 30 条）：\n\n${dataSnippet}\n\n请你做两件事（必须返回合法 JSON）：\n1. 综合以上结果，用简洁中文回答用户问题；若都为空可说明没有匹配数据。你可以在回答中用 Markdown 表格（如 | 列A | 列B |\\n|--|--|\\n| 1 | 2 |）来重组、汇总数据，或只写文字概括。\n2. 决定是否在回答下方「附带展示原始查询结果表」：当原始结果行数少、列名清晰、直接展示有助于对照时设为 true；当结果很多或你已在回答中用文字/表格概括完毕时设为 false。\n\n只返回一个 JSON 对象，格式：{"answer":"你的回答内容","show_raw_table":true 或 false}。不要其他说明、不要 markdown 代码块包裹。`;

    const { text: summaryText } = await generateText({
      model,
      prompt: summaryPrompt,
    });

    let answer = "未生成回答。";
    let show_raw_table = true;
    try {
      const raw = summaryText.trim().replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(raw) as { answer?: string; show_raw_table?: boolean };
      if (typeof parsed.answer === "string") answer = parsed.answer;
      if (typeof parsed.show_raw_table === "boolean") show_raw_table = parsed.show_raw_table;
    } catch {
      if (summaryText?.trim()) answer = summaryText.trim();
    }

    return toSerializable({
      success: true,
      answer,
      show_raw_table,
      rows: limited.length > 0 ? (sanitizeForJson(limited) as Record<string, unknown>[]) : undefined,
      columns: columns.length > 0 ? columns : undefined,
      executedQueries: queries,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const full = err instanceof Error ? err.stack ?? message : String(err);
    if (process.env.NODE_ENV === "development") {
      console.error("[AI 问数] 错误:", full);
    }
    if (message.includes("Invalid") || message.includes("syntax") || message.includes("query")) {
      return toSerializable({ success: false, error: "生成的查询无法执行，请换一种方式提问" });
    }
    if (message.includes("401") || message.includes("403") || message.includes("API key") || message.includes("Unauthorized")) {
      return toSerializable({ success: false, error: "AI API Key 未配置或无效，请检查当前使用的 Key（AI_GATEWAY_API_KEY / DEEPSEEK_API_KEY / OPENAI_API_KEY）" });
    }
    if (message.includes("model") && (message.includes("not found") || message.includes("invalid"))) {
      return toSerializable({ success: false, error: "当前模型不可用，请检查 AI_GATEWAY_MODEL 或在 Vercel 控制台启用对应提供商" });
    }
    if (message.includes("credit card") || message.includes("add a card")) {
      return toSerializable({ success: false, error: "Vercel AI Gateway 需在控制台绑卡才能使用免费额度。若不想绑卡，请只配置 OPENAI_API_KEY 或 DEEPSEEK_API_KEY（直连），并删除 AI_GATEWAY_API_KEY。" });
    }
    return toSerializable({ success: false, error: "请求失败，请稍后重试" });
  }
}
