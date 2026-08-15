type Format = "online" | "offline";

export default function TestSessionCard({
  type,
  date,
  format,
  price,
  seatsLeft,
  labels,
}: {
  type: string;
  date: string;
  format: Format;
  price: string;
  seatsLeft: number;
  labels: { online: string; offline: string; seats: string; book: string };
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-white p-6 sm:flex-row sm:items-center">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-bold text-ink">{type}</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              format === "online"
                ? "bg-parent-soft text-parent"
                : "bg-teacher-soft text-teacher"
            }`}
          >
            {format === "online" ? labels.online : labels.offline}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink/60">{date}</p>
        <p className="mt-1 text-xs text-ink/40">
          {labels.seats}: {seatsLeft}
        </p>
      </div>
      <div className="mt-4 flex items-center gap-4 sm:mt-0">
        <span className="font-display text-lg font-bold text-ink">{price}</span>
        <button className="focus-ring rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-parchment transition-opacity hover:opacity-90">
          {labels.book}
        </button>
      </div>
    </div>
  );
}
