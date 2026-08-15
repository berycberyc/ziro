export default function TestTypeCard({
  name,
  stages,
  format,
}: {
  name: string;
  stages: string;
  format: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-6">
      <h3 className="font-display text-lg font-bold text-ink">{name}</h3>
      <p className="mt-2 text-sm text-ink/60">{stages}</p>
      <p className="mt-3 inline-block rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-ink/80">
        {format}
      </p>
    </div>
  );
}
