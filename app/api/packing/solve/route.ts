import { NextRequest, NextResponse } from "next/server";

// FastAPI 后端地址（可以通过环境变量配置）
const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 转发请求到 FastAPI 后端
        const response = await fetch(`${FASTAPI_URL}/packing/solve`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: "FastAPI 求解失败", details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("装箱求解错误:", error);
        return NextResponse.json(
            {
                error: "无法连接到装箱服务",
                details: error.message,
                hint: "请确保 FastAPI 服务已启动（默认端口 8000）",
            },
            { status: 500 }
        );
    }
}

// 健康检查
export async function GET() {
    try {
        const response = await fetch(`${FASTAPI_URL}/health`);
        const data = await response.json();
        return NextResponse.json({
            status: "ok",
            fastapi: data,
            url: FASTAPI_URL,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                status: "error",
                message: "FastAPI 服务不可用",
                url: FASTAPI_URL,
                error: error.message,
            },
            { status: 503 }
        );
    }
}
