"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/app/ui/loading-spinner";

type RowPreview = {
  row: number;
  status: "success" | "error";
  message?: string;
  data: {
    客户名称: string;
    昵称?: string;
    联系人?: string;
    城市?: string;
    详细地址?: string;
    行业?: string;
    线索来源?: string;
    客户分层?: string;
    预览销售人员?: string;
    状态: string;
    其他字段数?: number;
  };
};

type ImportResult = {
  success?: boolean;
  inserted?: number;
  failed?: number;
  error?: string;
  errors?: { row: number; message: string }[];
  mode?: "preview" | "import";
  willInsert?: number;
  preview?: RowPreview[];
};

type User = { id: string; name: string };

type AiTargetField = {
  id: string;
  label: string;
  description: string;
  required?: boolean;
};

type AiColumnSuggestion = {
  excelHeader: string;
  suggestedField: string | null;
  confidence: number | null;
  reason?: string;
  conflict?: boolean;
  sampleValues?: string[];
};

type AiMappingResponse = {
  success?: boolean;
  error?: string;
  columns?: AiColumnSuggestion[];
  targetFields?: AiTargetField[];
};

type MappingEntry = {
  targetField: string | null;
};

type MappingState = {
  columns: AiColumnSuggestion[];
  targetFields: AiTargetField[];
  mapping: Record<string, MappingEntry>;
};

const EXTRA_FIELDS_VALUE = "__extra__";
const IGNORE_COLUMN_VALUE = "__ignore__";

export function LeadImportClient({ users }: { users: User[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  /** 批量指定销售人员：导入时若选择，则所有线索均分配给该销售；空或不指定则为 __none__ */
  const [salesPersonId, setSalesPersonId] = useState<string>("__none__");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMapping, setAiMapping] = useState<MappingState | null>(null);
  const [useAiAssist, setUseAiAssist] = useState(false);
  const [confirmedMapping, setConfirmedMapping] = useState<Record<string, MappingEntry> | null>(null);
  const [mappingDirty, setMappingDirty] = useState(false);

  function clearFile() {
    setFile(null);
    setResult(null);
    setSalesPersonId("__none__");
    setAiError(null);
    setAiMapping(null);
    setConfirmedMapping(null);
    setMappingDirty(false);
  }

  function handleFileChange(f: File | null) {
    if (f && !f.name.endsWith(".xlsx")) {
      setResult({ error: "目前仅支持 .xlsx 文件" });
      setFile(null);
      return;
    }
    setResult(null);
    setAiError(null);
    setAiMapping(null);
    setConfirmedMapping(null);
    setMappingDirty(false);
    setFile(f);
  }

  function handleUseAiAssistChange(checked: boolean) {
    setUseAiAssist(checked);
    setResult(null);
    if (!checked) {
      setAiError(null);
      setAiMapping(null);
      setConfirmedMapping(null);
      setMappingDirty(false);
    }
  }

  function getSelectedTargetField(header: string): string {
    if (!aiMapping) return EXTRA_FIELDS_VALUE;
    const entry = aiMapping.mapping[header];
    if (!entry) return EXTRA_FIELDS_VALUE;
    if (entry.targetField === null) return IGNORE_COLUMN_VALUE;
    return entry.targetField;
  }

  function updateMapping(header: string, value: string) {
    if (!aiMapping) return;
    setAiMapping((prev) => {
      if (!prev) return prev;
      const next = { ...prev.mapping };
      if (value === EXTRA_FIELDS_VALUE) {
        // 作为扩展字段 extraFields：从 mapping 中移除
        delete next[header];
      } else if (value === IGNORE_COLUMN_VALUE) {
        next[header] = { targetField: null };
      } else {
        next[header] = { targetField: value };
      }
      setResult(null);
      setMappingDirty(true);
      return { ...prev, mapping: next };
    });
  }

  function confirmCurrentMapping() {
    if (!aiMapping) {
      setAiError("请先执行 AI 智能识别字段。");
      return;
    }

    const hasCustomerNameMapping = Object.values(aiMapping.mapping).some(
      (m) => m.targetField === "customerName",
    );
    if (!hasCustomerNameMapping) {
      setAiError("请至少将一列映射为“客户名称”（必填）后再确认映射。");
      return;
    }

    setConfirmedMapping(JSON.parse(JSON.stringify(aiMapping.mapping)) as Record<string, MappingEntry>);
    setMappingDirty(false);
    setResult(null);
    setAiError(null);
  }

  async function runAiMapping() {
    if (!file) {
      setResult({ error: "请先选择要上传的 Excel 文件" });
      return;
    }
    // 每次重新执行 AI 识别时，立刻清空上一轮预览结果，回到初始占位状态
    setResult(null);
    setAiLoading(true);
    setAiError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/crm/leads/import/ai-map", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as AiMappingResponse;
      if (!res.ok || data.success === false) {
        setAiError(data.error || "AI 字段映射失败，请稍后重试或手动选择字段。");
        setAiMapping(null);
        return;
      }
      const columns = data.columns ?? [];
      const targetFields = data.targetFields ?? [];
      if (!columns.length || !targetFields.length) {
        setAiError("AI 暂未给出字段映射建议，请手动选择字段。");
        setAiMapping(null);
        setConfirmedMapping(null);
        setMappingDirty(false);
        return;
      }
      const mapping: Record<string, MappingEntry> = {};
      for (const col of columns) {
        if (col.suggestedField) {
          mapping[col.excelHeader] = { targetField: col.suggestedField };
        }
      }
      setAiMapping({ columns, targetFields, mapping });
      setConfirmedMapping(null);
      setMappingDirty(true);
    } catch (err) {
      console.error(err);
      setAiError("AI 字段映射请求失败，请稍后重试或手动选择字段。");
      setAiMapping(null);
      setConfirmedMapping(null);
      setMappingDirty(false);
    } finally {
      setAiLoading(false);
    }
  }

  async function send(mode: "preview" | "import") {
    if (!file) {
      setResult({ error: "请先选择要上传的 Excel 文件" });
      return;
    }
    if (useAiAssist) {
      if (!aiMapping) {
        setResult({ error: "你已选择使用 AI，请先点击“AI 智能识别字段”并确认映射。" });
        return;
      }
      if (!confirmedMapping) {
        setResult({ error: "请先点击“确认字段映射”，再进行解析预览。" });
        return;
      }
      if (mappingDirty) {
        setResult({ error: "字段映射已修改，请先重新确认字段映射，再进行预览或导入。" });
        return;
      }
    }
    if (mode === "preview") {
      setLoading(true);
      setImporting(false);
    } else {
      setImporting(true);
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      if (useAiAssist && confirmedMapping && Object.keys(confirmedMapping).length > 0) {
        formData.append("mapping", JSON.stringify(confirmedMapping));
      }
      if (mode === "import" && salesPersonId && salesPersonId !== "__none__") {
        formData.append("salesPersonId", salesPersonId);
      }
      const res = await fetch("/api/crm/leads/import", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as ImportResult;
      if (!res.ok) {
        setResult({ ...data, success: false });
      } else {
        setResult({ ...data, success: true });
        if (mode === "import") {
          router.refresh();
        }
      }
    } catch (err) {
      console.error(err);
      setResult({ error: "请求失败，请稍后重试" });
    } finally {
      setLoading(false);
      setImporting(false);
    }
  }

  const shortFileName =
    file && file.name.length > 40
      ? file.name.slice(0, 20) + "..." + file.name.slice(-12)
      : file?.name;

  const canConfirmImport =
    !!file &&
    !!result &&
    result.mode === "preview" &&
    !result.error &&
    (!useAiAssist || (!!confirmedMapping && !mappingDirty)) &&
    (result.willInsert ?? 0) > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send("preview");
      }}
      className="space-y-6"
    >
      {/* 上传 & 说明 & 操作按钮 */}
      <div className="space-y-4">
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center transition-colors cursor-pointer",
            dragOver
              ? "border-primary bg-primary/5"
              : file
              ? "border-emerald-500 bg-emerald-50/80"
              : "border-muted-foreground/30 bg-muted/40"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) handleFileChange(dropped);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold mb-1">
              将 Excel 拖入此区域，或点击此区域选择文件
            </p>
            <p className="text-xs opacity-80">仅支持 .xlsx，建议不超过 5MB</p>
          </div>
          {file && (
            <div className="mt-1 text-[11px] text-slate-700">
              已选择文件，点击此区域可重新选择。
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">当前文件：</span>
          {file ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200">
                <FileSpreadsheet className="h-3 w-3" />
                <span className="max-w-[220px] truncate" title={file.name}>
                  {shortFileName}
                </span>
                <span className="text-[10px] opacity-80">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-xs"
                onClick={clearFile}
                title="清除文件"
              >
                ×
              </Button>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground/80">
              未选择文件
            </span>
          )}
        </div>

        <div className="rounded-md bg-muted/40 p-3 text-base text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">支持的表头（第一行）：</p>
          <p>必填：客户名称</p>
          <p>选填：昵称、联系人、联系人邮箱、城市、详细地址、行业、线索来源、客户分层、备注</p>
          <p>
            导入后状态均为「未跟进」。可在下方批量指定一名销售，则全部线索均分配给他；若不指定，则所有线索的销售人员均为「未指定」。
          </p>
        </div>

        <div className="rounded-md border bg-muted/20 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">字段映射策略</p>
              <p>解析并预览前，先决定是否使用 AI 映射；若开启 AI，需先确认映射后才能预览。</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={useAiAssist}
                onChange={(e) => handleUseAiAssistChange(e.target.checked)}
              />
              使用 AI 智能识别字段
            </label>
          </div>
        </div>

        {useAiAssist && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!file || aiLoading}
                onClick={() => void runAiMapping()}
              >
                {aiLoading ? (
                  <>
                    <LoadingSpinner
                      type="spinner"
                      size={14}
                      className="mr-1 text-primary"
                    />
                    正在调用 AI 识别字段…
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-1 h-3 w-3" />
                    AI 智能识别字段
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={!aiMapping || aiLoading}
                onClick={confirmCurrentMapping}
              >
                确认字段映射（必选）
              </Button>
              {confirmedMapping && !mappingDirty && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 border border-emerald-200">
                  字段映射已确认，可进行解析预览。
                </span>
              )}
              {mappingDirty && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 border border-amber-200">
                  字段映射有变更，请先重新「确认字段映射」。
                </span>
              )}
            </div>

            {aiError && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {aiError}
              </div>
            )}
          </div>
        )}

        {useAiAssist && aiMapping && (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium">字段映射预览（按列）</span>
              <span>
                {`共 ${aiMapping.columns.length} 列，AI 已为 ${
                  Object.values(aiMapping.mapping).filter((m) => m.targetField && m.targetField !== null).length
                } 列建议标准字段`}
              </span>
            </div>
            <div className="max-h-72 overflow-auto rounded border bg-background">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    <th className="border px-2 py-1 text-left">Excel 列名</th>
                    <th className="border px-2 py-1 text-left">示例值</th>
                    <th className="border px-2 py-1 text-left">映射到字段</th>
                    <th className="border px-2 py-1 text-left">AI 置信度/说明</th>
                  </tr>
                </thead>
                <tbody>
                  {aiMapping.columns.map((col) => {
                    const selected = getSelectedTargetField(col.excelHeader);
                    const confidenceLabel =
                      col.confidence == null
                        ? "—"
                        : col.confidence >= 0.9
                        ? "高"
                        : col.confidence >= 0.6
                        ? "中"
                        : "低";
                    return (
                      <tr key={col.excelHeader} className="hover:bg-muted/40">
                        <td className="border px-2 py-1 align-top">
                          <div className="font-medium text-[11px]">{col.excelHeader}</div>
                        </td>
                        <td className="border px-2 py-1 align-top">
                          <div className="max-w-[280px] truncate text-[11px]">
                            {col.sampleValues && col.sampleValues.length > 0
                              ? col.sampleValues.join("，")
                              : "（该列示例值为空）"}
                          </div>
                        </td>
                        <td className="border px-2 py-1 align-top">
                          <Select
                            value={selected}
                            onValueChange={(v) => updateMapping(col.excelHeader, v)}
                          >
                            <SelectTrigger className="h-7 min-w-[160px] text-[11px]">
                              <SelectValue placeholder="作为扩展字段保存到 extraFields" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={EXTRA_FIELDS_VALUE}>
                                作为扩展字段保存到 extraFields
                              </SelectItem>
                              <SelectItem value={IGNORE_COLUMN_VALUE}>不导入（忽略该列）</SelectItem>
                              {aiMapping.targetFields.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.label}
                                  {f.required ? "（必填）" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="border px-2 py-1 align-top text-[11px]">
                          <div
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                              col.conflict
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <span>{confidenceLabel}</span>
                            {col.confidence != null && (
                              <span className="opacity-70">
                                ({Math.round(col.confidence * 100)}%)
                              </span>
                            )}
                          </div>
                          {col.reason && (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {col.reason}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {canConfirmImport && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="import-sales-person" className="text-sm font-medium">
                批量指定销售人员
              </Label>
              <Select value={salesPersonId} onValueChange={setSalesPersonId}>
                <SelectTrigger id="import-sales-person" className="w-[220px]">
                  <SelectValue placeholder="不指定（按 Excel 列匹配）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不指定（按 Excel 列匹配）</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={loading || importing || !file || (useAiAssist && (!confirmedMapping || mappingDirty))}
            size="sm"
            onClick={() => void send("preview")}
          >
            {loading ? "解析中..." : "解析并预览"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canConfirmImport || importing}
            size="sm"
            onClick={() => void send("import")}
          >
            {importing ? "导入中..." : "确认导入"}
          </Button>
          {result?.willInsert != null && result.mode === "preview" && (
            <span className="text-[11px] text-muted-foreground">
              预览结果：预计可导入 {result.willInsert} 条，存在错误 {result.failed ?? 0} 条
            </span>
          )}
        </div>

        {result?.error && (
          <div className="mt-1 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <div>
              <div>{result.error}</div>
              {result.errors?.length ? (
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {result.errors.slice(0, 5).map((e) => (
                    <li key={e.row}>
                      第 {e.row} 行：{e.message}
                    </li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>…… 共 {result.errors.length} 条错误，仅展示前 5 条</li>
                  )}
                </ul>
              ) : null}
            </div>
          </div>
        )}

        {result?.success && result.mode === "import" && (
          <div className="mt-1 flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-base text-emerald-700">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <div>
              <div>
                导入成功 {result.inserted ?? 0} 条，失败 {result.failed ?? 0} 条。
              </div>
              {!!result.errors?.length && (
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {result.errors.slice(0, 5).map((e) => (
                    <li key={e.row}>
                      第 {e.row} 行：{e.message}
                    </li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>…… 共 {result.errors.length} 条错误，仅展示前 5 条</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 预览表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-base text-muted-foreground">
          <span className="font-medium">预览结果</span>
          <span>
            {result?.preview?.length
              ? `展示前 ${result.preview.length} 行（实际行数可能更多）`
              : "解析后将在此展示每一行的状态与字段"}
          </span>
        </div>

        {result?.preview && result.preview.length > 0 ? (
          <div className="max-h-[480px] overflow-auto rounded-md border bg-background">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/60 sticky top-0 z-10">
                <tr>
                  <th colSpan={3} className="border px-2 py-1 text-left text-xs text-muted-foreground">
                    预览元信息
                  </th>
                  <th colSpan={8} className="border px-2 py-1 text-left text-xs text-muted-foreground">
                    预览字段（导入后的主要展示字段）
                  </th>
                </tr>
                <tr>
                  <th className="border px-2 py-1 text-left">行号</th>
                  <th className="border px-2 py-1 text-left">导入结果</th>
                  <th className="border px-2 py-1 text-left">错误信息</th>
                  <th className="border px-2 py-1 text-left">客户名称</th>
                  <th className="border px-2 py-1 text-left">联系人</th>
                  <th className="border px-2 py-1 text-left">城市</th>
                  <th className="border px-2 py-1 text-left">行业</th>
                  <th className="border px-2 py-1 text-left">线索来源</th>
                  <th className="border px-2 py-1 text-left">客户等级</th>
                  <th className="border px-2 py-1 text-left">预览销售人员</th>
                  <th className="border px-2 py-1 text-left">状态值</th>
                  <th className="border px-2 py-1 text-left">其他字段</th>
                </tr>
              </thead>
              <tbody>
                {result.preview.map((row) => (
                  <tr key={row.row} className="hover:bg-muted/40">
                    <td className="border px-2 py-1">{row.row}</td>
                    <td
                      className={`border px-2 py-1 font-medium ${row.status === "success" ? "text-emerald-600" : "text-red-600"
                        }`}
                    >
                      {row.status === "success" ? "成功" : "失败"}
                    </td>
                    <td className="border px-2 py-1 text-[11px]">
                      {row.message ?? "-"}
                    </td>
                    <td className="border px-2 py-1">{row.data.客户名称}</td>
                    <td className="border px-2 py-1">{row.data.联系人 ?? "-"}</td>
                    <td className="border px-2 py-1">{row.data.城市 ?? "-"}</td>
                    <td className="border px-2 py-1">{row.data.行业 ?? "-"}</td>
                    <td className="border px-2 py-1">{row.data.线索来源 ?? "-"}</td>
                    <td className="border px-2 py-1">{row.data.客户分层 ?? "-"}</td>
                    <td className="border px-2 py-1">{row.data.预览销售人员 ?? "未指定"}</td>
                    <td className="border px-2 py-1">{row.data.状态}</td>
                    <td className="border px-2 py-1 text-[11px]">
                      {row.data.其他字段数 != null && row.data.其他字段数 > 0
                        ? `有（${row.data.其他字段数}）`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-md border border-dashed bg-muted/30 text-base text-muted-foreground">
            解析后，这里会展示 Excel 各行的字段与成功/失败状态
          </div>
        )}
      </div>
    </form>
  );
}

