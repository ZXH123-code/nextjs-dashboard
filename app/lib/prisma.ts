import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 检查并验证数据库连接字符串配置
function validateDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error(
      "❌ DATABASE_URL 环境变量未设置！\n" +
      "请在项目根目录的 .env 文件中添加：\n" +
      "DATABASE_URL=\"postgresql://用户名:密码@主机:端口/数据库名?schema=public\"\n" +
      "\n如果需要设置连接超时，可以在连接字符串后添加：\n" +
      "DATABASE_URL=\"postgresql://用户名:密码@主机:端口/数据库名?schema=public&connect_timeout=30&pool_timeout=30\""
    );
    throw new Error("DATABASE_URL 环境变量未设置");
  }

  // 检查是否包含连接超时配置，如果没有则提示用户
  if (!databaseUrl.includes("connect_timeout=") && process.env.NODE_ENV === "development") {
    console.warn(
      "⚠️  提示：如果遇到连接超时问题，可以在 DATABASE_URL 中添加超时参数：\n" +
      "在连接字符串后添加: &connect_timeout=30&pool_timeout=30"
    );
  }
}

// 验证配置（仅在首次加载时）
try {
  validateDatabaseConfig();
} catch (error) {
  // 在开发环境下显示错误，但不阻止应用启动
  if (process.env.NODE_ENV === "development") {
    console.error(error);
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    // Neon 数据库的优化配置
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// 在开发环境下，全局缓存 Prisma 客户端实例
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
