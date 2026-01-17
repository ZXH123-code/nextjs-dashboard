import { Clock, Truck, AlertTriangle, TrendingUp } from "lucide-react";
import { lusitana } from "@/app/ui/fonts";
import { fetchCardData } from "@/app/lib/data";

const iconMap = {
  pending: Clock, // 待处理订单
  shipped: Truck, // 今日发货
  exception: AlertTriangle, // 异常/延期
  total: TrendingUp, // 本月累计
};

export default async function CardWrapper() {
  const { waiting_po_count, shipped_po_count, exception_po_count, total_po_count } = await fetchCardData();
  // const waiting_po_count = 1000;
  // const shipped_po_count = 2000;
  // const exception_po_count = 3000;
  // const total_po_count = 4000;
  return (
    <>
      <Card title="待处理订单" value={waiting_po_count} type="pending" />
      <Card title="今日发货" value={shipped_po_count} type="shipped" />
      <Card title="异常/延期" value={exception_po_count} type="exception" />
      <Card title="本月累计" value={total_po_count} type="total" />
    </>
  );
}

export function Card({ title, value, type }: { title: string; value: number | string; type: "pending" | "shipped" | "exception" | "total" }) {
  const Icon = iconMap[type];

  return (
    <div className="rounded-xl bg-gray-50 p-2 shadow-sm">
      <div className="flex p-4">
        {Icon ? <Icon className="h-5 w-5 text-gray-700" /> : null}
        <h3 className="ml-2 text-sm font-medium">{title}</h3>
      </div>
      <p
        className={`${lusitana.className}
          truncate rounded-xl bg-white px-4 py-8 text-center text-2xl`}
      >
        {value}
      </p>
    </div>
  );
}
