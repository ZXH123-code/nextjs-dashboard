import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "./app/lib/prisma";

async function getUser(email: string) {
  try {
    const user = await prisma.users.findUnique({
      where: { email },
    });
    return user;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch user.");
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true, // 信任请求的 host，避免 UntrustedHost 错误（本地与反向代理场景）
  callbacks: {
    authorized: authConfig.callbacks?.authorized,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // 从数据库读取最新 role（Prisma 客户端可能未包含 role 字段时也能正确获取）
        try {
          const roleResult = await prisma.$queryRaw<{ role: string | null }[]>`
            SELECT role FROM users WHERE id::text = ${user.id}
          `;
          token.role = roleResult[0]?.role ?? "sales";
        } catch {
          token.role = (user as { role?: string }).role ?? "sales";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
        // 每次请求从数据库读取最新 role，确保权限调整后立即生效（无需重新登录）
        try {
          const roleResult = await prisma.$queryRaw<{ role: string | null }[]>`
            SELECT role FROM users WHERE id::text = ${token.id as string}
          `;
          (session.user as { role?: string }).role = roleResult[0]?.role ?? "sales";
        } catch {
          (session.user as { role?: string }).role = (token.role as string) ?? "sales";
        }
      }
      return session;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z.object({ email: z.string().email(), password: z.string().min(6) }).safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const normalizedEmail = email.toLowerCase().trim();
          const user = await getUser(normalizedEmail);
          if (!user) return null;
          const isDevPlainPassword =
            process.env.NODE_ENV === "development" && !/^\$2[ab]\$/.test(user.password);
          const passwordsMatch = isDevPlainPassword
            ? password === user.password
            : await bcrypt.compare(password, user.password);
          if (passwordsMatch) return user;
          return null;
        }
        return null;
      },
    }),
  ],
});
