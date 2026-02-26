/**
 * 将 .env 中配置的数据库（生产/Neon）备份到本地 backups/ 目录。
 * 使用 DATABASE_URL_UNPOOLED（Neon 建议用直连做 pg_dump），若无则用 DATABASE_URL。
 * 需要本机已安装 PostgreSQL 客户端（pg_dump 在 PATH 中）。
 *
 * 用法：pnpm run db:backup 或 node tooling/backup-db.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const envPath = join(projectRoot, ".env");

if (!existsSync(envPath)) {
  console.error("未找到 .env，请确保在项目根目录存在 .env 并配置生产库连接。");
  process.exit(1);
}

const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) {
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1).replace(/\\"/g, '"');
    }
    env[key] = val;
  }
}

const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
if (!url || !url.startsWith("postgresql://")) {
  console.error("请在 .env 中配置 DATABASE_URL 或 DATABASE_URL_UNPOOLED（PostgreSQL 连接串）。");
  process.exit(1);
}

const backupsDir = join(projectRoot, "backups");
if (!existsSync(backupsDir)) {
  mkdirSync(backupsDir, { recursive: true });
}

const now = new Date();
const dateStr = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
  "-",
  String(now.getHours()).padStart(2, "0"),
  String(now.getMinutes()).padStart(2, "0"),
  String(now.getSeconds()).padStart(2, "0"),
].join("");
const outFile = join(backupsDir, `neondb-${dateStr}.sql`);

// 解析连接串，用环境变量传参避免命令行转义问题（尤其 Windows）
let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error("DATABASE_URL 格式无效。");
  process.exit(1);
}
const dbUser = decodeURIComponent(parsed.username || "");
const dbPassword = decodeURIComponent(parsed.password || "");
const dbHost = parsed.hostname || "";
const dbPort = parsed.port || "5432";
const dbName = (parsed.pathname || "").replace(/^\//, "") || "neondb";
const sslMode = parsed.searchParams.get("sslmode") || "require";

console.log("正在备份生产库到本地...");
console.log("输出文件:", outFile);

const runEnv = {
  ...process.env,
  PGHOST: dbHost,
  PGPORT: dbPort,
  PGUSER: dbUser,
  PGPASSWORD: dbPassword,
  PGDATABASE: dbName,
  PGSSLMODE: sslMode,
};

try {
  const outPath = outFile.replace(/\\/g, "/");
  execSync(`pg_dump --no-owner --no-acl -F p -f "${outPath}"`, {
    stdio: "inherit",
    shell: true,
    maxBuffer: 50 * 1024 * 1024,
    env: runEnv,
  });
  console.log("备份完成:", outFile);
} catch (e) {
  console.error(
    "pg_dump 执行失败。请确认：1) 已安装 PostgreSQL 客户端（pg_dump 在 PATH）；2) .env 中连接串可访问。",
    e?.message || e
  );
  process.exit(1);
}
