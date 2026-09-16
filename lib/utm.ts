/**
 * UTM белгілерін браузерде сақтау.
 *
 * Ата-ана сайтқа жарнама сілтемесімен кірсе, белгі 30 күн сақталады.
 * Сол уақыт ішінде тіркелсе (тіпті бірнеше күннен кейін), белгі оның
 * профиліне жазылады. Жаңа сілтемемен қайта кірсе — соңғысы есептеледі.
 */

const STORAGE_KEY = "ziro-utm";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type Utm = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

function clean(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim().slice(0, 100);
  return s || null;
}

/** Беттің адресінен белгіні оқып, болса сақтайды. */
export function captureUtmFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Utm = {
      utm_source: clean(params.get("utm_source")),
      utm_medium: clean(params.get("utm_medium")),
      utm_campaign: clean(params.get("utm_campaign")),
    };
    if (!utm.utm_source && !utm.utm_campaign) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...utm, savedAt: Date.now() }));
  } catch {
    // localStorage жабық болуы мүмкін (жасырын режим) — белгісіз жалғастырамыз.
  }
}

/** Сақталған белгі (30 күннен ескі болса — жоқ). */
export function readSavedUtm(): Utm | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      utm_source: parsed.utm_source ?? null,
      utm_medium: parsed.utm_medium ?? null,
      utm_campaign: parsed.utm_campaign ?? null,
    };
  } catch {
    return null;
  }
}
