# Prisma 使用指南

本指南将帮助你在 Next.js 项目中使用 Prisma ORM。

## 📦 已安装的依赖

- `@prisma/client` - Prisma 客户端
- `prisma` - Prisma CLI 工具

## 🚀 快速开始

### 1. 生成 Prisma 客户端

在修改 `prisma/schema.prisma` 文件后，需要生成 Prisma 客户端：

```bash
pnpm db:generate
# 或
npx prisma generate
```

### 2. 数据库迁移

#### 方式一：推送 schema（开发环境推荐）

```bash
pnpm db:push
# 或
npx prisma db push
```

这会直接将 schema 推送到数据库，不会创建迁移文件。

#### 方式二：创建迁移（生产环境推荐）

```bash
pnpm db:migrate
# 或
npx prisma migrate dev --name init
```

这会创建迁移文件，更适合版本控制和团队协作。

### 3. 查看数据库（Prisma Studio）

```bash
pnpm db:studio
# 或
npx prisma studio
```

这会打开一个可视化界面，可以在浏览器中查看和编辑数据库数据。

## 📝 数据模型

当前定义的数据模型包括：

- **User** - 用户表
- **Customer** - 客户表
- **Invoice** - 发票表
- **Revenue** - 收入表

详细定义请查看 `prisma/schema.prisma` 文件。

## 💻 使用示例

### 基本查询

```typescript
import { prisma } from '@/app/lib/prisma'

// 查找所有客户
const customers = await prisma.customer.findMany()

// 查找单个客户
const customer = await prisma.customer.findUnique({
  where: { id: 'customer-id' }
})

// 创建客户
const newCustomer = await prisma.customer.create({
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    imageUrl: '/customers/john.png'
  }
})

// 更新客户
const updatedCustomer = await prisma.customer.update({
  where: { id: 'customer-id' },
  data: { name: 'Jane Doe' }
})

// 删除客户
await prisma.customer.delete({
  where: { id: 'customer-id' }
})
```

### 关联查询

```typescript
// 查找客户及其所有发票
const customerWithInvoices = await prisma.customer.findUnique({
  where: { id: 'customer-id' },
  include: {
    invoices: true
  }
})

// 查找发票及其客户信息
const invoiceWithCustomer = await prisma.invoice.findMany({
  include: {
    customer: {
      select: {
        name: true,
        email: true,
        imageUrl: true
      }
    }
  }
})
```

### 复杂查询

```typescript
// 条件查询
const pendingInvoices = await prisma.invoice.findMany({
  where: {
    status: 'pending',
    amount: {
      gt: 10000 // 大于 100 元（以分为单位）
    }
  }
})

// 搜索查询（不区分大小写）
const customers = await prisma.customer.findMany({
  where: {
    OR: [
      { name: { contains: 'john', mode: 'insensitive' } },
      { email: { contains: 'john', mode: 'insensitive' } }
    ]
  }
})

// 分页查询
const invoices = await prisma.invoice.findMany({
  take: 10,      // 每页 10 条
  skip: 20,      // 跳过前 20 条
  orderBy: {
    date: 'desc'
  }
})

// 聚合查询
const stats = await prisma.invoice.aggregate({
  _count: true,
  _sum: {
    amount: true
  },
  _avg: {
    amount: true
  }
})
```

## 🔄 从 SQL 迁移到 Prisma

项目中的 `app/lib/data-prisma.ts` 文件展示了如何将原有的 SQL 查询迁移到 Prisma。

### 对比示例

**原来的 SQL 查询：**
```typescript
const data = await sql<CustomerField[]>`
  SELECT id, name
  FROM customers
  ORDER BY name ASC
`;
```

**使用 Prisma：**
```typescript
const customers = await prisma.customer.findMany({
  select: {
    id: true,
    name: true,
  },
  orderBy: {
    name: 'asc',
  },
});
```

## 📚 常用 Prisma 操作

### 事务处理

```typescript
// 使用事务
const result = await prisma.$transaction(async (tx) => {
  const customer = await tx.customer.create({
    data: { name: 'John', email: 'john@example.com', imageUrl: '' }
  })
  
  const invoice = await tx.invoice.create({
    data: {
      customerId: customer.id,
      amount: 10000,
      status: 'pending'
    }
  })
  
  return { customer, invoice }
})
```

### 批量操作

```typescript
// 批量创建
await prisma.customer.createMany({
  data: [
    { name: 'John', email: 'john@example.com', imageUrl: '' },
    { name: 'Jane', email: 'jane@example.com', imageUrl: '' }
  ]
})

// 批量更新
await prisma.invoice.updateMany({
  where: { status: 'pending' },
  data: { status: 'paid' }
})

// 批量删除
await prisma.invoice.deleteMany({
  where: { status: 'cancelled' }
})
```

## 🔧 环境变量

确保你的 `.env` 文件中包含数据库连接字符串：

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?sslmode=require"
```

## 📖 更多资源

- [Prisma 官方文档](https://www.prisma.io/docs)
- [Prisma 客户端 API 参考](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [Next.js + Prisma 最佳实践](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)

## ⚠️ 注意事项

1. **开发环境**：每次修改 schema 后，记得运行 `pnpm db:generate` 重新生成客户端
2. **生产环境**：使用迁移而不是 `db push`
3. **类型安全**：Prisma 会自动生成 TypeScript 类型，充分利用类型提示
4. **性能**：使用 `select` 只查询需要的字段，避免查询不必要的数据
