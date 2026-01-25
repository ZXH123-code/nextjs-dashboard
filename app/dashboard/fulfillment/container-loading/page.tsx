"use client";

import { useState } from "react";
import PackingForm from "@/app/ui/container-packing/PackingForm";
import ThreeViewer from "@/app/ui/container-packing/ThreeViewer";
import { PackingResponse } from "@/app/lib/container-packing-types";
import { Package, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export default function ContainerLoadingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PackingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSolve = async (payload: any) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/packing/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "求解失败");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "请求失败，请确认后端已启动");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="flex-none flex items-center gap-3 border-b bg-white px-4 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
          <Package className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900">3D 智能拼柜计算</h1>
          <p className="text-xs text-gray-500">基于 OR-Tools 的 3D 装箱优化算法</p>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 grid grid-cols-[420px_1fr] min-h-0">
        {/* 左侧表单区域 */}
        <div className="flex flex-col min-h-0 border-r bg-white p-4">
          <PackingForm onSolve={handleSolve} isLoading={isLoading} />
        </div>

        {/* 右侧 3D 视图 - 不滚动 */}
        <div className="relative min-h-0 bg-gradient-to-br from-slate-50 to-slate-100">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <p className="mt-3 text-xs text-gray-600">求解中，请稍候...</p>
              <p className="mt-1 text-xs text-gray-400">
                复杂问题可能需要数分钟
              </p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="mt-3 text-xs font-medium text-red-600">求解失败</p>
              <p className="mt-1 max-w-md text-center text-xs text-red-500">
                {error}
              </p>
            </div>
          )}

          {!isLoading && !error && !result && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
              <Package className="h-12 w-12 text-blue-300" />
              <p className="mt-3 text-xs text-gray-600">
                填写左侧表单，点击求解按钮开始计算
              </p>
            </div>
          )}

          {result && !isLoading && !error && (
            <>
              <ThreeViewer renderData={result.render} />

              {/* 结果统计面板 */}
              <div className="absolute right-3 top-3 rounded-lg bg-white/95 p-3 shadow-lg backdrop-blur">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-2">
                  {result.feasible ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-semibold text-green-700">
                        求解成功
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <span className="text-sm font-semibold text-red-700">
                        无可行解
                      </span>
                    </>
                  )}
                </div>

                {result.feasible && (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">装载率：</span>
                      <span className="font-semibold text-blue-600">
                        {(result.utilization.fill_ratio * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">已装载：</span>
                      <span className="font-medium">
                        {result.packed_items.length} 件
                      </span>
                    </div>
                    {result.unpacked_items.length > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>未装载：</span>
                        <span className="font-medium">
                          {result.unpacked_items.length} 件
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">求解器：</span>
                      <span className="text-xs">{result.solver_status}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
