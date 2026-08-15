type Student = {
  id: string;
  full_name: string;
  grade: string | null;
  school: string | null;
};

export default function StudentList({ students }: { students: Student[] }) {
  if (students.length === 0) {
    return (
      <p className="text-sm text-ink/50">Әзірге бала қосылмаған.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {students.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-3"
        >
          <span className="font-medium text-ink">{s.full_name}</span>
          <span className="text-sm text-ink/50">
            {[s.grade, s.school].filter(Boolean).join(" · ")}
          </span>
        </div>
      ))}
    </div>
  );
}
