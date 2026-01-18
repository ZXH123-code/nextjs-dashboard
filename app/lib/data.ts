import { CustomerField, CustomersTableType, InvoiceForm, InvoicesTable, LatestInvoiceRaw, Revenue } from "./definitions";
import { formatCurrency } from "./utils";
import { prisma } from "@/app/lib/prisma";

export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    console.log("Fetching revenue data...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await prisma.revenue.findMany();

    console.log("Data fetch completed after 3 seconds.");

    return data;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await prisma.invoice.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        amount: true,
      },
    });

    // 需要手动 JOIN customers - Prisma 需要在 schema 中定义关系
    // 暂时返回简化数据
    const latestInvoices = data.map((invoice) => ({
      id: invoice.id,
      amount: formatCurrency(invoice.amount),
      name: 'Customer', // TODO: 添加 customer 关系后获取
      image_url: '/customers/placeholder.png',
      email: 'customer@email.com',
    }));
    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    // const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    // const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    // const invoiceStatusPromise = sql`SELECT
    //      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
    //      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
    //      FROM invoices`;
    // 并行执行多个查询，提高性能
    const [waiting_po_count, shipped_po_count, exception_po_count, total_po_count] = await Promise.all([
      prisma.scm_purchase_orders.count({ where: { status: 10 } }), // PENDING - 待接单
      prisma.scm_purchase_orders.count({ where: { status: 50 } }), // SHIPPED - 全部发货
      prisma.scm_purchase_orders.count({ where: { status: 30 } }), // REJECTED - 已拒绝
      prisma.scm_purchase_orders.count(), // 总数
    ]);

    // const data = await Promise.all([invoiceCountPromise, customerCountPromise, invoiceStatusPromise]);

    return {
      waiting_po_count,
      shipped_po_count,
      exception_po_count,
      total_po_count,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await prisma.invoice.findMany({
      skip: offset,
      take: ITEMS_PER_PAGE,
      where: {
        OR: [
          { status: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        amount: true,
        date: true,
        status: true,
      },
    });

    // 返回简化数据（需要在 schema 中添加关系才能 JOIN）
    return invoices.map(inv => ({
      ...inv,
      name: 'Customer',
      email: 'customer@email.com',
      image_url: '/customers/placeholder.png',
    }));
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const count = await prisma.invoice.count({
      where: {
        OR: [
          { status: { contains: query, mode: 'insensitive' } },
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

export async function fetchInvoiceById(id: string) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
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
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

export async function fetchCustomers() {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
      },
    });

    // 注意：Prisma 需要在 schema 中定义 Invoice 关系才能聚合
    // 暂时返回简化数据
    const customers = data.map((customer) => ({
      ...customer,
      image_url: customer.imageUrl,
      total_invoices: 0,
      total_pending: formatCurrency(0),
      total_paid: formatCurrency(0),
    }));

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
