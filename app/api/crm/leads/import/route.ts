import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

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

export async function POST(req: Request) {
  // 权限校验：仅 admin 可导入
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";
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
    ]);

    rows.forEach((row: LeadRow, index: number) => {
      const rowNum = index + 1; // 记录序号，从1开始
      const customerName = toStr(row.客户名称);
      if (!customerName) {
        const message = "客户名称为空";
        errors.push({ row: rowNum, message });
        rowPreview.push({
          row: rowNum,
          status: "error",
          message,
          data: {
            客户名称: customerName,
            昵称: toStr(row.昵称) || undefined,
            联系人: toStr(row.联系人) || undefined,
            城市: toStr(row.城市) || undefined,
            详细地址: toStr(row.详细地址) || undefined,
            行业: toStr(row.行业) || undefined,
            线索来源: toStr(row.线索来源) || undefined,
            客户分层: toStr(row.客户分层) || undefined,
            状态: "未跟进",
          },
        });
        return;
      }

      // 销售人员：当前版本仅支持「批量指定」，未指定时全部为未分配
      const salesPersonId: string | null = resolvedBatchSalesId;

      // 组装扩展字段：所有非规范表头、且有值的列
      const extraFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!CANONICAL_HEADERS.has(key)) {
          const str = toStr(value);
          if (str.length > 0) {
            extraFields[key] = value;
          }
        }
      }
      const extraCount = Object.keys(extraFields).length;

      dataToInsert.push({
        customerName,
        nickname: toStr(row.昵称) || undefined,
        contactPerson: toStr(row.联系人) || undefined,
        contactEmail: toStr(row.联系人邮箱) || undefined,
        city: toStr(row.城市) || undefined,
        address: toStr(row.详细地址) || undefined,
        industry: toStr(row.行业) || undefined,
        leadSource: toStr(row.线索来源) || undefined,
        customerTier: toStr(row.客户分层) || undefined,
        remark: toStr(row.备注) || undefined,
        salesPersonId: salesPersonId || undefined,
        status: "未跟进",
        extraFields: extraCount > 0 ? (extraFields as Prisma.InputJsonValue) : undefined,
      });

      rowPreview.push({
        row: rowNum,
        status: "success",
        data: {
          客户名称: customerName,
          昵称: toStr(row.昵称) || undefined,
          联系人: toStr(row.联系人) || undefined,
          城市: toStr(row.城市) || undefined,
          详细地址: toStr(row.详细地址) || undefined,
          行业: toStr(row.行业) || undefined,
          线索来源: toStr(row.线索来源) || undefined,
          客户分层: toStr(row.客户分层) || undefined,
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

