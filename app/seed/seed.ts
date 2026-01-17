import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDateBetween = (start: Date, end: Date) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const decimal = (value: number, scale = 2) => new Prisma.Decimal(value.toFixed(scale));

async function main() {
  // 检查用户表是否已有数据，如果没有则创建示例用户
  const userCount = await prisma.users.count();
  if (userCount === 0) {
    console.log("用户表为空，创建示例用户...");
    const passwordHash = await bcrypt.hash("Password123!", 10);

    await prisma.users.createMany({
      data: [
        { name: "Admin", email: "admin@example.com", password: passwordHash },
        { name: "Operator", email: "operator@example.com", password: passwordHash },
        { name: "Viewer", email: "viewer@example.com", password: passwordHash },
      ],
    });
    console.log("示例用户创建完成。");
  } else {
    console.log(`用户表已有 ${userCount} 条数据，跳过用户数据创建。`);
  }

  const customerNames = ["Acme Corp", "Globex", "Initech", "Umbrella", "Stark Industries", "Wayne Enterprises", "Wonka Factory", "Hooli", "Aperture", "Monsters Inc"];

  await prisma.customer.createMany({
    data: customerNames.map((name, index) => ({
      name,
      email: `customer${index + 1}@example.com`,
      imageUrl: `/customers/customer-${index + 1}.png`,
    })),
  });

  const customerIds = (await prisma.customer.findMany({ select: { id: true } })).map((customer) => customer.id);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  await prisma.revenue.createMany({
    data: months.map((month) => ({
      month,
      revenue: randomInt(5000, 30000),
    })),
    skipDuplicates: true,
  });

  const invoiceStatuses = ["paid", "pending"];
  const today = new Date();
  const sixMonthsAgo = addDays(today, -180);

  await prisma.invoice.createMany({
    data: Array.from({ length: 25 }, () => ({
      customerId: pick(customerIds),
      amount: randomInt(5000, 200000),
      status: pick(invoiceStatuses),
      date: randomDateBetween(sixMonthsAgo, today),
    })),
  });

  const supplierNames = ["Shenzhen Bright", "Ningbo United", "Qingdao Ocean", "Xiamen Harbor", "Suzhou Precision"];

  const suppliers = [];
  for (let i = 0; i < supplierNames.length; i += 1) {
    const supplier = await prisma.scm_suppliers.create({
      data: {
        supplier_code: `SUP-${String(i + 1).padStart(3, "0")}`,
        erp_vendor_code: `ERP-${String(i + 1).padStart(3, "0")}`,
        full_name: supplierNames[i],
        short_name: supplierNames[i].split(" ")[0],
        contact_name: `Contact ${i + 1}`,
        contact_mobile: `138${randomInt(10000000, 99999999)}`,
        main_category: pick(["Electronics", "Apparel", "Home", "Accessories"]),
        province: pick(["Guangdong", "Zhejiang", "Jiangsu", "Fujian", "Shandong"]),
        status: 1,
      },
    });
    suppliers.push(supplier);
  }

  const statusOptions = [10, 20, 30, 40, 50];
  const itemUnits = ["PCS", "BOX", "SET"];

  for (let i = 0; i < 12; i += 1) {
    const supplier = pick(suppliers);
    const orderDate = randomDateBetween(addDays(today, -120), today);
    const requestedDelivery = addDays(orderDate, randomInt(15, 45));
    const status = pick(statusOptions);
    const confirmedDelivery = status >= 20 ? addDays(orderDate, randomInt(20, 50)) : null;
    const actualShipDate = status >= 40 ? addDays(orderDate, randomInt(25, 60)) : null;

    const order = await prisma.scm_purchase_orders.create({
      data: {
        po_number: `PO-${today.getFullYear()}-${String(i + 1).padStart(4, "0")}`,
        supplier_id: supplier.id,
        status,
        order_date: orderDate,
        requested_delivery_date: requestedDelivery,
        confirmed_delivery_date: confirmedDelivery,
        actual_ship_date: actualShipDate,
        currency: "USD",
        total_amount: decimal(0, 2),
        total_cbm: decimal(0, 3),
        incoterms: pick(["FOB", "CIF", "EXW"]),
        loading_port: pick(["Shenzhen", "Ningbo", "Qingdao", "Xiamen"]),
        rejection_reason: status === 30 ? "Price not acceptable" : null,
        remark: status === 40 ? "Partial shipment due to stock" : null,
        source_type: "SEED",
      },
    });

    let totalAmount = 0;
    let totalCbm = 0;
    const items = Array.from({ length: randomInt(2, 4) }, (_, itemIndex) => {
      const unitPrice = randomInt(5, 80);
      const quantity = randomInt(100, 800);
      const unitCbm = Math.random() * 0.05 + 0.01;

      totalAmount += unitPrice * quantity;
      totalCbm += unitCbm * quantity;

      return {
        po_id: order.id,
        sku_code: `SKU-${i + 1}-${itemIndex + 1}`,
        product_name: pick(["Bluetooth Speaker", "USB Cable", "Office Chair", "Desk Lamp", "Travel Mug"]),
        spec: pick(["Black", "White", "Blue", "Standard"]),
        quantity,
        unit: pick(itemUnits),
        unit_price: decimal(unitPrice, 2),
        carton_size: pick(["40x30x30", "50x40x35", "60x45x40"]),
        unit_cbm: decimal(unitCbm, 4),
        shipped_quantity: status >= 40 ? randomInt(50, quantity) : 0,
      };
    });

    await prisma.scm_purchase_order_items.createMany({ data: items });
    await prisma.scm_purchase_orders.update({
      where: { id: order.id },
      data: {
        total_amount: decimal(totalAmount, 2),
        total_cbm: decimal(totalCbm, 3),
      },
    });

    const eventCount = status >= 40 ? 2 : 1;
    const eventTypes = status >= 40 ? ["CONFIRMED", "SHIPPED"] : ["CREATED"];
    for (let eventIndex = 0; eventIndex < eventCount; eventIndex += 1) {
      await prisma.scm_order_events.create({
        data: {
          po_id: order.id,
          event_type: eventTypes[eventIndex] ?? "UPDATED",
          shipped_qty: status >= 40 ? randomInt(50, 400) : 0,
          logistics_no: status >= 40 ? `LOG-${order.id}-${eventIndex + 1}` : null,
          evidence_photos: status >= 40 ? "https://example.com/photo.jpg" : null,
          operator_name: pick(["Alice", "Bob", "Charlie", "Diana"]),
          event_time: addDays(orderDate, eventIndex * 5),
        },
      });
    }
  }
}

main()
  .then(() => {
    console.log("Seed data inserted successfully.");
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
