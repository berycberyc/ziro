/**
 * Олимпиаданың уақыты — Астана уақыты (UTC+5).
 *
 * Intl-дің "Asia/Almaty" белдеуіне сенбейміз: ескі телефондарда ол әлі
 * +6 болып тұруы мүмкін (Қазақстан 2024 жылы бір белдеуге көшті).
 * Сондықтан +5 сағатты қолмен қосамыз.
 */

const ASTANA_OFFSET_MS = 5 * 60 * 60 * 1000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** ISO уақыт -> { date: "2027-03-14", time: "10:00" } Астана бойынша. */
export function toAstanaParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(new Date(iso).getTime() + ASTANA_OFFSET_MS);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

/** "2027-03-14" + "10:00" (Астана) -> ISO ("2027-03-14T10:00:00+05:00"). */
export function fromAstanaParts(date: string, time: string): string | null {
  if (!date || !time) return null;
  return `${date}T${time}:00+05:00`;
}

const MONTHS_KK = [
  "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
  "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
];
const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** "14 наурыз, 10:00" / "14 марта, 10:00" — Астана уақытымен. */
export function formatAstana(iso: string | null | undefined, lang: "kk" | "ru"): string {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + ASTANA_OFFSET_MS);
  const month = (lang === "kk" ? MONTHS_KK : MONTHS_RU)[d.getUTCMonth()];
  return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Тек сағат: "11:00". */
export function formatAstanaTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return toAstanaParts(iso).time;
}

/** Секунд -> "1:05:09" немесе "05:09". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
