import { ArrowPathIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { lusitana } from "@/app/ui/fonts";
import { LatestInvoice } from "@/app/lib/definitions";
import { fetchLatestInvoices } from "@/app/lib/data-prisma";
import { Building2, Store, Factory, Warehouse, Users, LucideIcon } from "lucide-react";

// 图标映射
const iconMap: { [key: string]: LucideIcon } = {
  Building2,
  Store,
  Factory,
  Warehouse,
  Users,
};

export default async function LatestInvoices() {
  const latestInvoices = await fetchLatestInvoices();
  return (
    <div className="flex w-full flex-col md:col-span-4">
      <h2 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>Latest Invoices</h2>
      <div className="flex grow flex-col justify-between rounded-xl bg-gray-50 p-4">
        {/* NOTE: Uncomment this code in Chapter 7 */}

        <div className="bg-white px-6">
          {latestInvoices.map((invoice, i) => {
            const IconComponent = invoice.iconType ? iconMap[invoice.iconType] : Building2;
            return (
              <div
                key={invoice.id}
                className={clsx("flex flex-row items-center justify-between py-4", {
                  "border-t": i !== 0,
                })}
              >
                <div className="flex items-center">
                  <div className="mr-4 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                    <IconComponent className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold md:text-base">{invoice.name}</p>
                    <p className="hidden text-sm text-gray-500 sm:block">{invoice.email}</p>
                  </div>
                </div>
                <p className={`${lusitana.className} truncate text-sm font-medium md:text-base`}>{invoice.amount}</p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center pb-2 pt-6">
          <ArrowPathIcon className="h-5 w-5 text-gray-500" />
          <h3 className="ml-2 text-sm text-gray-500 ">Updated just now</h3>
        </div>
      </div>
    </div>
  );
}
