import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import * as XLSX from "xlsx";

type LeadRow = {
  客户名称?: string;
  昵称?: string;
  城市?: string;
  详细地址?: string;
  行业?: string;
  线索来源?: string;
  客户分层?: string;
  销售人员邮箱?: string;
  状态?: string;
};

const ALLOWED_STATUS = new Set(["未跟进", "跟进中", "有意向", "无意向"]);

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
    城市?: string;
    详细地址?: string;
    行业?: string;
    线索来源?: string;
    客户分层?: string;
    销售人员邮箱?: string;
    状态: string;
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

    // 预取所有涉及到的销售邮箱，避免每行查一次
    const salesEmails: string[] = Array.from(
      new Set(
        rows
          .map((r: LeadRow) => toStr(r.销售人员邮箱))
          .filter((e: string) => e.length > 0)
      )
    );

    const users =
      salesEmails.length > 0
        ? await prisma.users.findMany({
          where: { email: { in: salesEmails } },
          select: { id: true, email: true },
        })
        : [];

    const emailToUserId = new Map(users.map((u) => [u.email, u.id]));

    const dataToInsert: {
      customerName: string;
      nickname?: string;
      city?: string;
      address?: string;
      industry?: string;
      leadSource?: string;
      customerTier?: string;
      salesPersonId?: string;
      status: string;
    }[] = [];

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
            城市: toStr(row.城市) || undefined,
            详细地址: toStr(row.详细地址) || undefined,
            行业: toStr(row.行业) || undefined,
            线索来源: toStr(row.线索来源) || undefined,
            客户分层: toStr(row.客户分层) || undefined,
            销售人员邮箱: toStr(row.销售人员邮箱) || undefined,
            状态: toStr(row.状态) || "未跟进",
          },
        });
        return;
      }

      let status = toStr(row.状态);
      if (!status) status = "未跟进";
      if (!ALLOWED_STATUS.has(status)) {
        const message = `状态不合法：${status}，仅支持 未跟进/跟进中/有意向/无意向`;
        errors.push({ row: rowNum, message });
        rowPreview.push({
          row: rowNum,
          status: "error",
          message,
          data: {
            客户名称: customerName,
            昵称: toStr(row.昵称) || undefined,
            城市: toStr(row.城市) || undefined,
            详细地址: toStr(row.详细地址) || undefined,
            行业: toStr(row.行业) || undefined,
            线索来源: toStr(row.线索来源) || undefined,
            客户分层: toStr(row.客户分层) || undefined,
            销售人员邮箱: toStr(row.销售人员邮箱) || undefined,
            状态: status,
          },
        });
        return;
      }

      let salesPersonId: string | undefined = undefined;
      const salesEmail = toStr(row.销售人员邮箱);
      if (salesEmail) {
        const uid = emailToUserId.get(salesEmail);
        if (!uid) {
          const message = `销售人员邮箱在系统中不存在：${salesEmail}`;
          errors.push({ row: rowNum, message });
          rowPreview.push({
            row: rowNum,
            status: "error",
            message,
            data: {
              客户名称: customerName,
              昵称: toStr(row.昵称) || undefined,
              城市: toStr(row.城市) || undefined,
              详细地址: toStr(row.详细地址) || undefined,
              行业: toStr(row.行业) || undefined,
              线索来源: toStr(row.线索来源) || undefined,
              客户分层: toStr(row.客户分层) || undefined,
              销售人员邮箱: salesEmail,
              状态: status,
            },
          });
          return;
        }
        salesPersonId = uid;
      }

      dataToInsert.push({
        customerName,
        nickname: toStr(row.昵称) || undefined,
        city: toStr(row.城市) || undefined,
        address: toStr(row.详细地址) || undefined,
        industry: toStr(row.行业) || undefined,
        leadSource: toStr(row.线索来源) || undefined,
        customerTier: toStr(row.客户分层) || undefined,
        salesPersonId,
        status,
      });

      rowPreview.push({
        row: rowNum,
        status: "success",
        data: {
          客户名称: customerName,
          昵称: toStr(row.昵称) || undefined,
          城市: toStr(row.城市) || undefined,
          详细地址: toStr(row.详细地址) || undefined,
          行业: toStr(row.行业) || undefined,
          线索来源: toStr(row.线索来源) || undefined,
          客户分层: toStr(row.客户分层) || undefined,
          销售人员邮箱: toStr(row.销售人员邮箱) || undefined,
          状态: status,
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

