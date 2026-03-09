"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  LabelList,
} from "recharts";
import { lusitana } from "@/app/ui/fonts";

/** 与整体风格一致的图表配色（灰蓝系，贴合侧边栏） */
const CHART_COLORS = [
  "hsl(210, 70%, 45%)", // 主蓝
  "hsl(195, 70%, 40%)", // 青蓝
  "hsl(220, 25%, 50%)", // 灰蓝
  "hsl(200, 30%, 55%)", // 浅灰蓝
  "hsl(215, 20%, 60%)", // 更浅
];

/** 漏斗看板数据项 */
export type FunnelDataItem = {
  label: string;
  value: number;
  unit: string;
};

/** 图表卡片容器 - 与现有 Card 风格一致 */
function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-gray-50 p-2 shadow-sm ${className}`}
    >
      <div className="flex p-4 pb-2">
        <h3 className={`${lusitana.className} text-sm font-medium text-gray-700`}>
          {title}
        </h3>
      </div>
      <div className="px-2 pb-4">{children}</div>
    </div>
  );
}

/** 阶梯式条形图 - 直观展示漏斗逻辑，支持自定义标题 */
export function FunnelChart({
  title,
  data,
}: {
  title: string;
  data: FunnelDataItem[];
}) {
  const chartData = data.map((item, i) => ({
    name: item.label,
    value: Math.max(item.value, 0),
    unit: item.unit,
    label: `${item.value}${item.unit}`,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));
  if (!chartData.length || chartData.every((d) => d.value === 0)) {
    return (
      <ChartCard title={title}>
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-500">
          暂无数据
        </div>
      </ChartCard>
    );
  }
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#6b7280" }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={60}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(214, 32%, 91%)",
              fontSize: 12,
            }}
            formatter={(value, _name, props) => [
              `${value ?? 0}${(props.payload as { unit?: string })?.unit ?? ""}`,
              "数量",
            ]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} name="数量">
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="label"
              position="right"
              style={{ fontSize: 12, fill: "#6b7280" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 线索状态分布 - 柱状图 */
export function LeadStatusChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (!data?.length) {
    return (
      <ChartCard title="线索状态分布">
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-500">
          暂无数据
        </div>
      </ChartCard>
    );
  }
  return (
    <ChartCard title="线索状态分布">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(214, 32%, 91%)",
              fontSize: 12,
            }}
            formatter={(value) => [value ?? 0, "数量"]}
          />
          <Bar
            dataKey="value"
            fill={CHART_COLORS[0]}
            radius={[4, 4, 0, 0]}
            name="数量"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 商机状态分布 - 柱状图 */
export function OpportunityStatusChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (!data?.length) {
    return (
      <ChartCard title="商机状态分布">
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-500">
          暂无数据
        </div>
      </ChartCard>
    );
  }
  return (
    <ChartCard title="商机状态分布">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(214, 32%, 91%)",
              fontSize: 12,
            }}
            formatter={(value) => [value ?? 0, "数量"]}
          />
          <Bar
            dataKey="value"
            fill={CHART_COLORS[1]}
            radius={[4, 4, 0, 0]}
            name="数量"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 线索来源分布 - 饼图 */
export function LeadSourceChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (!data?.length) {
    return (
      <ChartCard title="线索来源分布">
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-500">
          暂无来源数据
        </div>
      </ChartCard>
    );
  }
  return (
    <ChartCard title="线索来源分布">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(214, 32%, 91%)",
              fontSize: 12,
            }}
            formatter={(value) => [value ?? 0, "数量"]}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** 近 7 天新增趋势 - 折线图 */
export function DailyTrendChart({
  data,
}: {
  data: { date: string; leads: number; opportunities: number; customers: number }[];
}) {
  if (!data?.length) {
    return (
      <ChartCard title="近 7 天新增趋势">
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-500">
          暂无数据
        </div>
      </ChartCard>
    );
  }
  return (
    <ChartCard title="近 7 天新增趋势">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(214, 32%, 91%)",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              value ?? 0,
              name === "leads"
                ? "线索"
                : name === "opportunities"
                  ? "商机"
                  : "客户",
            ]}
          />
          <Legend
            formatter={(value) =>
              value === "leads"
                ? "线索"
                : value === "opportunities"
                  ? "商机"
                  : "客户"
            }
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="leads"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS[0], r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="opportunities"
            stroke={CHART_COLORS[1]}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS[1], r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="customers"
            stroke={CHART_COLORS[2]}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS[2], r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
