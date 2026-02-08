import { auth } from "@/auth";
import { getCrmAuth, getDeletedLeads } from "@/app/lib/crm";
import { RecycleBinSection } from "../components/RecycleBinSection";
import { lusitana } from "@/app/ui/fonts";
import Link from "next/link";
import { Trash2, ArrowLeft } from "lucide-react";

export default async function RecycleBinPage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "sales";

  if (role !== "admin") {
    return (
      <main className="p-6 md:p-8">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> 返回
          </Link>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-amber-700 dark:text-amber-400">
          <p className="font-medium">无权限访问</p>
          <p className="mt-1 text-sm text-muted-foreground">
            仅销售总管可查看回收站。如需恢复已删除线索，请联系管理员。
          </p>
        </div>
      </main>
    );
  }

  const crmAuth = await getCrmAuth();
  const deletedLeads = await getDeletedLeads(crmAuth);

  return (
    <main className="p-6 md:p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/crm/leads"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 返回
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Trash2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className={`${lusitana.className} text-xl md:text-2xl`}>回收站</h1>
            <p className="text-sm text-muted-foreground">
              已删除的线索可在此恢复或彻底删除
            </p>
          </div>
        </div>
      </div>

      <RecycleBinSection deletedLeads={deletedLeads} />
    </main>
  );
}
