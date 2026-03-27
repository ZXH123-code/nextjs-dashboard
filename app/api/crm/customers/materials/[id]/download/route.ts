import { NextRequest, NextResponse } from "next/server";
import { canAccessCustomerAsSales, getCrmAuth } from "@/app/lib/crm";
import { prisma } from "@/app/lib/prisma";

/** 图片/PDF 统一水印文案（英文，PDF 标准字体仅支持 WinAnsi） */
const WATERMARK_TEXT = "SILEA GROUP Use Only";
/** 弹幕式水印：倾斜角度（度） */
const WATERMARK_ROTATE_DEG = -25;
/** 弹幕式水印：透明度，0~1 */
const WATERMARK_OPACITY = 0.20;

// ---------- 字号 ----------
/** PDF 水印字号（点），改小 = 字更小 */
const WATERMARK_FONT_SIZE_PDF = 12;
/** 图片水印：字号 = 图片短边 / 此值，此值越大字越小（建议 18~30） */
const WATERMARK_IMAGE_SIZE_DIVISOR = 22;

// ---------- 弹幕密度 ----------
/** PDF：同行水平间距（点），越小越密 */
const WATERMARK_STEP_X = 160;
/** PDF：行间距（点），越小越密 */
const WATERMARK_STEP_Y = 100;
/** 图片：同行水平间距（像素），越小越密 */
const WATERMARK_IMAGE_STEP_X = 120;
/** 图片：行间距（像素），越小越密 */
const WATERMARK_IMAGE_STEP_Y = 90;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * GET /api/crm/customers/materials/[id]/download?watermark=1
 * 带水印下载：仅支持图片与 PDF，其他类型返回原文件流
 * 权限：admin 或该客户的负责人
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getCrmAuth();
    if (!auth) {
      return new NextResponse("未授权", { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return new NextResponse("缺少资料 id", { status: 400 });
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
      return new NextResponse("资料不存在", { status: 404 });
    }
    if (auth.departmentId && material.customer.departmentId !== auth.departmentId) {
      return new NextResponse("无权限下载该资料", { status: 403 });
    }
    if (!canAccessCustomerAsSales(material.customer, auth.userId, auth.role)) {
      return new NextResponse("无权限下载该资料", { status: 403 });
    }

    const wantWatermark =
      request.nextUrl.searchParams.get("watermark") === "1" || request.nextUrl.searchParams.get("watermark") === "true";
    const res = await fetch(material.blobUrl, { cache: "no-store" });
    if (!res.ok) {
      return new NextResponse("无法获取文件", { status: 502 });
    }
    const contentType = material.contentType || res.headers.get("content-type") || "application/octet-stream";
    const filename = material.fileName;

    if (!wantWatermark) {
      const ab = await res.arrayBuffer();
      return new NextResponse(ab, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }

    const buf = Buffer.from(await res.arrayBuffer());
    let body: Buffer = buf;
    let finalContentType = contentType;

    if (contentType.startsWith("image/")) {
      try {
        const sharp = await import("sharp");
        const meta = await sharp.default(buf).metadata();
        const w = meta.width || 800;
        const h = meta.height || 600;
        const fontSize = Math.max(12, Math.min(40, Math.floor(Math.min(w, h) / WATERMARK_IMAGE_SIZE_DIVISOR)));
        const stepX = WATERMARK_IMAGE_STEP_X;
        const stepY = WATERMARK_IMAGE_STEP_Y;
        const textEls: string[] = [];
        let rowIndex = 0;
        for (let y = -h * 0.2; y < h * 1.2; y += stepY, rowIndex++) {
          const offsetX = rowIndex % 2 === 0 ? 0 : stepX / 2;
          for (let x = -w * 0.1; x < w * 1.2; x += stepX) {
            const cx = x + offsetX;
            const cy = y;
            textEls.push(
              `<text x="${cx}" y="${cy}" text-anchor="middle" dy="0.35em" transform="rotate(${WATERMARK_ROTATE_DEG}, ${cx}, ${cy})" fill="rgba(128,128,128,${WATERMARK_OPACITY})" font-size="${fontSize}" font-family="sans-serif">${escapeXml(WATERMARK_TEXT)}</text>`
            );
          }
        }
        const svg = Buffer.from(
          `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${textEls.join("")}</svg>`
        );
        body = await sharp
          .default(buf)
          .composite([{ input: svg, left: 0, top: 0 }])
          .toBuffer();
        finalContentType = contentType;
      } catch (e) {
        console.warn("图片水印失败，返回原图:", e);
      }
    } else if (contentType.includes("pdf")) {
      try {
        const { PDFDocument, rgb, degrees, StandardFonts } = await import("pdf-lib");
        const doc = await PDFDocument.load(buf);
        const font = await doc.embedStandardFont(StandardFonts.Helvetica);
        const pages = doc.getPages();
        const fontSize = WATERMARK_FONT_SIZE_PDF;
        for (const page of pages) {
          const { width, height } = page.getSize();
          let rowIndex = 0;
          for (let y = -height * 0.2; y < height * 1.2; y += WATERMARK_STEP_Y, rowIndex++) {
            const offsetX = rowIndex % 2 === 0 ? 0 : WATERMARK_STEP_X / 2;
            for (let x = -width * 0.1; x < width * 1.2; x += WATERMARK_STEP_X) {
              page.drawText(WATERMARK_TEXT, {
                x: x + offsetX,
                y,
                size: fontSize,
                font,
                color: rgb(0.5, 0.5, 0.5),
                opacity: WATERMARK_OPACITY,
                rotate: degrees(WATERMARK_ROTATE_DEG),
              });
            }
          }
        }
        body = Buffer.from(await doc.save());
        finalContentType = "application/pdf";
      } catch (e) {
        console.warn("PDF 水印失败，返回原文件:", e);
      }
    }

    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": finalContentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("带水印下载失败:", error);
    return new NextResponse("下载失败", { status: 500 });
  }
}
