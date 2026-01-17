// 使用 Prisma 的数据查询函数示例
// 这个文件展示了如何使用 Prisma 替换原有的 SQL 查询

import { prisma } from "./prisma";
import { formatCurrency } from "./utils";
import { CustomerField, FormattedCustomersTable, InvoiceForm, InvoicesTable, Revenue } from "./definitions";

// 获取收入数据
export async function fetchRevenue() {
  try {
    console.log("Fetching revenue data...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await prisma.revenue.findMany({
      orderBy: {
        month: "asc",
      },
    });

    console.log("Data fetch completed after 3 seconds.");

    return data as Revenue[];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

// 获取最新的发票
export async function fetchLatestInvoices() {
  try {
    const data = await prisma.invoice.findMany({
      take: 5,
      orderBy: {
        date: "desc",
      },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            imageUrl: true,
          },
        },
      },
    });

    const latestInvoices = data.map((invoice) => ({
      id: invoice.id,
      amount: formatCurrency(invoice.amount),
      name: invoice.customer.name,
      email: invoice.customer.email,
      image_url: invoice.customer.imageUrl,
    }));

    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

// 获取卡片数据（统计信息）
export async function fetchCardData() {
  try {
    // 并行执行多个查询
    const [invoiceCount, customerCount, invoiceStatus] = await Promise.all([
      prisma.invoice.count(),
      prisma.customer.count(),
      prisma.invoice.groupBy({
        by: ["status"],
        _sum: {
          amount: true,
        },
      }),
    ]);

    const paidInvoices = invoiceStatus.find((item) => item.status === "paid");
    const pendingInvoices = invoiceStatus.find((item) => item.status === "pending");

    return {
      numberOfCustomers: customerCount,
      numberOfInvoices: invoiceCount,
      totalPaidInvoices: formatCurrency(paidInvoices?._sum.amount ?? 0),
      totalPendingInvoices: formatCurrency(pendingInvoices?._sum.amount ?? 0),
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

// 获取分页的发票列表（带搜索）
const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await prisma.invoice.findMany({
      take: ITEMS_PER_PAGE,
      skip: offset,
      where: {
        OR: [
          { customer: { name: { contains: query, mode: "insensitive" } } },
          { customer: { email: { contains: query, mode: "insensitive" } } },
          { amount: { equals: parseInt(query) || undefined } },
          { status: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return invoices.map((invoice) => ({
      id: invoice.id,
      amount: invoice.amount,
      date: invoice.date.toISOString(),
      status: invoice.status as "pending" | "paid",
      name: invoice.customer.name,
      email: invoice.customer.email,
      image_url: invoice.customer.imageUrl,
    })) as InvoicesTable[];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

// 获取发票总页数
export async function fetchInvoicesPages(query: string) {
  try {
    const count = await prisma.invoice.count({
      where: {
        OR: [
          { customer: { name: { contains: query, mode: "insensitive" } } },
          { customer: { email: { contains: query, mode: "insensitive" } } },
          { amount: { equals: parseInt(query) || undefined } },
          { status: { contains: query, mode: "insensitive" } },
        ],
      },
    });

    const totalPages = Math.ceil(count / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

// 根据 ID 获取发票
export async function fetchInvoiceById(id: string) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        customerId: true,
        amount: true,
        status: true,
      },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    return {
      ...invoice,
      customer_id: invoice.customerId,
      // 将金额从分转换为元
      amount: invoice.amount / 100,
    } as InvoiceForm;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

// 获取所有客户（用于下拉选择）
export async function fetchCustomers() {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return customers as CustomerField[];
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

// 获取过滤后的客户列表
export async function fetchFilteredCustomers(query: string) {
  try {
    const customers = await prisma.customer.findMany({
      where: {
        OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }],
      },
      include: {
        invoices: {
          select: {
            id: true,
            amount: true,
            status: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const formattedCustomers = customers.map((customer) => {
      const totalPending = customer.invoices.filter((inv) => inv.status === "pending").reduce((sum, inv) => sum + inv.amount, 0);

      const totalPaid = customer.invoices.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + inv.amount, 0);

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        image_url: customer.imageUrl,
        total_invoices: customer.invoices.length,
        total_pending: formatCurrency(totalPending),
        total_paid: formatCurrency(totalPaid),
      };
    });

    return formattedCustomers as FormattedCustomersTable[];
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
