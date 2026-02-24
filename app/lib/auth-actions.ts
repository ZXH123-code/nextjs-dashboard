"use server";

import { randomInt } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { sendVerificationCodeEmail } from "@/app/lib/email";

export async function logout() {
  await signOut();
}

const COOLDOWN_SEC = 60;
const CODE_EXPIRY_MIN = 15;

/** 发送注册验证码（60 秒冷却，15 分钟有效） */
export async function sendVerificationCodeAction(
  email: string
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = z.string().email().safeParse(email?.trim());
  if (!parsed.success) {
    return { success: false, error: "请输入有效的邮箱地址" };
  }
  const normalizedEmail = parsed.data.toLowerCase();

  try {
    const existing = await prisma.users.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return { success: false, error: "该邮箱已被注册" };
    }

    const now = new Date();
    const existingCode = await prisma.email_verification_code.findUnique({
      where: { email_purpose: { email: normalizedEmail, purpose: "signup" } },
    });
    if (existingCode) {
      const elapsed = (now.getTime() - existingCode.createdAt.getTime()) / 1000;
      if (elapsed < COOLDOWN_SEC) {
        const remain = Math.ceil(COOLDOWN_SEC - elapsed);
        return { success: false, error: `请 ${remain} 秒后再试` };
      }
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(now.getTime() + CODE_EXPIRY_MIN * 60 * 1000);

    await prisma.email_verification_code.upsert({
      where: { email_purpose: { email: normalizedEmail, purpose: "signup" } },
      create: { email: normalizedEmail, code, purpose: "signup", expiresAt },
      update: { code, expiresAt, createdAt: now },
    });

    const result = await sendVerificationCodeEmail(normalizedEmail, code);
    if (!result.success) {
      return { success: false, error: result.error ?? "邮件发送失败" };
    }
    return { success: true };
  } catch (e) {
    console.error("sendVerificationCode:", e);
    return { success: false, error: "发送失败，请稍后重试" };
  }
}

export async function authenticate(prevState: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials.";
        default:
          return "Something went wrong.";
      }
    }
    throw error;
  }
}

export async function register(prevState: string | undefined, formData: FormData) {
  // 1. 验证表单数据
  const RegisterSchema = z
    .object({
      name: z.string().min(1, "姓名不能为空"),
      email: z.string().email("请输入有效的邮箱地址"),
      password: z.string().min(6, "密码至少需要6个字符"),
      confirmPassword: z.string().min(6, "确认密码至少需要6个字符"),
      verificationCode: z.string().length(6, "验证码为6位数字").regex(/^\d{6}$/, "验证码为6位数字"),
      inviteCode: z.string().min(1, "请输入邀请码"),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "密码和确认密码不匹配",
      path: ["confirmPassword"],
    });

  const validatedFields = RegisterSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    verificationCode: formData.get("verificationCode"),
    inviteCode: formData.get("inviteCode"),
  });

  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    if (errors.confirmPassword) {
      return errors.confirmPassword[0];
    }
    if (errors.verificationCode) {
      return errors.verificationCode[0];
    }
    if (errors.inviteCode) {
      return errors.inviteCode[0];
    }
    return Object.values(errors).flat()[0] || "表单验证失败";
  }

  const { name, email, password, verificationCode, inviteCode } = validatedFields.data;
  const normalizedEmail = email.toLowerCase();

  // 1.5 校验邀请码并确定角色
  const adminCode = process.env.INVITE_CODE_ADMIN ?? "";
  const salesCode = process.env.INVITE_CODE_SALES ?? "";
  let assignedRole: "admin" | "sales";
  if (inviteCode === adminCode) {
    assignedRole = "admin";
  } else if (inviteCode === salesCode) {
    assignedRole = "sales";
  } else {
    return "邀请码无效，请联系管理员获取邀请码";
  }

  // 2. 检查邮箱是否已存在
  try {
    const existingUser = await prisma.users.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return "该邮箱已被注册";
    }
  } catch (error) {
    console.error("Database Error:", error);
    return "数据库错误：无法检查邮箱";
  }

  // 3. 校验验证码
  try {
    const record = await prisma.email_verification_code.findUnique({
      where: { email_purpose: { email: normalizedEmail, purpose: "signup" } },
    });
    if (!record) {
      return "请先获取验证码";
    }
    if (record.expiresAt < new Date()) {
      return "验证码已过期，请重新获取";
    }
    if (record.code !== verificationCode) {
      return "验证码错误";
    }
  } catch (error) {
    console.error("Database Error:", error);
    return "数据库错误：验证失败";
  }

  // 4. 加密密码并创建用户
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.users.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: assignedRole,
      },
    });
    // 删除已用验证码（单次有效）
    await prisma.email_verification_code.deleteMany({
      where: { email: normalizedEmail, purpose: "signup" },
    });
  } catch (error) {
    console.error("Database Error:", error);
    return "数据库错误：注册失败";
  }

  // 5. 注册成功，重定向到登录页面
  redirect("/login?registered=true");
}

/** 更新用户角色（仅 admin 可操作，权限变更后立即生效，无需重新登录） */
export async function updateUserRoleAction(userId: string, newRole: "admin" | "sales") {
  const session = await auth();
  const currentUserId = (session?.user as { id?: string })?.id;
  const currentRole = (session?.user as { role?: string })?.role ?? "sales";

  if (!currentUserId) return { error: "请先登录" };
  if (currentRole !== "admin") return { error: "仅销售总管可调整用户角色" };
  if (!userId || !["admin", "sales"].includes(newRole)) return { error: "参数无效" };

  try {
    await prisma.users.update({
      where: { id: userId },
      data: { role: newRole },
    });
    revalidatePath("/dashboard/permissions");
    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    console.error("updateUserRole:", e);
    return { error: "更新失败" };
  }
}
