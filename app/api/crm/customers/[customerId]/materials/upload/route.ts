import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCrmAuth } from "@/app/lib/crm";
import { prisma } from "@/app/lib/prisma";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/**
 * POST /api/crm/customers/[customerId]/materials/upload
 * 上传客户资料到 Vercel Blob，并写入 DB 元数据
 * 权限：admin 或该客户的负责人
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await getCrmAuth();
    if (!auth) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { customerId } = await params;
    if (!customerId) {
      return NextResponse.json({ error: "缺少 customerId" }, { status: 400 });
    }

    const customer = await prisma.crm_customer.findUnique({
      where: { id: customerId },
      select: { id: true, salesPersonId: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "客户不存在" }, { status: 404 });
    }
    if (auth.role !== "admin" && customer.salesPersonId !== auth.userId) {
      return NextResponse.json({ error: "无权限为该客户上传资料" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "请选择要上传的文件" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "文件大小不能超过 10MB" },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "文件为空" }, { status: 400 });
    }

    // 不强制 MIME 白名单，仅提示；若有需要可取消下面注释
    // if (file.type && !ALLOWED_TYPES.has(file.type)) {
    //   return NextResponse.json({ error: "不支持该文件类型" }, { status: 400 });
    // }

    const pathname = `customers/${customerId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const material = await prisma.crm_customer_material.create({
      data: {
        customerId,
        blobUrl: blob.url,
        pathname: blob.pathname,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || null,
        uploadedById: auth.userId,
      },
      include: {
        uploadedBy: { select: { name: true } },
      },
    });

    return NextResponse.json({
      id: material.id,
      fileName: material.fileName,
      fileSize: material.fileSize,
      mimeType: material.contentType ?? undefined,
      blobUrl: material.blobUrl,
      uploadedAt: material.uploadedAt.toISOString(),
      uploadedByName: material.uploadedBy?.name ?? undefined,
    });
  } catch (error) {
    console.error("上传客户资料失败:", error);
    return NextResponse.json(
      { error: "上传失败，请稍后重试" },
      { status: 500 }
    );
  }
}
