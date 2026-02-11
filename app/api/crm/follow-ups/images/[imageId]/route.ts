import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getCrmAuth } from "@/app/lib/crm";
import { prisma } from "@/app/lib/prisma";

/**
 * DELETE /api/crm/follow-ups/images/[imageId]
 * 删除单张跟进图片，仅跟进人或 admin 可删
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const auth = await getCrmAuth();
    if (!auth) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { imageId } = await params;
    if (!imageId) {
      return NextResponse.json({ error: "缺少图片 id" }, { status: 400 });
    }

    const image = await prisma.crm_follow_up_image.findUnique({
      where: { id: imageId },
      include: {
        followUp: { select: { followUpById: true } },
      },
    });
    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const canDelete =
      auth.role === "admin" ||
      image.followUp.followUpById === auth.userId;
    if (!canDelete) {
      return NextResponse.json({ error: "仅跟进人或管理员可删除该图片" }, { status: 403 });
    }

    try {
      await del(image.blobUrl);
    } catch (e) {
      console.warn("Blob 删除失败（可能已不存在）:", e);
    }

    await prisma.crm_follow_up_image.delete({
      where: { id: imageId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("删除跟进图片失败:", error);
    return NextResponse.json(
      { error: "删除失败，请稍后重试" },
      { status: 500 }
    );
  }
}
