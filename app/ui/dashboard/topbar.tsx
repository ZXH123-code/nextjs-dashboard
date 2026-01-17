"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BellIcon, DocumentDuplicateIcon, HomeIcon, UserGroupIcon } from "@heroicons/react/24/outline";

const links = [
  { name: "Overview", href: "/dashboard", icon: HomeIcon },
  { name: "Invoices", href: "/dashboard/invoices", icon: DocumentDuplicateIcon },
  { name: "Customers", href: "/dashboard/customers", icon: UserGroupIcon },
];

export default function TopBar() {
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-600">
          <HomeIcon className="h-5 w-5" />
        </div>
        <div className="text-sm font-semibold text-gray-900">Dashboard</div>
      </div>

      <nav className="hidden items-center gap-1 md:flex">
        {links.map((link) => {
          const LinkIcon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={clsx(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900",
                isActive && "bg-gray-50 text-gray-900"
              )}
            >
              <LinkIcon className="h-4 w-4" />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/invoices/create"
          className="hidden items-center rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 md:flex"
        >
          New Invoice
        </Link>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
          aria-label="Notifications"
        >
          <BellIcon className="h-5 w-5" />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">U</div>
      </div>
    </div>
  );
}
