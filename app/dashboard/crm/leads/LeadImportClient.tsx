"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";

type RowPreview = {
  row: number;
  status: "success" | "error";
  message?: string;
  data: {
    客户名称: string;
    昵称?: string;
    城市?: string;
    详细地址?: string;
    行业?: string;
    线索来源?: string;
    客户分层?: string;
    销售人员邮箱?: string;
    状态: string;
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

export function LeadImportClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFileChange(f: File | null) {
    if (f && !f.name.endsWith(".xlsx")) {
      setResult({ error: "目前仅支持 .xlsx 文件" });
      setFile(null);
      return;
    }
    setResult(null);
    setFile(f);
  }

  async function send(mode: "preview" | "import") {
    if (!file) {
      setResult({ error: "请先选择要上传的 Excel 文件" });
      return;
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
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/40 px-6 py-10 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
            }`}
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
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-1">拖拽 Excel 文件到此处，或点击选择文件</p>
            <p>.xlsx，建议不超过 5MB</p>
          </div>
          <div className="mt-2 flex flex-col items-center gap-2">
            <Input
              type="file"
              accept=".xlsx"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="max-w-xs cursor-pointer bg-background"
            />
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                <span>{shortFileName}</span>
                <span>({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md bg-muted/40 p-3 text-base text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">支持的表头（第一行）：</p>
          <p>必填：客户名称</p>
          <p>选填：昵称、城市、详细地址、行业、线索来源、客户分层、销售人员邮箱、状态</p>
          <p>
            状态仅支持：未跟进 / 跟进中 / 有意向 / 无意向（为空则默认未跟进）。销售人员邮箱会按
            users.email 匹配。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={loading || importing || !file}
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
                  <th className="border px-2 py-1 text-left">行号</th>
                  <th className="border px-2 py-1 text-left">状态</th>
                  <th className="border px-2 py-1 text-left">错误信息</th>
                  <th className="border px-2 py-1 text-left">客户名称</th>
                  <th className="border px-2 py-1 text-left">城市</th>
                  <th className="border px-2 py-1 text-left">行业</th>
                  <th className="border px-2 py-1 text-left">线索来源</th>
                  <th className="border px-2 py-1 text-left">销售人员邮箱</th>
                  <th className="border px-2 py-1 text-left">状态值</th>
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
                    <td className="border px-2 py-1">{row.data.城市 ?? "-"}</td>
                    <td className="border px-2 py-1">{row.data.行业 ?? "-"}</td>
                    <td className="border px-2 py-1">{row.data.线索来源 ?? "-"}</td>
                    <td className="border px-2 py-1">
                      {row.data.销售人员邮箱 ?? "-"}
                    </td>
                    <td className="border px-2 py-1">{row.data.状态}</td>
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

