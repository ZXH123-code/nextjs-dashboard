import { NextRequest, NextResponse } from "next/server";
import { sendVerificationCodeAction } from "@/app/lib/auth-actions";

/** POST /api/auth/send-verification-code - 发送注册验证码 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (!email) {
      return NextResponse.json({ error: "请提供邮箱地址" }, { status: 400 });
    }

    const result = await sendVerificationCodeAction(email);
    if (result.success) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  } catch (e) {
    console.error("POST /api/auth/send-verification-code:", e);
    return NextResponse.json({ error: "发送失败，请稍后重试" }, { status: 500 });
  }
}
