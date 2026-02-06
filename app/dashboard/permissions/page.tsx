import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";
import { RoleSelectForm } from "./RoleSelectForm";
import { RecycleBinSection } from "./RecycleBinSection";
import { getCrmAuth, getDeletedLeads } from "@/app/lib/crm";
import { Shield, ArrowLeft } from "lucide-react";

export default async function PermissionsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role ?? "sales";

  if (!userId) {
    return (
      <main className="p-6 md:p-8">
        <div className="mb-4">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            ← 返回
          </Link>
        </div>
        <p className="text-muted-foreground">请先登录</p>
      </main>
    );
  }

  if (role !== "admin") {
    return (
      <main className="p-6 md:p-8">
        <div className="mb-4">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> 返回
          </Link>
        </div>
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-6 text-amber-700 dark:text-amber-400">
          <p className="font-medium">无权限访问</p>
          <p className="mt-1 text-sm text-muted-foreground">
            仅销售总管可管理用户角色。如需调整权限，请联系管理员。
          </p>
        </div>
      </main>
    );
  }

  const users = await prisma.$queryRaw<
    { id: string; name: string; email: string; role: string | null }[]
  >`
    SELECT id, name, email, role FROM users ORDER BY name ASC
  `;

  // 获取已删除的线索
  const crmAuth = await getCrmAuth();
  const deletedLeads = await getDeletedLeads(crmAuth);

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> 返回
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className={`${lusitana.className} text-xl md:text-2xl`}>权限管理</h1>
          <p className="text-sm text-muted-foreground">
            调整用户角色后立即生效，无需重新登录
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-6 py-4 text-left font-medium">姓名</th>
              <th className="px-6 py-4 text-left font-medium">邮箱</th>
              <th className="px-6 py-4 text-left font-medium">当前角色</th>
              <th className="px-6 py-4 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-6 py-4">{user.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${user.role === "admin"
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                      }`}
                  >
                    {user.role === "admin" ? "销售总管" : "销售人员"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <RoleSelectForm
                    userId={user.id}
                    currentRole={(user.role as "admin" | "sales") ?? "sales"}
                    isSelf={user.id === userId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 mb-6 rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">角色说明</p>
        <ul className="space-y-1">
          <li>• <strong>销售总管</strong>：可查看所有线索、商机、客户、跟进记录</li>
          <li>• <strong>销售人员</strong>：仅可查看自己负责的记录</li>
        </ul>
      </div>

      <RecycleBinSection deletedLeads={deletedLeads} />
    </main>
  );
}
