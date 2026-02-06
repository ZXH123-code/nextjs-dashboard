# CRM 表结构与关系说明

> 本文档偏技术，讲数据库表结构和字段。  
> 若想先了解业务逻辑和表单怎么用，请看 [CRM_四张表与表单逻辑说明.md](./CRM_四张表与表单逻辑说明.md)。

## 一、四张表关系图

```
                    ┌─────────────────┐
                    │    users        │  用户（销售人员/部门管理员）
                    │  id, name, email│
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   crm_leads     │ │crm_opportunities│ │ crm_customers   │
│  线索管理       │ │  商机管理       │ │  客户管理       │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                    │                   │
         │ 状态=有意向        │ 状态=待签约/已赢单  │
         │ 自动创建 ─────────►│ 自动创建 ────────►│
         │                    │                   │
         │                    │                   │
         └────────────────────┴───────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ crm_follow_ups  │  跟进记录
                    │ 关联 customer   │
                    │ 或 opportunity  │
                    └─────────────────┘
```

## 二、表字段与关联

### 1. crm_leads（线索管理）

| 字段            | 类型     | 说明                        |
| --------------- | -------- | --------------------------- |
| id              | UUID     | 主键                        |
| customer_name   | string   | 客户名称                    |
| nickname        | string?  | 昵称                        |
| city            | string?  | 城市                        |
| address         | string?  | 详细地址                    |
| industry        | string?  | 行业                        |
| lead_source     | string?  | 线索来源                    |
| created_at      | datetime | 创建日期（自动）            |
| customer_tier   | string?  | 客户分层                    |
| sales_person_id | UUID?    | 销售人员 → users.id         |
| status          | string   | 未跟进/跟进中/有意向/无意向 |
| is_claimed      | boolean  | 是否领取                    |

**关联：**

- `sales_person_id` → users（多对一）
- `opportunity` ← crm_opportunity（一对一，当转入商机后）

### 2. crm_opportunities（商机管理）

| 字段                | 类型     | 说明                                   |
| ------------------- | -------- | -------------------------------------- |
| id                  | UUID     | 主键                                   |
| name                | string   | 商机名称                               |
| lead_id             | UUID?    | 来源线索 → crm_leads.id                |
| product_type        | string?  | 产品类型                               |
| status              | string   | 初步沟通/方案确认/待签约/已赢单/已丢单 |
| amount              | decimal? | 商机金额                               |
| created_at          | datetime | 创建日期（自动）                       |
| expected_close_date | date?    | 预计赢单日期                           |
| sales_person_id     | UUID?    | 销售人员 → users.id                    |
| delivery_person_id  | UUID?    | 交付人员 → users.id                    |
| lost_reason         | string?  | 丢单原因                               |

**关联：**

- `lead_id` → crm_leads（多对一，可选）
- `sales_person_id` → users
- `customer` ← crm_customer（一对一，当转入客户后）
- `followUps` ← crm_follow_ups（一对多）

### 3. crm_customers（客户管理）

| 字段                   | 类型    | 说明                            |
| ---------------------- | ------- | ------------------------------- |
| id                     | UUID    | 主键                            |
| name                   | string  | 客户名称                        |
| nickname               | string? | 昵称                            |
| city                   | string? | 城市                            |
| customer_tier          | string? | 客户分层                        |
| first_maintenance_date | date?   | 初次维护日期                    |
| status                 | string  | 预备签约/已签约/流失            |
| industry               | string? | 行业                            |
| employee_count         | string? | 人员规模                        |
| tags                   | string? | 企业标签                        |
| main_products          | string? | 主营产品                        |
| opportunity_id         | UUID?   | 来源商机 → crm_opportunities.id |
| sales_person_id        | UUID?   | 销售人员 → users.id             |

**关联：**

- `opportunity_id` → crm_opportunities（多对一，可选）
- `sales_person_id` → users
- `followUps` ← crm_follow_ups（一对多）

### 4. crm_follow_ups（跟进记录）

| 字段            | 类型    | 说明                            |
| --------------- | ------- | ------------------------------- |
| id              | UUID    | 主键                            |
| content         | text    | 跟进记录内容                    |
| follow_up_by_id | UUID    | 跟进人 → users.id               |
| follow_date     | date    | 跟进日期                        |
| contact_person  | string? | 沟通对象                        |
| summary         | string? | 一句话进展                      |
| next_step       | string? | 下一步                          |
| customer_needs  | string? | 客户需求                        |
| status          | string? | 状态                            |
| customer_id     | UUID?   | 关联客户 → crm_customers.id     |
| opportunity_id  | UUID?   | 关联商机 → crm_opportunities.id |

**关联：**

- `follow_up_by_id` → users（多对一）
- `customer_id` → crm_customers（多对一，可选）
- `opportunity_id` → crm_opportunities（多对一，可选）

## 三、关联方式总结

| 主表              | 外键               | 被关联表          | 关系   | 说明                                |
| ----------------- | ------------------ | ----------------- | ------ | ----------------------------------- |
| crm_leads         | sales_person_id    | users             | 多对一 | 销售人员                            |
| crm_leads         | (反向)             | crm_opportunities | 一对一 | 线索转商机后，商机有 lead_id        |
| crm_opportunities | lead_id            | crm_leads         | 多对一 | 来源线索                            |
| crm_opportunities | sales_person_id    | users             | 多对一 | 销售人员                            |
| crm_opportunities | delivery_person_id | users             | 多对一 | 交付人员                            |
| crm_opportunities | (反向)             | crm_customers     | 一对一 | 商机转客户后，客户有 opportunity_id |
| crm_customers     | opportunity_id     | crm_opportunities | 多对一 | 来源商机                            |
| crm_customers     | sales_person_id    | users             | 多对一 | 销售人员                            |
| crm_follow_ups    | follow_up_by_id    | users             | 多对一 | 跟进人                              |
| crm_follow_ups    | customer_id        | crm_customers     | 多对一 | 关联客户                            |
| crm_follow_ups    | opportunity_id     | crm_opportunities | 多对一 | 关联商机                            |

## 四、状态流转规则

1. **线索 → 商机**

   - 触发：线索状态更新为「有意向」
   - 动作：创建商机，同步 客户名称 → 商机名称、城市、销售人员
   - 关联：商机.lead_id = 线索.id

2. **商机 → 客户**

   - 触发：商机状态更新为「待签约」或「已赢单」
   - 动作：创建客户，同步 **线索的客户名称** → 客户名称、及来源线索的昵称/城市/客户分层/行业、销售人员（无来源线索时退化为商机名称）
   - 关联：客户.opportunity_id = 商机.id

3. **跟进记录**
   - 可关联客户或商机（至少其一）
   - 跟进人从当前登录用户获取
   - **新建跟进表单联动**：选客户后商机仅显示该客户的来源商机（customer.opportunity_id）；选商机后若已转入客户则自动带出客户（opportunity → customer 反向关联）

## 五、数据库迁移

```bash
npx prisma migrate dev --name add_crm_tables
```

或若数据库不可用，仅生成客户端：

```bash
npx prisma generate
```
