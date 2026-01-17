"use server";

import { z } from "zod";
import postgres from "postgres";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import bcrypt from "bcrypt";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

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
  });

  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    if (errors.confirmPassword) {
      return errors.confirmPassword[0];
    }
    return Object.values(errors).flat()[0] || "表单验证失败";
  }

  const { name, email, password } = validatedFields.data;

  // 2. 检查邮箱是否已存在
  try {
    const existingUser = await sql`SELECT email FROM users WHERE email = ${email}`;
    if (existingUser.length > 0) {
      return "该邮箱已被注册";
    }
  } catch (error) {
    console.error("Database Error:", error);
    return "数据库错误：无法检查邮箱";
  }

  // 3. 加密密码并创建用户
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, ${hashedPassword})
    `;
  } catch (error) {
    console.error("Database Error:", error);
    return "数据库错误：注册失败";
  }

  // 4. 注册成功，重定向到登录页面
  redirect("/login?registered=true");
}
