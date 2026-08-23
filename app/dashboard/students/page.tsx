"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import AddStudentForm from "@/components/AddStudentForm";
import StudentList from "@/components/StudentList";

type Student = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  gender: string | null;
  grade: string | null;
  region: string | null;
  city: string | null;
  school: string | null;
  iin: string | null;
  language: string | null;
  photo_url: string | null;
  zipgrade_id: string | null;
};

export default function StudentsPage() {
  const { t } = useLang();
  const [userId, setUserId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  const loadStudents = useCallback(async (parentId: string) => {
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name, full_name, gender, grade, region, city, school, iin, language, photo_url, zipgrade_id")
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
      <h1 className="font-display text-2xl font-bold text-ink">{t.studentsTitle}</h1>

      <section className="mt-6">
        <h2 className="font-display text-lg font-bold text-ink">{t.myChildrenTitle}</h2>
        <div className="mt-4">
          {userId && (
            <StudentList students={students} parentId={userId} onChanged={() => loadStudents(userId)} />
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-ink">{t.addChildTitle}</h2>
        <div className="mt-4">
          {userId && (
            <AddStudentForm parentId={userId} onAdded={() => loadStudents(userId)} />
          )}
        </div>
      </section>
    </div>
  );
}
