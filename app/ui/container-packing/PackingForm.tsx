"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { FormItemRow } from "@/app/lib/container-packing-types";

interface PackingFormProps {
  onSolve: (payload: any) => void;
  isLoading: boolean;
}

const defaultItems: FormItemRow[] = [
  { name: "瓷砖箱", length: "800", width: "800", height: "400", quantity: "20", color: "#dc2626" },
  { name: "浴室柜", length: "1000", width: "600", height: "800", quantity: "8", color: "#38bdf8" },
  { name: "门板", length: "2000", width: "900", height: "50", quantity: "6", color: "#f97316" },
  { name: "五金盒", length: "300", width: "200", height: "150", quantity: "15", color: "#10b981" },
  { name: "水管", length: "3000", width: "150", height: "150", quantity: "10", color: "#8b5cf6" },
];

export default function PackingForm({ onSolve, isLoading }: PackingFormProps) {
  const [containerLength, setContainerLength] = useState("12000");
  const [containerWidth, setContainerWidth] = useState("2350");
  const [containerHeight, setContainerHeight] = useState("2600");
  const [containerWeight, setContainerWeight] = useState("12000");
  const [containerUnit, setContainerUnit] = useState("mm");
  const [solverType, setSolverType] = useState("ortools");
  const [timeLimit, setTimeLimit] = useState("300");

  const [items, setItems] = useState<FormItemRow[]>(defaultItems);

  const addItem = () => {
    setItems([...items, { name: "", length: "", width: "", height: "", quantity: "", color: "#38bdf8" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof FormItemRow, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSolve = () => {
    const validItems = items
      .filter((item) => item.name && item.length && item.width && item.height && item.quantity)
      .map((item, index) => ({
        id: `item-${index + 1}`,
        name: item.name,
        length: Number(item.length),
        width: Number(item.width),
        height: Number(item.height),
        quantity: Number(item.quantity),
        color: item.color || "#38bdf8",
      }));

    if (validItems.length === 0) {
      alert("请至少填写一条完整物品信息");
      return;
    }

    const payload = {
      container: {
        length: Number(containerLength),
        width: Number(containerWidth),
        height: Number(containerHeight),
        max_weight: containerWeight ? Number(containerWeight) : undefined,
        unit: containerUnit,
      },
      items: validItems,
      options: {
        solver: solverType,
        allow_rotation: true,
        time_limit_sec: Number(timeLimit),
        maximize_compactness: false,
        maximize_volume: true,
        require_support: true,
        prefer_low_center_of_gravity: true,
        flat_sheet_vertical: true,
        large_items_first: true,
        greedy_weight_coefficient: 0.7,
        cluster_weight: 1.5,
        large_item_threshold_ratio: 0.3,
        max_cg_height_ratio: 0.45,
        min_support_ratio: 0.80,
        enable_center_of_mass: true,
        center_of_mass_tolerance_per_mille: 300,
        heavy_bottom: true,
        density_ratio_threshold: 1.5,
        flat_sheet_lean: true,
        long_rod_corner: true,
        flat_sheet_long_edge_down: true,
        stagger_joints: true,
        min_stagger_ratio: 0.2,
        long_rod_anti_pierce: true,
      },
    };

    onSolve(payload);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 车厢尺寸 - 固定区域 */}
      <div className="flex-none space-y-2">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <div className="h-4 w-0.5 bg-blue-600"></div>
          车厢尺寸
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <Input
            id="c-length"
            value={containerLength}
            onChange={(e) => setContainerLength(e.target.value)}
            placeholder="长度"
            type="number"
          />
          <Input
            id="c-width"
            value={containerWidth}
            onChange={(e) => setContainerWidth(e.target.value)}
            placeholder="宽度"
            type="number"
          />
          <Input
            id="c-height"
            value={containerHeight}
            onChange={(e) => setContainerHeight(e.target.value)}
            placeholder="高度"
            type="number"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            id="c-weight"
            value={containerWeight}
            onChange={(e) => setContainerWeight(e.target.value)}
            placeholder="最大载重 (kg)"
            type="number"
          />
          <select
            id="c-unit"
            value={containerUnit}
            onChange={(e) => setContainerUnit(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="m">m</option>
          </select>
        </div>
      </div>

      {/* 求解设置 - 固定区域 */}
      <div className="flex-none space-y-2 border-t pt-3">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <div className="h-4 w-0.5 bg-purple-600"></div>
          求解设置
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <select
            id="solver"
            value={solverType}
            onChange={(e) => setSolverType(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ortools">🎯 OR-Tools</option>
            <option value="py3dbp">⚡ py3dbp</option>
          </select>
          <Input
            id="time-limit"
            type="number"
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            placeholder="求解时间 (秒)"
            min="10"
            max="3600"
          />
        </div>
      </div>

      {/* 物品清单 - 可滚动区域 */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 border-t pt-3">
        <div className="flex-none flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <div className="h-4 w-0.5 bg-green-600"></div>
            物品清单
            <span className="text-xs font-normal text-gray-500 normal-case">({items.length})</span>
          </h3>
          <Button size="sm" variant="outline" onClick={addItem} type="button" className="h-7 text-xs">
            <Plus className="mr-1 h-3 w-3" />
            添加
          </Button>
        </div>

        {/* 物品列表 - 独立滚动 */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
          {items.map((item, index) => (
            <div key={index} className="group rounded-md border-l-2 bg-gray-50 p-2 hover:bg-gray-100 transition-all" style={{ borderLeftColor: item.color || "#38bdf8" }}>
              {/* 第一行：名称 + 颜色 + 删除 */}
              <div className="flex items-center gap-2 mb-1.5">
                <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <Input
                  value={item.name}
                  onChange={(e) => updateItem(index, "name", e.target.value)}
                  placeholder="物品名称"
                  className="flex-1"
                />
                <Input
                  type="color"
                  value={item.color}
                  onChange={(e) => updateItem(index, "color", e.target.value)}
                  className="h-9 w-10 cursor-pointer p-0.5"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeItem(index)}
                  type="button"
                  className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {/* 第二行：尺寸 */}
              <div className="grid grid-cols-4 gap-1.5 pl-5">
                <Input
                  value={item.length}
                  onChange={(e) => updateItem(index, "length", e.target.value)}
                  placeholder="长"
                  type="number"
                />
                <Input
                  value={item.width}
                  onChange={(e) => updateItem(index, "width", e.target.value)}
                  placeholder="宽"
                  type="number"
                />
                <Input
                  value={item.height}
                  onChange={(e) => updateItem(index, "height", e.target.value)}
                  placeholder="高"
                  type="number"
                />
                <Input
                  value={item.quantity}
                  onChange={(e) => updateItem(index, "quantity", e.target.value)}
                  placeholder="数量"
                  type="number"
                  min="1"
                />
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-center py-6 text-xs text-gray-500 border-2 border-dashed rounded-lg">
              暂无物品，点击上方按钮添加
            </div>
          )}
        </div>
      </div>

      {/* 求解按钮 - 固定底部 */}
      <Button
        onClick={handleSolve}
        disabled={isLoading}
        className="flex-none w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
      >
        {isLoading ? "⏳ 求解中..." : "🚀 开始求解"}
      </Button>
    </div>
  );
}
