import Link from "next/link";

type Session = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  price: number;
  is_active: boolean;
  is_checking: boolean;
  has_results: boolean;
};

export default function SessionsList({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return <p className="text-sm text-ink/50">Әзірге сессия жоқ.</p>;
  }

  function statusLabel(s: Session) {
    if (s.has_results) return { text: "Нәтиже дайын", color: "bg-parent-soft text-parent" };
    if (s.is_checking) return { text: "Тексеру", color: "bg-teacher-soft text-teacher" };
    if (s.is_active) return { text: "Тіркеу ашық", color: "bg-admin-soft text-admin" };
    return { text: "Жабық", color: "bg-ink/10 text-ink/50" };
  }

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((s) => {
        const status = statusLabel(s);
        return (
          <Link
            key={s.id}
            href={`/admin/sessions/${s.id}`}
            className="focus-ring flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md hover:border-admin/30"
          >
            <div>
              <span className="font-display font-semibold text-ink">{s.title_kk}</span>
              <span className="ml-2 text-sm text-ink/50">{s.title_ru}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-ink/60">
              <span>{s.session_date}</span>
              <span className="font-semibold text-gold-deep">{s.price.toLocaleString("ru-RU")} ₸</span>
              <span className={`rounded-full px-3 py-1 font-body text-xs font-semibold ${status.color}`}>
                {status.text}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
