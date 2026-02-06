"use client";

import { useState, useMemo, useCallback } from "react";
import type { FilterCondition, FilterField } from "@/components/ui/filter-dialog";

export function useFilter<T extends Record<string, any>>(
  data: T[],
  fields: FilterField[]
) {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);

  const applyFilter = useCallback((newConditions: FilterCondition[]) => {
    setConditions(newConditions);
  }, []);

  const clearFilter = useCallback(() => {
    setConditions([]);
  }, []);

  const filteredData = useMemo(() => {
    if (conditions.length === 0) return data;

    return data.filter((item) => {
      return conditions.every((condition) => {
        const field = fields.find((f) => f.key === condition.field);
        if (!field) return true;

        let value = item[condition.field];
        // 处理关联字段（如 salesPerson.name）
        if (condition.field.includes(".")) {
          const parts = condition.field.split(".");
          value = parts.reduce((obj, key) => obj?.[key], item);
        }
        // 处理日期字段：统一转换为 YYYY-MM-DD 格式的字符串进行比较
        let valueStr = "";
        if (field?.type === "date") {
          if (value instanceof Date) {
            valueStr = value.toISOString().split("T")[0];
          } else if (value) {
            valueStr = new Date(value).toISOString().split("T")[0];
          }
        } else {
          valueStr = String(value ?? "");
        }
        const conditionValue = String(condition.value ?? "");

        switch (condition.operator) {
          case "equals":
            if (field?.type === "date") {
              return valueStr === conditionValue;
            }
            return valueStr === conditionValue;
          case "notEquals":
            if (field?.type === "date") {
              return valueStr !== conditionValue;
            }
            return valueStr !== conditionValue;
          case "contains":
            return valueStr.toLowerCase().includes(conditionValue.toLowerCase());
          case "notContains":
            return !valueStr.toLowerCase().includes(conditionValue.toLowerCase());
          case "startsWith":
            return valueStr.toLowerCase().startsWith(conditionValue.toLowerCase());
          case "endsWith":
            return valueStr.toLowerCase().endsWith(conditionValue.toLowerCase());
          case "greaterThan":
            if (field?.type === "date") {
              return valueStr > conditionValue;
            }
            return Number(value) > Number(conditionValue);
          case "greaterThanOrEqual":
            if (field?.type === "date") {
              return valueStr >= conditionValue;
            }
            return Number(value) >= Number(conditionValue);
          case "lessThan":
            if (field?.type === "date") {
              return valueStr < conditionValue;
            }
            return Number(value) < Number(conditionValue);
          case "lessThanOrEqual":
            if (field?.type === "date") {
              return valueStr <= conditionValue;
            }
            return Number(value) <= Number(conditionValue);
          case "isEmpty":
            return value == null || value === "" || (Array.isArray(value) && value.length === 0);
          case "isNotEmpty":
            return value != null && value !== "" && !(Array.isArray(value) && value.length === 0);
          case "in":
            if (Array.isArray(conditionValue)) {
              return conditionValue.includes(valueStr);
            }
            return valueStr === conditionValue;
          case "notIn":
            if (Array.isArray(conditionValue)) {
              return !conditionValue.includes(valueStr);
            }
            return valueStr !== conditionValue;
          default:
            return true;
        }
      });
    });
  }, [data, conditions, fields]);

  return {
    filteredData,
    conditions,
    applyFilter,
    clearFilter,
    hasActiveFilters: conditions.length > 0,
  };
}
