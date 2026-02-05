import { createCustomerAction } from "@/app/lib/crm-actions";
import { getUsers, CUSTOMER_STATUS } from "@/app/lib/crm";
import Link from "next/link";
import { lusitana } from "@/app/ui/fonts";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/ui/form-select";

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

      <form action={createCustomerAction} className="max-w-xl space-y-4 rounded-lg border bg-card p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">客户名称 *</label>
          <input
            name="name"
            required
            className="w-full rounded-md border px-3 py-2"
            placeholder="请输入客户名称"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">昵称</label>
          <input name="nickname" className="w-full rounded-md border px-3 py-2" placeholder="选填" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">城市</label>
          <input name="city" className="w-full rounded-md border px-3 py-2" placeholder="选填" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">客户分层</label>
          <input name="customerTier" className="w-full rounded-md border px-3 py-2" placeholder="如：A/B/C" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">行业</label>
          <input name="industry" className="w-full rounded-md border px-3 py-2" placeholder="选填" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">人员规模</label>
          <input name="employeeCount" className="w-full rounded-md border px-3 py-2" placeholder="选填" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">企业标签</label>
          <input name="tags" className="w-full rounded-md border px-3 py-2" placeholder="选填，逗号分隔" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">主营产品</label>
          <input name="mainProducts" className="w-full rounded-md border px-3 py-2" placeholder="选填" />
        </div>
        <div className="space-y-2">
          <Label>销售人员</Label>
          <FormSelect
            name="salesPersonId"
            value=""
            options={[
              { value: "", label: "未指定" },
              ...users.map((u) => ({ value: u.id, label: u.name })),
            ]}
            placeholder="选择销售人员"
          />
        </div>
        <div className="space-y-2">
          <Label>状态</Label>
          <FormSelect
            name="status"
            value="已签约"
            options={CUSTOMER_STATUS.map((s) => ({ value: s, label: s }))}
            placeholder="选择状态"
          />
        </div>
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            保存
          </button>
          <Link
            href="/dashboard/crm/customers"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            取消
          </Link>
        </div>
      </form>
    </main>
  );
}
