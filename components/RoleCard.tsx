type Tone = "parent" | "teacher" | "admin";

const toneStyles: Record<Tone, { bg: string; text: string; ring: string }> = {
  parent: { bg: "bg-parent-soft", text: "text-parent", ring: "ring-parent/20" },
  teacher: { bg: "bg-teacher-soft", text: "text-teacher", ring: "ring-teacher/20" },
  admin: { bg: "bg-admin-soft", text: "text-admin", ring: "ring-admin/20" },
};

export default function RoleCard({
  tone,
  title,
  body,
  index,
}: {
  tone: Tone;
  title: string;
  body: string;
  index: string;
}) {
  const s = toneStyles[tone];
  return (
    <div
      className={`rounded-2xl ${s.bg} p-6 ring-1 ${s.ring} transition-transform hover:-translate-y-0.5`}
    >
      <span className={`text-xs font-semibold tracking-wide ${s.text}`}>{index}</span>
      <h3 className={`mt-2 font-display text-xl font-bold ${s.text}`}>{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">{body}</p>
    </div>
  );
}
