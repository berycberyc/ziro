export default function TestSessionCard({
  title,
  date,
  price,
  typesNote,
  bookLabel,
  onBook,
}: {
  title: string;
  date: string;
  price: string;
  typesNote: string;
  bookLabel: string;
  onBook?: () => void;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center">
      <div>
        <span className="font-display text-lg font-bold text-ink">{title}</span>
        <p className="mt-1 text-sm text-ink/60">{date}</p>
        <p className="mt-1 text-xs text-ink/40">{typesNote}</p>
      </div>
      <div className="mt-4 flex items-center gap-4 sm:mt-0">
        <span className="font-display text-lg font-bold text-gold">{price}</span>
        <button
          onClick={onBook}
          className="focus-ring rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-parchment shadow-sm transition-all hover:opacity-90 hover:shadow-md"
        >
          {bookLabel}
        </button>
      </div>
    </div>
  );
}
