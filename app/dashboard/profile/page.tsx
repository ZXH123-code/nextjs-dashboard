import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";
import { Shield } from "lucide-react";

export default async function ProfilePage() {
  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;

  let user: { name: string; email: string; role: string } | null = null;
  if (userId) {
    const u = await prisma.users.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    // 从数据库直接查 role，确保显示最新值（session 的 role 是登录时写入的，不会自动更新）
    const roleResult = await prisma.$queryRaw<{ role: string | null }[]>`
      SELECT role FROM users WHERE id::text = ${userId}
    `;
    const role = roleResult[0]?.role ?? "sales";
    if (u) user = { ...u, role };
  }

  if (!user) {
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

  const roleLabel = user.role === "admin" ? "销售总管" : "销售人员";

  return (
    <main className="p-6 md:p-8">
      <div className="mb-4">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
          ← 返回
        </Link>
      </div>
      <h1 className={`${lusitana.className} mb-6 text-xl md:text-2xl`}>个人信息</h1>

      <div className="max-w-md space-y-4 rounded-lg border bg-card p-6">
        <div>
          <label className="text-sm font-medium text-muted-foreground">姓名</label>
          <p className="mt-1 text-base">{user.name}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">邮箱</label>
          <p className="mt-1 text-base">{user.email}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">角色</label>
          <p className="mt-1 text-base">{roleLabel}</p>
        </div>
        {user.role === "admin" && (
          <div className="pt-4 border-t">
            <Link
              href="/dashboard/permissions"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Shield className="h-4 w-4" />
              管理用户权限
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
