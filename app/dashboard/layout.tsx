import SideNav from "@/app/ui/dashboard/sidenav";
import TopBar from "@/app/ui/dashboard/topbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
      <div className="w-full flex-none md:w-64">
        <SideNav />
      </div>
      <div className="grow p-6 md:overflow-y-auto md:p-12">
        <TopBar />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
