"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AddStudentForm from "@/components/AddStudentForm";
import StudentList from "@/components/StudentList";

type Student = {
  id: string;
  full_name: string;
  grade: string | null;
  school: string | null;
};

export default function StudentsPage() {
  const [userId, setUserId] = useState<string | null>(null);
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
      if (data.user) {
        setUserId(data.user.id);
        loadStudents(data.user.id);
      }
    });
  }, [loadStudents]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Ученик</h1>

      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-ink">Балаларым</h2>
        <div className="mt-4">
          <StudentList students={students} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-ink">Жаңа бала қосу</h2>
        <div className="mt-4">
          {userId && (
            <AddStudentForm parentId={userId} onAdded={() => loadStudents(userId)} />
          )}
        </div>
      </section>
    </div>
  );
}
