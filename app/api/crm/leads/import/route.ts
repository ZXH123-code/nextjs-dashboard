import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { recordLeadAssignmentChanges } from "@/app/lib/crm";

type LeadRow = {
  客户名称?: unknown;
  昵称?: unknown;
  城市?: unknown;
  详细地址?: unknown;
  行业?: unknown;
  线索来源?: unknown;
  客户分层?: unknown;
  销售人员邮箱?: unknown;
  状态?: unknown;
  /** 建议表头：联系人 */
  联系人?: unknown;
  /** 建议表头：联系人邮箱 */
  联系人邮箱?: unknown;
  /** 建议表头：备注 或 线索备注 */
  备注?: unknown;
  [key: string]: unknown;
};


/** 将 Excel 解析出的任意类型转为字符串再 trim，避免数字等类型无 trim 报错 */
function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

type RowPreview = {
  row: number;
  status: "success" | "error";
  message?: string;
  data: {
    客户名称: string;
    昵称?: string;
    联系人?: string;
    城市?: string;
    详细地址?: string;
    行业?: string;
    线索来源?: string;
    客户分层?: string;
    预览销售人员?: string;
    状态: string;
    其他字段数?: number;
  };
};

type LeadMappingEntry = {
  targetField: string | null;
};

type LeadMapping = Record<string, LeadMappingEntry>;

const ALLOWED_TARGET_FIELDS = new Set<string>([
  "customerName",
  "nickname",
  "contactPerson",
  "contactEmail",
  "contactPhone",
  "city",
  "address",
  "industry",
  "leadSource",
  "customerTier",
  "remark",
]);

/** 安全截断字符串，避免超过数据库字段长度导致 P2000 错误 */
function truncate(str: string | undefined, max: number): string | undefined {
  if (str == null || str === "") return undefined;
  return str.length > max ? str.slice(0, max) : str;
}

export async function POST(req: Request) {
  // 权限校验：仅 admin 可导入
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | null;
  const userId = user?.id ?? null;
  const role = user?.role ?? "sales";
  if (role !== "admin") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const formData = await req.formData();
  const mode = (formData.get("mode") as string | null) ?? "preview";
  const isPreviewOnly = mode === "preview";
  const file = formData.get("file");
  /** 批量指定销售人员：导入时若提供，则所有线索均分配给该销售，覆盖 Excel 中的销售人员邮箱 */
  const batchSalesPersonId = (formData.get("salesPersonId") as string) || null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "请上传 Excel 文件" }, { status: 400 });
  }

  if (!file.name.endsWith(".xlsx")) {
    return NextResponse.json({ error: "目前仅支持 .xlsx 格式" }, { status: 400 });
  }

  // 限制文件大小，避免误传超大文件（默认 5MB）
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "文件过大，请控制在 5MB 以内" }, { status: 400 });
  }

  try {
    // 解析可选的前端字段映射配置
    let mapping: LeadMapping | null = null;
    const mappingRaw = formData.get("mapping");
    if (typeof mappingRaw === "string" && mappingRaw.trim()) {
      try {
        const parsed = JSON.parse(mappingRaw) as unknown;
        if (parsed && typeof parsed === "object") {
          const obj: LeadMapping = {};
          for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (!key) continue;
            const v = value as { targetField?: unknown } | null;
            const tf = v && typeof v === "object" ? (v.targetField as unknown) : undefined;
            if (tf === null) {
              // 显式选择「忽略该列」
              obj[key] = { targetField: null };
            } else if (typeof tf === "string" && ALLOWED_TARGET_FIELDS.has(tf)) {
              obj[key] = { targetField: tf };
            }
          }
          mapping = Object.keys(obj).length > 0 ? obj : null;
        }
      } catch {
        // 映射解析失败时忽略，继续走旧逻辑
        mapping = null;
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<LeadRow>(sheet, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json({ error: "表格内容为空" }, { status: 400 });
    }

    const errors: { row: number; message: string }[] = [];
    const rowPreview: RowPreview[] = [];

    // 若批量指定了销售人员，校验该用户存在，并记录名称用于预览展示
    let resolvedBatchSalesId: string | null = null;
    let resolvedBatchSalesName: string | null = null;
    if (batchSalesPersonId && batchSalesPersonId.trim()) {
      const u = await prisma.users.findUnique({
        where: { id: batchSalesPersonId.trim() },
        select: { id: true, name: true },
      });
      if (!u) {
        return NextResponse.json(
          { error: "指定的销售人员不存在，请重新选择" },
          { status: 400 }
        );
      }
      resolvedBatchSalesId = u.id;
      resolvedBatchSalesName = u.name;
    }

    const dataToInsert: Prisma.crm_leadCreateManyInput[] = [];

    const CANONICAL_HEADERS = new Set<string>([
      "客户名称",
      "昵称",
      "城市",
      "详细地址",
      "行业",
      "线索来源",
      "客户分层",
      "联系人",
      "联系人邮箱",
      "备注",
      // 一些常见的联系方式表头，统一映射到 contactPhone
      "手机号",
      "手机",
      "手机号码",
      "电话",
      "电话号",
      "联系电话",
      "座机",
      "传真",
      "传真号",
    ]);

    // 反向索引：某个标准字段对应了哪些 Excel 表头（来自 AI/用户映射）
    const headersByTargetField: Record<string, string[]> = {};
    if (mapping) {
      for (const [header, entry] of Object.entries(mapping)) {
        if (!entry || !entry.targetField) continue;
        if (!headersByTargetField[entry.targetField]) {
          headersByTargetField[entry.targetField] = [];
        }
        headersByTargetField[entry.targetField].push(header);
      }
    }

    function getMappedStr(
      row: LeadRow,
      targetField: string,
      fallbackChineseHeaders: (keyof LeadRow)[],
    ): string {
      const headers = headersByTargetField[targetField] ?? [];
      for (const header of headers) {
        const v = (row as Record<string, unknown>)[header];
        const s = toStr(v);
        if (s) return s;
      }
      for (const key of fallbackChineseHeaders) {
        const v = row[key];
        const s = toStr(v);
        if (s) return s;
      }
      return "";
    }

    const importSource =
      typeof file.name === "string" && file.name.trim()
        ? file.name.trim().slice(0, 100)
        : undefined;

    // 记录导入开始时间，用于后续查询本次导入创建的线索
    const importStartedAt = new Date();

    rows.forEach((row: LeadRow, index: number) => {
      const rowNum = index + 1; // 记录序号，从1开始
      const customerNameRaw = getMappedStr(row, "customerName", ["客户名称"]);
      const customerName = truncate(customerNameRaw, 255) ?? "";
      if (!customerName) {
        const message = "客户名称为空";
        errors.push({ row: rowNum, message });
        rowPreview.push({
          row: rowNum,
          status: "error",
          message,
          data: {
            客户名称: customerName,
            昵称: truncate(getMappedStr(row, "nickname", ["昵称"]), 100),
            联系人: truncate(getMappedStr(row, "contactPerson", ["联系人"]), 100),
            城市: truncate(getMappedStr(row, "city", ["城市"]), 100),
            详细地址: truncate(getMappedStr(row, "address", ["详细地址"]), 500),
            行业: truncate(getMappedStr(row, "industry", ["行业"]), 100),
            线索来源: truncate(getMappedStr(row, "leadSource", ["线索来源"]), 100),
            客户分层: truncate(getMappedStr(row, "customerTier", ["客户分层"]), 50),
            状态: "未跟进",
          },
        });
        return;
      }

      // 负责人：当前版本仅支持「批量指定」（导入后统一写入负责人关联表），未指定时全部为未分配

      // 组装扩展字段：所有非规范表头、且有值的列
      const extraFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        // 映射为标准字段或显式忽略的列都不再进入 extraFields
        const mapped = mapping?.[key];
        if (mapped && (mapped.targetField === null || mapped.targetField)) {
          continue;
        }
        if (!CANONICAL_HEADERS.has(key)) {
          const str = toStr(value);
          if (str.length > 0) {
            extraFields[key] = value;
          }
        }
      }
      const extraCount = Object.keys(extraFields).length;

      const nickname = truncate(getMappedStr(row, "nickname", ["昵称"]), 100);
      const contactPerson = truncate(getMappedStr(row, "contactPerson", ["联系人"]), 100);
      const contactEmail = truncate(getMappedStr(row, "contactEmail", ["联系人邮箱"]), 255);
      const contactPhone = truncate(
        getMappedStr(row, "contactPhone", [
          "手机号",
          "手机",
          "手机号码",
          "电话",
          "电话号",
          "联系电话",
          "座机",
          "传真",
          "传真号",
        ]),
        20,
      );
      const city = truncate(getMappedStr(row, "city", ["城市"]), 100);
      const address = truncate(getMappedStr(row, "address", ["详细地址"]), 500);
      const industry = truncate(getMappedStr(row, "industry", ["行业"]), 100);
      const leadSource = truncate(getMappedStr(row, "leadSource", ["线索来源"]), 100);
      const customerTier = truncate(getMappedStr(row, "customerTier", ["客户分层"]), 50);
      const remark = truncate(getMappedStr(row, "remark", ["备注"]), 500);

      dataToInsert.push({
        customerName,
        nickname,
        contactPerson,
        contactEmail,
        contactPhone,
        city,
        address,
        industry,
        leadSource,
        customerTier,
        remark,
        status: "未跟进",
        importSource,
        extraFields: extraCount > 0 ? (extraFields as Prisma.InputJsonValue) : undefined,
      });

      rowPreview.push({
        row: rowNum,
        status: "success",
        data: {
          客户名称: customerName,
          昵称: nickname,
          联系人: contactPerson,
          城市: city,
          详细地址: address,
          行业: industry,
          线索来源: leadSource,
          客户分层: customerTier,
          预览销售人员: resolvedBatchSalesName ?? "未指定",
          状态: "未跟进",
          其他字段数: extraCount || undefined,
        },
      });
    });

    if (dataToInsert.length === 0) {
      return NextResponse.json(
        {
          mode,
          error: "没有可导入的数据，请检查表格格式和内容",
          errors,
          preview: rowPreview.slice(0, 50),
          willInsert: 0,
        },
        { status: 400 }
      );
    }

    if (isPreviewOnly) {
      // 仅预览，不写入数据库
      return NextResponse.json({
        mode,
        success: true,
        willInsert: dataToInsert.length,
        failed: errors.length,
        errors,
        preview: rowPreview.slice(0, 50),
      });
    }

    const result = await prisma.crm_lead.createMany({
      data: dataToInsert,
    });

    // 若本次导入时批量指定了负责人：写入负责人关联表，并记录变更通知，供管理员发送邮件
    if (!isPreviewOnly && resolvedBatchSalesId && userId && result.count > 0) {
      const newLeads = await prisma.crm_lead.findMany({
        where: {
          importSource,
          createdAt: { gte: importStartedAt },
        },
        select: { id: true },
      });
      if (newLeads.length > 0) {
        await prisma.crm_lead_assignee.createMany({
          data: newLeads.map((l) => ({ leadId: l.id, userId: resolvedBatchSalesId })),
          skipDuplicates: true,
        });
        await recordLeadAssignmentChanges(
          newLeads.map((l) => ({
            leadId: l.id,
            oldSalesPersonId: null,
            newSalesPersonId: resolvedBatchSalesId,
          })),
          userId,
        );
      }
    }

    return NextResponse.json({
      mode,
      success: true,
      inserted: result.count,
      failed: errors.length,
      errors,
      preview: rowPreview.slice(0, 50),
    });
  } catch (e) {
    console.error("导入线索失败:", e);
    return NextResponse.json(
      { error: "解析或导入 Excel 失败，请检查文件格式" },
      { status: 500 }
    );
  }
}

