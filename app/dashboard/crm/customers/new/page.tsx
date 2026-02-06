import { getUsers } from "@/app/lib/crm";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";
import { NewCustomerForm } from "./NewCustomerForm";

export default async function NewCustomerPage() {
  let users: Awaited<ReturnType<typeof getUsers>> = [];
  try {
    users = await getUsers();
  } catch {
    // ignore
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4 flex items-center gap-4">
        <Link href="/dashboard/crm/customers" className="text-muted-foreground hover:text-foreground">
          ← 返回
        </Link>
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>新建客户</h1>
      </div>

      <NewCustomerForm users={users} />
    </main>
  );
}
