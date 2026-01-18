import SideNav from "@/app/ui/dashboard/sidenav";
import TopBar from "@/app/ui/dashboard/topbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
      {/* 侧边栏容器 - 允许内容溢出以显示折叠按钮 */}
      <div className="w-full flex-none md:w-auto overflow-visible z-50">
        <SideNav />
      </div>

      {/* 主内容区 */}
      <div className="flex flex-col flex-1 md:overflow-hidden">
        {/* 顶部栏 */}
        <TopBar />

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto bg-muted/30">
          <div className="container mx-auto p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
