"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import AppShell, { type NavItem } from "@/components/AppShell";
import {
  ACCOUNTANT_PATHS,
  StaffRoleProvider,
  type StaffRole,
} from "@/lib/StaffRoleContext";

const navItems: NavItem[] = [
  { href: "/admin/steps", label: "Қадамдар" },
  { href: "/admin/sessions", label: "Пробные тесты" },
  { href: "/admin/upload-download", label: "Жүктеу/түсіру" },
  { href: "/admin/monitoring", label: "Мониторинг" },
  { href: "/admin/bookings", label: "Оплата" },
  { href: "/admin/topics", label: "Тақырыптар" },
  { href: "/admin/scoring", label: "Нәтижелерді есептеу" },
  { href: "/admin/ads", label: "Жарнама" },
  { href: "/admin/zipgrade", label: "ZipGrade" },
  { href: "/admin/dev", label: "Әзірлеуші құралдары", danger: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLang();
  // null — әлі тексерілуде; "none" — әкімші де, бухгалтер де емес.
  const [role, setRole] = useState<StaffRole | "none" | null>(null);

  useEffect(() => {
    async function check() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();

      const r = profile?.role;
      setRole(r === "admin" || r === "accountant" ? r : "none");
    }
    check();
  }, [router]);

  // Бухгалтердің басты беті — «Оплата».
  useEffect(() => {
    if (role === "accountant" && pathname === "/admin") {
      router.replace("/admin/bookings");
    }
  }, [role, pathname, router]);

  if (role === null) {
    return <main className="p-10 text-ink/50">{t.loading}</main>;
  }

  if (role === "none") {
    return <main className="p-10 text-ink/70">{t.adminNoAccess}</main>;
  }

  const visibleNav =
    role === "admin"
      ? navItems
      : navItems.filter((item) => ACCOUNTANT_PATHS.includes(item.href));

  const accountantBlocked =
    role === "accountant" && !ACCOUNTANT_PATHS.includes(pathname);

  let content: React.ReactNode = children;
  if (accountantBlocked) {
    content =
      pathname === "/admin" ? (
        <p className="text-ink/50">{t.loading}</p>
      ) : (
        <p className="text-ink/70">{t.adminNoAccess}</p>
      );
  }

  return (
    <StaffRoleProvider value={role}>
      <AppShell navItems={visibleNav} accent="admin">
        {content}
      </AppShell>
    </StaffRoleProvider>
  );
}
