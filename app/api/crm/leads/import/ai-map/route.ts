import { NextResponse } from "next/server";
import { auth } from "@/auth";
import * as XLSX from "xlsx";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_SAMPLE_ROWS = 30;

type LeadTargetFieldId =
  | "customerName"
  | "nickname"
  | "contactPerson"
  | "contactEmail"
  | "contactPhone"
  | "city"
  | "address"
  | "industry"
  | "leadSource"
  | "customerTier"
  | "remark";

type LeadTargetFieldMeta = {
  id: LeadTargetFieldId;
  label: string;
  description: string;
  required?: boolean;
  dbColumn: string;
};

type LeadImportColumn = {
  excelHeader: string;
  sampleValues: string[];
};

type LeadImportColumnSuggestion = {
  excelHeader: string;
  suggestedField: LeadTargetFieldId | null;
  confidence: number | null;
  reason?: string;
  conflict?: boolean;
  sampleValues?: string[];
};

type LeadImportMappingResult = {
  columns: LeadImportColumnSuggestion[];
};

function getOpenAIForImport(): {
  provider: ReturnType<typeof createOpenAI>;
  modelId: string;
  useChat: boolean;
} {
  const gatewayOpenai = createOpenAI({
    baseURL: process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh/v1",
    apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
  });
  const deepseekOpenai = createOpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  });
  const directOpenai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

  if (process.env.AI_GATEWAY_API_KEY) {
    return {
      provider: gatewayOpenai,
      modelId: process.env.AI_GATEWAY_MODEL ?? "deepseek/deepseek-v3.2",
      useChat: false,
    };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      provider: deepseekOpenai,
      modelId: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      useChat: true,
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: directOpenai,
      modelId: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      useChat: true,
    };
  }
  return {
    provider: gatewayOpenai,
    modelId: process.env.AI_GATEWAY_MODEL ?? "deepseek/deepseek-v3.2",
    useChat: false,
  };
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlock) {
    return codeBlock[1].trim();
  }
  return trimmed;
}

const mappingSchema = z.object({
  mappings: z
    .array(
      z.object({
        excel_header: z.string(),
        target_field: z.string().nullable().optional(),
        confidence: z.number().min(0).max(1).nullable().optional(),
        reason: z.string().optional(),
      }),
    )
    .default([]),
});

async function suggestLeadImportMapping(
  columns: LeadImportColumn[],
  targetFields: LeadTargetFieldMeta[],
): Promise<LeadImportMappingResult> {
  const apiKey =
    process.env.AI_GATEWAY_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { columns: [] };
  }

  if (!columns.length) {
    return { columns: [] };
  }

  const { provider, modelId, useChat } = getOpenAIForImport();
  const model = useChat ? provider.chat(modelId) : provider(modelId);

  const targetFieldsDesc = targetFields
    .map(
      (f) =>
        `- ${f.id}: ${f.label}（${f.description}，数据库列名：${f.dbColumn}${
          f.required ? "，必填" : "，可为空"
        }）`,
    )
    .join("\n");

  const columnsDesc = columns
    .map((c) => {
      const samples = c.sampleValues.slice(0, 10).join(" | ") || "(空列或全为空)";
      return `- 表头: "${c.excelHeader}", 示例值: ${samples}`;
    })
    .join("\n");

  const systemPrompt =
    "你是 CRM 线索导入的专家，任务是根据 Excel 列表头和示例值，判断每一列最可能对应的标准字段。" +
    "请只输出 JSON，且字段含义要非常准确，避免过度猜测。" +
    "如果无法确定对应哪个标准字段，可以将 target_field 设为 null，表示该列适合作为扩展字段保存到 extraFields。" +
    "手机号、固定电话、座机、传真号等各种电话类字段，应统一映射到 contactPhone，一个线索只保留一列联系方式。" +
    "不要输出多余解释或 markdown 代码块。";

  const userPrompt =
    `这是可用的标准字段列表（id 用于输出 target_field）：\n\n${targetFieldsDesc}\n\n` +
    `下面是 Excel 的列头和若干示例值，请你为每一列给出映射建议：\n\n${columnsDesc}\n\n` +
    `请严格输出一个 JSON 对象，格式为：\n` +
    `{"mappings":[{"excel_header":"原始表头","target_field":"customerName 或其他 id 或 null","confidence":0.0-1.0 的数字,"reason":"简短中文原因"},...]}\n` +
    `要求：\n` +
    `1. 每个 excel_header 必须在 mappings 中出现一次。\n` +
    `2. target_field 只能是上方字段列表中的 id，或 null；不要发明新字段名。\n` +
    `3. confidence 必须在 0～1 之间，0.9 以上表示非常确定，0.6～0.9 表示大致合理，低于 0.6 表示不太确定。\n` +
    `4. 严禁输出 JSON 以外的内容。`;

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
  });

  const raw = extractJson(text);

  let parsed: z.infer<typeof mappingSchema>;
  try {
    parsed = mappingSchema.parse(JSON.parse(raw));
  } catch {
    return { columns: [] };
  }

  const allowedIds = new Set<LeadTargetFieldId>(targetFields.map((f) => f.id));

  const byHeader: Record<string, LeadImportColumnSuggestion> = {};

  for (const col of columns) {
    byHeader[col.excelHeader] = {
      excelHeader: col.excelHeader,
      suggestedField: null,
      confidence: null,
    };
  }

  for (const m of parsed.mappings) {
    const header = m.excel_header;
    if (!header || !(header in byHeader)) continue;

    const suggestion = byHeader[header];
    const tf = (m.target_field ?? null) as LeadTargetFieldId | null;
    const validTarget = tf && allowedIds.has(tf) ? tf : null;
    let confidence: number | null = null;
    if (typeof m.confidence === "number" && !Number.isNaN(m.confidence)) {
      confidence = Math.min(1, Math.max(0, m.confidence));
    }

    suggestion.suggestedField = validTarget;
    suggestion.confidence = confidence;
    if (m.reason) suggestion.reason = m.reason;
  }

  const byTarget: Record<string, LeadImportColumnSuggestion[]> = {};
  for (const s of Object.values(byHeader)) {
    if (!s.suggestedField) continue;
    if (!byTarget[s.suggestedField]) byTarget[s.suggestedField] = [];
    byTarget[s.suggestedField].push(s);
  }

  // 保证 contactPhone 最多只映射一列：若模型给了多列，保留置信度最高的一列，其余列视为未映射
  const contactPhoneList = byTarget["contactPhone"];
  if (contactPhoneList && contactPhoneList.length > 1) {
    contactPhoneList.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const [, ...rest] = contactPhoneList;
    for (const s of rest) {
      s.suggestedField = null;
    }
  }

  // 重新构建 byTarget（因为上面对部分列清除了 suggestedField）
  const byTargetClean: Record<string, LeadImportColumnSuggestion[]> = {};
  for (const s of Object.values(byHeader)) {
    if (!s.suggestedField) continue;
    if (!byTargetClean[s.suggestedField]) byTargetClean[s.suggestedField] = [];
    byTargetClean[s.suggestedField].push(s);
  }

  const requiredIds = new Set<LeadTargetFieldId>(
    targetFields.filter((f) => f.required).map((f) => f.id),
  );
  for (const [target, list] of Object.entries(byTargetClean)) {
    if (!requiredIds.has(target as LeadTargetFieldId)) continue;
    if (list.length <= 1) continue;
    list.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const top = list[0];
    const second = list[1];
    if ((top.confidence ?? 0) - (second.confidence ?? 0) < 0.15) {
      for (const s of list) s.conflict = true;
    }
  }

  return { columns: Object.values(byHeader) };
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
  if (role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "请上传 Excel 文件" }, { status: 400 });
  }

  if (!file.name.endsWith(".xlsx")) {
    return NextResponse.json({ error: "目前仅支持 .xlsx 格式" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "文件过大，请控制在 5MB 以内" }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (!rows.length) {
      return NextResponse.json({ error: "表格内容为空" }, { status: 400 });
    }

    const firstRow = rows[0] as Record<string, unknown>;
    const headers = Object.keys(firstRow);

    if (!headers.length) {
      return NextResponse.json({ error: "未识别到表头，请检查第一行是否为表头" }, { status: 400 });
    }

    const limitedRows = rows.slice(0, MAX_SAMPLE_ROWS);

    const columns: LeadImportColumn[] = headers.map((header) => {
      const values = new Set<string>();
      for (const r of limitedRows) {
        const raw = (r as Record<string, unknown>)[header];
        const str = raw == null ? "" : String(raw).trim();
        if (str) {
          values.add(str);
        }
        if (values.size >= 10) break;
      }
      return {
        excelHeader: header,
        sampleValues: Array.from(values),
      };
    });

    const targetFields: LeadTargetFieldMeta[] = [
      {
        id: "customerName",
        label: "客户名称",
        description: "公司/客户的全称或主要名称，导入后为必填字段",
        required: true,
        dbColumn: "customer_name",
      },
      {
        id: "nickname",
        label: "昵称",
        description: "客户简称或内部叫法，用于在列表中更易识别",
        dbColumn: "nickname",
      },
      {
        id: "contactPerson",
        label: "联系人",
        description: "主要联系人姓名，如“张三”“李总”等",
        dbColumn: "contact_person",
      },
      {
        id: "contactEmail",
        label: "联系人邮箱",
        description: "主要联系人使用的邮箱地址",
        dbColumn: "contact_email",
      },
      {
        id: "contactPhone",
        label: "联系方式（手机号/电话）",
        description: "客户的主要联系方式，可以是手机号、固话或传真号等，统一存放在一列",
        dbColumn: "contact_phone",
      },
      {
        id: "city",
        label: "城市",
        description: "客户所在城市，如“上海”“深圳”等",
        dbColumn: "city",
      },
      {
        id: "address",
        label: "详细地址",
        description: "更详细的地址信息，例如街道、园区、楼层等",
        dbColumn: "address",
      },
      {
        id: "industry",
        label: "行业",
        description: "客户所属行业，如“制造业”“互联网”等",
        dbColumn: "industry",
      },
      {
        id: "leadSource",
        label: "线索来源",
        description: "线索来源渠道，如“展会”“官网”“转介绍”等",
        dbColumn: "lead_source",
      },
      {
        id: "customerTier",
        label: "客户分层",
        description: "客户等级或分层，如“A/B/C”等",
        dbColumn: "customer_tier",
      },
      {
        id: "remark",
        label: "备注",
        description: "线索备注或需求简要说明",
        dbColumn: "remark",
      },
    ];

    const aiResult = await suggestLeadImportMapping(columns, targetFields);

    const samplesByHeader = new Map<string, string[]>(
      columns.map((c) => [c.excelHeader, c.sampleValues]),
    );
    const mergedColumns = aiResult.columns.map((c) => ({
      ...c,
      sampleValues: samplesByHeader.get(c.excelHeader) ?? [],
    }));

    return NextResponse.json(
      {
        success: true,
        columns: mergedColumns,
        targetFields,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error("AI 字段映射解析失败:", e);
    return NextResponse.json(
      {
        success: false,
        error: "解析 Excel 或调用 AI 映射失败，请稍后重试，或手动选择字段映射",
      },
      { status: 500 },
    );
  }
}

