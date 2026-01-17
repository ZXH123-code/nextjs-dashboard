import AcmeLogo from "@/app/ui/acme-logo";
import { ArrowRightIcon, CubeIcon, ChartBarIcon, CpuChipIcon, CloudIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex h-20 shrink-0 items-end rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 p-4 md:h-52">
        <AcmeLogo />
      </div>
      <div className="mt-4 flex grow flex-col gap-4 md:flex-row">
        <div className="flex flex-col justify-center gap-6 rounded-lg bg-gray-50 px-6 py-10 md:w-2/5 md:px-20">
          <h1 className={`${lusitana.className} text-3xl font-bold text-gray-900 md:text-5xl md:leading-tight`}>数智化供应链</h1>
          <p className="text-lg text-gray-600 md:text-xl">数字化、智能化、高效化的供应链管理平台</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3">
              <CubeIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-800">智能仓储管理</p>
                <p className="text-sm text-gray-600">实时库存追踪，优化仓储效率</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ChartBarIcon className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-800">数据驱动决策</p>
                <p className="text-sm text-gray-600">可视化分析，精准预测需求</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CpuChipIcon className="h-6 w-6 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-800">AI智能优化</p>
                <p className="text-sm text-gray-600">机器学习算法，自动优化流程</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CloudIcon className="h-6 w-6 text-cyan-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-800">云端协同</p>
                <p className="text-sm text-gray-600">多端同步，随时随地管理</p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-medium text-white transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg md:text-base"
            >
              <span>立即登录</span> <ArrowRightIcon className="w-5 md:w-6" />
            </Link>
            <Link
              href="/register"
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-blue-600 bg-white px-6 py-3 text-sm font-medium text-blue-600 transition-all hover:bg-blue-50 hover:shadow-lg md:text-base"
            >
              <span>免费注册</span>
            </Link>
          </div>
        </div>
        <div className="flex items-center justify-center p-6 md:w-3/5 md:px-28 md:py-12">
          <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
            <div className="rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 p-6 shadow-md">
              <CubeIcon className="h-12 w-12 text-blue-600 mb-3" />
              <h3 className="font-semibold text-gray-800 mb-2">仓储管理</h3>
              <p className="text-sm text-gray-600">智能调度</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 p-6 shadow-md">
              <ChartBarIcon className="h-12 w-12 text-indigo-600 mb-3" />
              <h3 className="font-semibold text-gray-800 mb-2">数据分析</h3>
              <p className="text-sm text-gray-600">实时监控</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 p-6 shadow-md">
              <CpuChipIcon className="h-12 w-12 text-purple-600 mb-3" />
              <h3 className="font-semibold text-gray-800 mb-2">AI优化</h3>
              <p className="text-sm text-gray-600">智能预测</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-200 p-6 shadow-md">
              <CloudIcon className="h-12 w-12 text-cyan-600 mb-3" />
              <h3 className="font-semibold text-gray-800 mb-2">云端协同</h3>
              <p className="text-sm text-gray-600">无缝连接</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
