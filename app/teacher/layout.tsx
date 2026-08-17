"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import AppShell from "@/components/AppShell";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
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

      setAllowed(profile?.role === "teacher");
    }
    check();
  }, [router]);

  if (allowed === null) {
    return <main className="p-10 text-ink/50">{t.loading}</main>;
  }

  if (allowed === false) {
    return <main className="p-10 text-ink/70">{t.teacherNoAccess}</main>;
  }

  const navItems = [{ href: "/teacher/scan", label: t.navScan }];

  return (
    <AppShell navItems={navItems} accent="teacher">
      {children}
    </AppShell>
  );
}
