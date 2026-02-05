"use client";

import { useTransition } from "react";
import { updateUserRoleAction } from "@/app/lib/auth-actions";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoleSelectFormProps {
  userId: string;
  currentRole: "admin" | "sales";
  isSelf?: boolean;
}

export function RoleSelectForm({ userId, currentRole, isSelf }: RoleSelectFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleChange = (newRole: string) => {
    if (newRole === currentRole) return;

    startTransition(async () => {
      const result = await updateUserRoleAction(userId, newRole as "admin" | "sales");
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <Select
      value={currentRole}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="min-w-[120px]">
        <SelectValue placeholder="选择角色" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="sales">销售人员</SelectItem>
        <SelectItem value="admin">销售总管</SelectItem>
      </SelectContent>
    </Select>
  );
}
