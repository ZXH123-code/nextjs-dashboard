import { NextRequest, NextResponse } from "next/server";
import { getCrmAuth, getLeads } from "@/app/lib/crm";

/** GET /api/crm/leads - 分页获取线索，支持 ?page=1&pageSize=20 或 ?all=1 获取全部 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getCrmAuth();
    if (!auth) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "1";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.max(1, Math.min(400, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));

    const result = all
      ? await getLeads(auth)
      : await getLeads(auth, { page, pageSize });

    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/crm/leads:", e);
    return NextResponse.json(
      { error: "获取线索失败" },
      { status: 500 }
    );
  }
}
