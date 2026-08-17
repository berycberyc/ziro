"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin/sessions", label: "Сессиялар" },
  { href: "/admin/test-types", label: "Тест түрлері" },
  { href: "/admin/bookings", label: "Бронирование" },
  { href: "/admin/results", label: "Нәтижелер" },
  { href: "/admin/online-test", label: "Онлайн тест" },
  { href: "/admin/zipgrade", label: "ZipGrade" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-ink/10 bg-admin-soft/40 p-4">
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`focus-ring rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
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
