import { getUsers } from "@/app/lib/crm";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";
import { NewLeadForm } from "./NewLeadForm";

export default async function NewLeadPage() {
  let users: Awaited<ReturnType<typeof getUsers>> = [];
  try {
    users = await getUsers();
  } catch {
    // ignore
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/dashboard/crm/leads" className="text-muted-foreground hover:text-foreground">
          ← 返回
        </Link>
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>新建线索</h1>
      </div>

      <NewLeadForm users={users} />
    </main>
  );
}
