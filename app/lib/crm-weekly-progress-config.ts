/**
 * 「本周跟进」汇报页：仅对配置的部门显示侧栏入口。
 * 环境变量 CRM_WEEKLY_PROGRESS_DEPARTMENT_IDS：逗号/分号/空格分隔的部门 UUID，与 department 表 id 一致。
 * 未配置或为空时，任何用户均看不到该菜单（需在 .env.local 中配置）。
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getWeeklyProgressDepartmentIds(): string[] {
  const raw = process.env.CRM_WEEKLY_PROGRESS_DEPARTMENT_IDS?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => UUID_RE.test(s));
}

export function isWeeklyProgressDepartment(departmentId: string | null | undefined): boolean {
  if (!departmentId) return false;
  const allowed = getWeeklyProgressDepartmentIds();
  if (allowed.length === 0) return false;
  return allowed.includes(departmentId.toLowerCase());
}
