"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ParentSidebar from "@/components/ParentSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
      } else {
        setEmail(data.user.email ?? null);
        setChecked(true);
      }
    });
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!checked) {
    return <main className="p-10 text-ink/50">Жүктелуде...</main>;
  }

  return (
    <div className="flex min-h-screen bg-parchment">
      <ParentSidebar />
      <div className="flex-1 px-8 py-10">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm text-ink/50">{email}</span>
          <button
            onClick={handleLogout}
            className="focus-ring rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
          >
            Шығу
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
