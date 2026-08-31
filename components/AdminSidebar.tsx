"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin/sessions", label: "Сессиялар" },
  { href: "/admin/test-types", label: "Тест түрлері" },
  { href: "/admin/bookings", label: "Бронирование" },
  { href: "/admin/results", label: "Нәтижелер" },
  { href: "/admin/online-test", label: "Онлайн тест" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="flex w-full shrink-0 gap-1 overflow-x-auto border-b border-ink/10 bg-admin-soft/40 p-3
                 sm:w-56 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-4"
    >
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`focus-ring shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-admin text-white"
                : "text-ink/70 hover:bg-admin-soft"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
