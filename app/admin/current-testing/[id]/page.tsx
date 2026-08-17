"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Registration = {
  id: string;
  classroom: string | null;
  seat: string | null;
  checked_in_at: string | null;
  student_id: string;
  test_type_id: string;
};

type StudentInfo = { id: string; full_name: string; zipgrade_id: string | null };
type TestTypeInfo = { id: string; name_kk: string; name_ru: string };

type Row = Registration & { student: StudentInfo | null; testType: TestTypeInfo | null };

type Filter = "all" | "arrived" | "missing";

export default function AdminCurrentTestingDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [sessionTitle, setSessionTitle] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [classroomFilter, setClassroomFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);

    const { data: sessionData } = await supabase
      .from("test_sessions")
      .select("title_kk")
      .eq("id", sessionId)
      .single();
    if (sessionData) setSessionTitle(sessionData.title_kk);

    const { data: regs } = await supabase
      .from("registrations")
      .select("id, classroom, seat, checked_in_at, student_id, test_type_id")
      .eq("test_session_id", sessionId)
      .eq("payment_status", "paid");

    const registrations = regs ?? [];
    const studentIds = [...new Set(registrations.map((r) => r.student_id))];
    const testTypeIds = [...new Set(registrations.map((r) => r.test_type_id))];

    const [studentsRes, testTypesRes] = await Promise.all([
      supabase.from("students").select("id, full_name, zipgrade_id").in("id", studentIds),
      supabase.from("test_types").select("id, name_kk, name_ru").in("id", testTypeIds),
    ]);

    const studentsMap = new Map((studentsRes.data ?? []).map((s) => [s.id, s]));
    const testTypesMap = new Map((testTypesRes.data ?? []).map((tt) => [tt.id, tt]));

    setRows(
      registrations.map((r) => ({
        ...r,
        student: studentsMap.get(r.student_id) ?? null,
        testType: testTypesMap.get(r.test_type_id) ?? null,
      }))
    );
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const booked = rows.length;
  const arrived = rows.filter((r) => r.checked_in_at).length;
  const missing = booked - arrived;

  const classrooms = useMemo(() => {
    const set = new Set(rows.map((r) => r.classroom).filter(Boolean) as string[]);
    return [...set].sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (filter === "arrived") result = result.filter((r) => r.checked_in_at);
    if (filter === "missing") result = result.filter((r) => !r.checked_in_at);
    if (classroomFilter !== "all") result = result.filter((r) => r.classroom === classroomFilter);
    return [...result].sort((a, b) => (a.classroom ?? "").localeCompare(b.classroom ?? ""));
  }, [rows, filter, classroomFilter]);

  return (
    <div>
      <Link href="/admin/current-testing" className="text-sm text-ink/50 hover:underline">
        ← Ағымдағы тестілеу
      </Link>
      <h1 className="font-display text-2xl font-bold text-ink">{sessionTitle}</h1>

      {loading && <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>}

      <div className="mt-6 grid grid-cols-3 gap-3">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-2xl border p-5 text-center transition-colors focus-ring ${
            filter === "all" ? "border-admin bg-admin text-white" : "border-ink/10 bg-white text-ink"
          }`}
        >
          <p className="text-3xl font-bold">{booked}</p>
          <p className="mt-1 text-sm opacity-80">Брондалған</p>
        </button>
        <button
          onClick={() => setFilter("arrived")}
          className={`rounded-2xl border p-5 text-center transition-colors focus-ring ${
            filter === "arrived" ? "border-parent bg-parent text-white" : "border-ink/10 bg-white text-ink"
          }`}
        >
          <p className="text-3xl font-bold">{arrived}</p>
          <p className="mt-1 text-sm opacity-80">Келді</p>
        </button>
        <button
          onClick={() => setFilter("missing")}
          className={`rounded-2xl border p-5 text-center transition-colors focus-ring ${
            filter === "missing" ? "border-teacher bg-teacher text-white" : "border-ink/10 bg-white text-ink"
          }`}
        >
          <p className="text-3xl font-bold">{missing}</p>
          <p className="mt-1 text-sm opacity-80">Келмеді</p>
        </button>
      </div>

      {classrooms.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-ink/50">Аудитория:</span>
          <select
            value={classroomFilter}
            onChange={(e) => setClassroomFilter(e.target.value)}
            className="focus-ring rounded-xl border border-ink/15 bg-white px-3 py-1.5 text-sm"
          >
            <option value="all">Барлығы</option>
            {classrooms.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-ink/50">
              <th className="py-2 pr-4">ФИО</th>
              <th className="py-2 pr-4">ZipGrade ID</th>
              <th className="py-2 pr-4">Тест түрі</th>
              <th className="py-2 pr-4">Аудитория</th>
              <th className="py-2 pr-4">Орын</th>
              <th className="py-2 pr-4">Келді ме?</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-b border-ink/5">
                <td className="py-2 pr-4">{r.student?.full_name}</td>
                <td className="py-2 pr-4">{r.student?.zipgrade_id ?? "—"}</td>
                <td className="py-2 pr-4">{r.testType?.name_kk}</td>
                <td className="py-2 pr-4">{r.classroom ?? "—"}</td>
                <td className="py-2 pr-4">{r.seat ?? "—"}</td>
                <td className="py-2 pr-4">
                  {r.checked_in_at ? (
                    <span className="rounded-full bg-parent-soft px-3 py-1 text-xs font-semibold text-parent">
                      Келді
                    </span>
                  ) : (
                    <span className="rounded-full bg-teacher-soft px-3 py-1 text-xs font-semibold text-teacher">
                      Келмеді
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filteredRows.length === 0 && (
          <p className="mt-2 text-sm text-ink/50">Тізім бос.</p>
        )}
      </div>
    </div>
  );
}
