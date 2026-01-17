import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 创建连接池和适配器
const connectionString = withLibpqCompatSsl(process.env.DATABASE_URL!);
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function withLibpqCompatSsl(value: string): string {
  try {
    const url = new URL(value);
    const sslmode = url.searchParams.get("sslmode");
    const needsCompat =
      sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca";

    if (!needsCompat) {
      return value;
    }

    url.searchParams.set("uselibpqcompat", "true");
    url.searchParams.set("sslmode", "require");
    return url.toString();
  } catch {
    return value;
  }
}
