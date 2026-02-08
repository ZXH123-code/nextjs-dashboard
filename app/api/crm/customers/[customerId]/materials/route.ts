import { NextRequest, NextResponse } from "next/server";
import { getCrmAuth } from "@/app/lib/crm";
import { prisma } from "@/app/lib/prisma";

/**
 * GET /api/crm/customers/[customerId]/materials
 * 获取该客户下的所有资料（Vercel Blob 元数据来自 DB）
 * 权限：admin 或该客户的负责人
 */
export async function GET(
  _request: NextRequest,
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
      return NextResponse.json({ error: "无权限查看该客户的资料" }, { status: 403 });
    }

    const materials = await prisma.crm_customer_material.findMany({
      where: { customerId },
      orderBy: { uploadedAt: "desc" },
      include: {
        uploadedBy: { select: { name: true } },
      },
    });

    const items = materials.map((m) => ({
      id: m.id,
      fileName: m.fileName,
      fileSize: m.fileSize,
      mimeType: m.contentType ?? undefined,
      blobUrl: m.blobUrl,
      uploadedAt: m.uploadedAt.toISOString(),
      uploadedByName: m.uploadedBy?.name ?? undefined,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error("获取客户资料列表失败:", error);
    return NextResponse.json(
      { error: "获取客户资料列表失败" },
      { status: 500 }
    );
  }
}
