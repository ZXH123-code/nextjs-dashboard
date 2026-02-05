import { getCrmAuth } from "@/app/lib/crm";
import { redirect } from "next/navigation";
import { LeadImportClient } from "../LeadImportClient";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function LeadImportPage() {
  const auth = await getCrmAuth();
  const role = auth?.role ?? "sales";
  if (role !== "admin") {
    redirect("/dashboard/crm/leads");
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">批量导入线索</h1>
          <p className="mt-1 text-base text-muted-foreground">
            上传 Excel（.xlsx）文件，先解析预览，再确认导入，避免误操作。
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link href="/dashboard/crm/leads">
            <ArrowLeft className="h-4 w-4" />
            返回线索列表
          </Link>
        </Button>
      </div>

      <Card className="w-full  mx-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">上传文件并预览</CardTitle>
          <CardDescription className="text-sm md:text-base">
            支持拖拽上传或点击选择本地 Excel 文件。系统会先解析并校验数据，展示预览和错误，再由你确认是否真正导入。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <LeadImportClient />
        </CardContent>
      </Card>
    </main>
  );
}

