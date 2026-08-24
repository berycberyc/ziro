"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import AppShell from "@/components/AppShell";

const navItems = [
  { href: "/admin/sessions", label: "Пробные тесты" },
  { href: "/admin/upload-download", label: "Жүктеу/түсіру" },
  { href: "/admin/monitoring", label: "Мониторинг" },
  { href: "/admin/bookings", label: "Оплата" },
  { href: "/admin/topics", label: "Тақырыптар" },
  { href: "/admin/zipgrade", label: "ZipGrade" },
  { href: "/admin/dev", label: "Әзірлеуші құралдары", danger: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLang();
  const [allowed, setAllowed] = useState<boolean | null>(null);

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

      setAllowed(profile?.role === "admin");
    }
    check();
  }, [router]);

  if (allowed === null) {
    return <main className="p-10 text-ink/50">{t.loading}</main>;
  }

  if (allowed === false) {
    return <main className="p-10 text-ink/70">{t.adminNoAccess}</main>;
  }

  return (
    <AppShell navItems={navItems} accent="admin">
      {children}
    </AppShell>
  );
}
