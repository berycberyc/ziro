"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/LangContext";

export default function TeacherSidebar() {
  const pathname = usePathname();
  const { t } = useLang();

  const navItems = [{ href: "/teacher/scan", label: t.navScan }];

  return (
    <nav
      className="flex w-full shrink-0 gap-1 overflow-x-auto border-b border-ink/10 bg-teacher-soft/40 p-3
                 sm:w-56 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-4"
    >
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`focus-ring shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-teacher text-white" : "text-ink/70 hover:bg-teacher-soft"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
