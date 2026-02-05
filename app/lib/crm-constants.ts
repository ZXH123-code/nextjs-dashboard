/**
 * CRM 常量（纯数据，无数据库依赖，可在客户端使用）
 */
export const LEAD_STATUS = ["未跟进", "跟进中", "有意向", "无意向"] as const;
export const OPPORTUNITY_STATUS = ["初步沟通", "方案确认", "待签约", "已赢单", "已丢单"] as const;
export const CUSTOMER_STATUS = ["预备签约", "已签约", "流失"] as const;
