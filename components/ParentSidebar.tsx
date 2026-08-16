"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard/profile", label: "Профиль" },
  { href: "/dashboard/students", label: "Ученик" },
  { href: "/dashboard/tests", label: "Тесты" },
  { href: "/dashboard/bookings", label: "Бронирленген" },
];

export default function ParentSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-ink/10 bg-parent-soft/40 p-4">
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`focus-ring rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-parent text-white" : "text-ink/70 hover:bg-parent-soft"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
