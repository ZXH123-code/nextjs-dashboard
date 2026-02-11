import { NextRequest, NextResponse } from "next/server";
import { getCrmAuth, getFollowUpByIdIfVisible, getFollowUpImages } from "@/app/lib/crm";

/**
 * GET /api/crm/follow-ups/[followUpId]/images
 * 按需获取该条跟进的图片列表，仅在有权限查看该跟进时返回
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ followUpId: string }> }
) {
  try {
    const auth = await getCrmAuth();
    if (!auth) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { followUpId } = await params;
    if (!followUpId) {
      return NextResponse.json({ error: "缺少 followUpId" }, { status: 400 });
    }

    const followUp = await getFollowUpByIdIfVisible(auth, followUpId);
    if (!followUp) {
      return NextResponse.json({ error: "跟进不存在或无权限查看" }, { status: 404 });
    }

    const images = await getFollowUpImages(followUpId);

    return NextResponse.json({
      images: images.map((img) => ({
        id: img.id,
        blobUrl: img.blobUrl,
        fileName: img.fileName,
        uploadedAt: img.uploadedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("获取跟进图片失败:", error);
    return NextResponse.json(
      { error: "获取失败，请稍后重试" },
      { status: 500 }
    );
  }
}
