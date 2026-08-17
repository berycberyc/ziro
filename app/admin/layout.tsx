"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import AppShell from "@/components/AppShell";

const navItems = [
  { href: "/admin/sessions", label: "Сессиялар" },
  { href: "/admin/test-types", label: "Тест түрлері" },
  { href: "/admin/bookings", label: "Бронирование" },
  { href: "/admin/results", label: "Нәтижелер" },
  { href: "/admin/online-test", label: "Онлайн тест" },
  { href: "/admin/zipgrade", label: "ZipGrade" },
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
