"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AddStudentForm from "@/components/AddStudentForm";
import StudentList from "@/components/StudentList";

type Student = {
  id: string;
  full_name: string;
  grade: string | null;
  school: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  const loadStudents = useCallback(async (parentId: string) => {
    const { data } = await supabase
      .from("students")
      .select("id, full_name, grade, school")
      .eq("parent_id", parentId)
      .order("created_at", { ascending: false });
    setStudents(data ?? []);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
      } else {
        setUserId(data.user.id);
        setEmail(data.user.email ?? null);
        loadStudents(data.user.id);
      }
    });
  }, [router, loadStudents]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Жеке кабинет
          </h1>
          {email && <p className="mt-1 text-sm text-ink/60">{email}</p>}
        </div>
        <button
          onClick={handleLogout}
          className="focus-ring rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink/5"
        >
          Шығу
        </button>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold text-ink">Балаларым</h2>
        <div className="mt-4">
          <StudentList students={students} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-ink">
          Жаңа бала қосу
        </h2>
        <div className="mt-4">
          {userId && (
            <AddStudentForm
              parentId={userId}
              onAdded={() => loadStudents(userId)}
            />
          )}
        </div>
      </section>
    </main>
  );
}
