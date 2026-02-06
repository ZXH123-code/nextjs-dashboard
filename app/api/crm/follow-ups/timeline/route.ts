import { NextRequest, NextResponse } from "next/server";
import { getCrmAuth, getFollowUpTimeline } from "@/app/lib/crm";

/**
 * GET /api/crm/follow-ups/timeline
 * 获取跟进时间线（按创建时间倒序）
 * 查询参数：leadId, opportunityId, customerId（至少提供一个）
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getCrmAuth();
    if (!auth) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get("leadId") || undefined;
    const opportunityId = searchParams.get("opportunityId") || undefined;
    const customerId = searchParams.get("customerId") || undefined;

    if (!leadId && !opportunityId && !customerId) {
      return NextResponse.json(
        { error: "必须提供 leadId、opportunityId 或 customerId 之一" },
        { status: 400 }
      );
    }

    const followUps = await getFollowUpTimeline(auth, {
      leadId,
      opportunityId,
      customerId,
    });

    return NextResponse.json(followUps);
  } catch (error) {
    console.error("获取跟进时间线失败:", error);
    return NextResponse.json(
      { error: "获取跟进时间线失败" },
      { status: 500 }
    );
  }
}
