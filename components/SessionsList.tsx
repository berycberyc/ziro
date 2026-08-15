type Session = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  price: number;
  is_active: boolean;
};

export default function SessionsList({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return <p className="text-sm text-ink/50">Әзірге сессия жоқ.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-3"
        >
          <div>
            <span className="font-medium text-ink">{s.title_kk}</span>
            <span className="ml-2 text-sm text-ink/50">{s.title_ru}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-ink/60">
            <span>{s.session_date}</span>
            <span>{s.price.toLocaleString("ru-RU")} ₸</span>
          </div>
        </div>
      ))}
    </div>
  );
}
