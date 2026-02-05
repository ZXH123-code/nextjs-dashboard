import SideNav from "@/app/ui/dashboard/sidenav";
import TopBar from "@/app/ui/dashboard/topbar";
import { auth } from "@/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";

  return (
    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
      {/* 侧边栏容器 - 允许内容溢出以显示折叠按钮 */}
      <div className="w-full flex-none md:w-auto overflow-visible z-50">
        <SideNav role={role} />
      </div>

      {/* 主内容区 */}
      <div className="flex flex-col flex-1 md:overflow-hidden">
        {/* 顶部栏 */}
        <TopBar />

        {/* 页面内容 - overflow-y-auto 支持长表单滚动 */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
