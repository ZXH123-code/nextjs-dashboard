import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCrmAuth, getFollowUpByIdIfVisible } from "@/app/lib/crm";
import { prisma } from "@/app/lib/prisma";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/**
 * POST /api/crm/follow-ups/[followUpId]/images/upload
 * 上传跟进图片到 Vercel Blob，仅跟进人或 admin 可上传
 */
export async function POST(
  request: NextRequest,
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
    const canUpload = auth.role === "admin" || followUp.followUpById === auth.userId;
    if (!canUpload) {
      return NextResponse.json({ error: "仅跟进人或管理员可上传图片" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "请选择要上传的图片" }, { status: 400 });
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

    if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "仅支持 JPEG、PNG、GIF、WebP 图片" },
        { status: 400 }
      );
    }

    const pathname = `follow-ups/${followUpId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const image = await prisma.crm_follow_up_image.create({
      data: {
        followUpId,
        blobUrl: blob.url,
        pathname: blob.pathname,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || null,
      },
    });

    return NextResponse.json({
      id: image.id,
      blobUrl: image.blobUrl,
      fileName: image.fileName,
      uploadedAt: image.uploadedAt.toISOString(),
    });
  } catch (error) {
    console.error("上传跟进图片失败:", error);
    return NextResponse.json(
      { error: "上传失败，请稍后重试" },
      { status: 500 }
    );
  }
}
