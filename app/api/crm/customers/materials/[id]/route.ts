import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { canAccessCustomerAsSales, getCrmAuth } from "@/app/lib/crm";
import { prisma } from "@/app/lib/prisma";

/**
 * DELETE /api/crm/customers/materials/[id]
 * 删除客户资料：从 Vercel Blob 删除文件并从 DB 删除元数据
 * 权限：admin 或该客户的负责人
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getCrmAuth();
    if (!auth) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "缺少资料 id" }, { status: 400 });
    }

    const material = await prisma.crm_customer_material.findUnique({
      where: { id },
      include: {
        customer: {
          select: { departmentId: true, salesPersonId: true, assignees: { select: { userId: true } } },
        },
      },
    });
    if (!material) {
      return NextResponse.json({ error: "资料不存在" }, { status: 404 });
    }
    if (auth.departmentId && material.customer.departmentId !== auth.departmentId) {
      return NextResponse.json({ error: "无权限删除该资料" }, { status: 403 });
    }
    if (!canAccessCustomerAsSales(material.customer, auth.userId, auth.role)) {
      return NextResponse.json({ error: "无权限删除该资料" }, { status: 403 });
    }

    try {
      await del(material.blobUrl);
    } catch (e) {
      console.warn("Blob 删除失败（可能已不存在）:", e);
      // 继续删除 DB 记录，保持一致性
    }

    await prisma.crm_customer_material.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("删除客户资料失败:", error);
    return NextResponse.json(
      { error: "删除失败，请稍后重试" },
      { status: 500 }
    );
  }
}
