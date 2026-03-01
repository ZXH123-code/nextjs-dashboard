"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Send, User } from "lucide-react";
import { LoadingSpinner } from "@/app/ui/loading-spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { askAiQuestionAction } from "../../lib/ai-query";
import { cn } from "@/lib/utils";

type Message =
  | { role: "user"; content: string }
  | {
    role: "assistant";
    content: string;
    show_raw_table?: boolean;
    rows?: Record<string, unknown>[];
    columns?: string[];
    error?: string;
  };

const EXAMPLE_PROMPTS = [
  "本月各销售的线索数",
  "所有销售人员的优劣势",
  "最近 7 天新增商机数量",
  "各阶段商机金额汇总",
];

type AiQuerySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AiQuerySheet({ open, onOpenChange }: AiQuerySheetProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length || loading) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, loading]);

  async function handleSubmit(text?: string) {
    const q = (text ?? input.trim()) || "";
    if (!q || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const result = await askAiQuestionAction(q);
      if (result.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.answer ?? "",
            show_raw_table: result.show_raw_table ?? true,
            rows: result.rows ?? undefined,
            columns: result.columns ?? undefined,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", error: result.error ?? "请求失败" },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", error: "请求失败，请稍后重试" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName="bg-black/40"
        className="flex flex-col w-full max-w-xl sm:max-w-2xl overflow-hidden p-0"
      >
        <SheetHeader className="shrink-0 border-b bg-muted/30 px-4 py-3 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI 问数
          </SheetTitle>
          <SheetDescription className="text-xs">
            用自然语言提问，AI 会查询 CRM 数据并回答
          </SheetDescription>
        </SheetHeader>

        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="rounded-full bg-purple-500/10 p-4 mb-4">
                <Sparkles className="h-8 w-8 text-purple-500" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">有什么想问的？</p>
              <p className="text-xs text-muted-foreground mb-6 max-w-[260px]">
                例如：本月线索数、销售表现、商机阶段分布…
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSubmit(prompt)}
                    className="text-xs px-3 py-2 rounded-lg border bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-3 space-y-6">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "flex-row-reverse" : ""
                )}
              >
                <div
                  className={cn(
                    "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 min-w-0 space-y-2",
                    msg.role === "user" ? "flex flex-col items-end" : ""
                  )}
                >
                  {msg.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary text-primary-foreground px-4 py-2.5 text-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <>
                      {msg.error ? (
                        <div className="rounded-2xl rounded-tl-md border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
                          {msg.error}
                        </div>
                      ) : (
                        <>
                          {msg.content && (
                            <div className="rounded-2xl rounded-tl-md bg-muted/60 dark:bg-muted/40 px-4 py-2.5 text-sm [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          )}
                          {msg.show_raw_table !== false &&
                            msg.rows != null &&
                            msg.rows.length > 0 &&
                            msg.columns != null &&
                            msg.columns.length > 0 && (
                              <div className="rounded-xl border overflow-hidden bg-card">
                                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                                  <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-muted/80">
                                      <tr>
                                        {msg.columns.map((col) => (
                                          <th
                                            key={col}
                                            className="px-3 py-2 text-left font-medium text-muted-foreground"
                                          >
                                            {col}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {msg.rows.map((row, ri) => (
                                        <tr
                                          key={ri}
                                          className="border-t border-border/50"
                                        >
                                          {msg.columns!.map((col) => (
                                            <td
                                              key={col}
                                              className="px-3 py-2 text-foreground"
                                            >
                                              {row[col] != null
                                                ? String(row[col])
                                                : "—"}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-500/15 text-purple-600 dark:text-purple-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-tl-md bg-muted/60 dark:bg-muted/40 px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <LoadingSpinner type="arc" size={16} color="currentColor" className="shrink-0" />
                  正在查询数据…
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* 底部输入区 */}
        <div className="shrink-0 border-t border-border/50 bg-muted/20 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-background px-2 py-2 shadow-sm transition-[border-color,box-shadow] focus-within:border-purple-400/70 focus-within:shadow-[0_0_0_1px_rgba(147,51,234,0.12)]">
            <textarea
              placeholder="输入问题，Enter 发送"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
              className="min-h-[40px] max-h-28 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            />
            <Button
              type="button"
              size="icon"
              onClick={() => handleSubmit()}
              disabled={loading || !input.trim()}
              className="h-9 w-9 shrink-0 rounded-lg bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <LoadingSpinner type="arc" size={16} color="white" className="shrink-0" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
