import type { SubjectKey } from "@/lib/questions/subjects";

/**
 * Ұпай санау ережелері — БІР ЖЕРДЕ.
 *
 * Бұл сандар жылдан жылға өзгеруі мүмкін (шекті балл, сұрақ бағасы).
 * Өзгерту керек болса — тек осы файлды түзетеді, есептеу логикасына
 * тиіспейді. Кейін админ панельге шығаруға болады.
 *
 * Дереккөз: НИШ «Өркен» гранты шарттары — Математика 400 балдан 140,
 * Сандық сипаттамалар 300 балдан 120 (пайдаланушы берген ресми мәтін).
 */

// ---------------------------------------------------------------
// НИШ
// ---------------------------------------------------------------

export type NisSection = {
  key: string;
  label: string;
  /** questions кестесіндегі пән */
  subject: SubjectKey;
  /** Тілдер ішіндегі бөлік үшін сұрақ аралығы (басқаларда бүкіл пән) */
  from?: number;
  to?: number;
  maxScore: number;
  /** Шекті балл — төмен болса қызыл. null = шек жоқ. */
  threshold: number | null;
};

export const NIS_SECTIONS: NisSection[] = [
  { key: "math", label: "Математика", subject: "math", maxScore: 400, threshold: 140 },
  { key: "sandyq", label: "Сандық сипаттамалар", subject: "sandyq", maxScore: 300, threshold: 120 },
  {
    key: "zharatylystanu",
    label: "Жаратылыстану",
    subject: "zharatylystanu",
    maxScore: 200,
    threshold: null,
  },
  {
    key: "tilder_kk",
    label: "Қазақ тілі",
    subject: "tilder",
    from: 1,
    to: 20,
    maxScore: 200,
    threshold: null,
  },
  {
    key: "tilder_ru",
    label: "Орыс тілі",
    subject: "tilder",
    from: 21,
    to: 40,
    maxScore: 200,
    threshold: null,
  },
  {
    key: "tilder_en",
    label: "Ағылшын тілі",
    subject: "tilder",
    from: 41,
    to: 60,
    maxScore: 200,
    threshold: null,
  },
];

/** Жалпы максимум: 400 + 300 + 200 × 4 = 1500 */
export const NIS_TOTAL_MAX = NIS_SECTIONS.reduce((s, x) => s + x.maxScore, 0);

/**
 * Тең ұпай жинағанда кім жоғары тұрады: алдымен жалпы сома, сосын осы
 * тәртіппен. Шындықта мұнда дейін жетпейді, бірақ тәртіп анық болуы керек.
 */
export const NIS_TIEBREAK_ORDER = ["math", "sandyq", "zharatylystanu"];

/**
 * Сұрақтың салмағы = 1 − дұрыс жауап бергендердің үлесі.
 * Қиын сұрақ қымбат, оңай сұрақ арзан.
 * Оқушының ұпайы = (дұрыс шешкен сұрақтардың салмағы / барлық салмақ) × максимум.
 *
 * Салмақ БАРЛЫҚ қатысушы бойынша есептеледі — онлайн да, офлайн да, төрт
 * нұсқа да бірге. Нұсқалар параллель (сұрақ типі бірдей, сандары ғана
 * басқа), сондықтан №5 сұрақ барлық нұсқада бір білікті тексереді.
 */
export const NIS_MIN_COHORT = 10;

// ---------------------------------------------------------------
// БИЛ — дұрыс +4, бос 0, қате −1
// ---------------------------------------------------------------

export const BIL_POINTS = { correct: 4, blank: 0, wrong: -1 };

/**
 * БИЛ — бір парақ, 60 сұрақ. Бөліну тек нәтижеде: 1–50 математика-логика,
 * 51–60 оқу сауаттылығы. Ресми БИЛ рейтингінде екеуінің ұпайы бөлек және
 * жалпы ұпай да көрсетіледі.
 */
export const BIL_SECTIONS = [
  { key: "bil_math", label: "Математика-логика", from: 1, to: 50 },
  { key: "bil_reading", label: "Оқу сауаттылығы", from: 51, to: 60 },
];

/** 60 × 4 = 240 */
export const BIL_MAX = 60 * BIL_POINTS.correct;

// ---------------------------------------------------------------
// РФМШ — 1–10 сұрақ 3 ұпай, 11–20 сұрақ 5 ұпай, 21–30 сұрақ 7 ұпай
// ---------------------------------------------------------------

export const RFMSH_BANDS = [
  { from: 1, to: 10, points: 3 },
  { from: 11, to: 20, points: 5 },
  { from: 21, to: 30, points: 7 },
];

/** 10×3 + 10×5 + 10×7 = 150 */
export const RFMSH_MAX = RFMSH_BANDS.reduce((s, b) => s + (b.to - b.from + 1) * b.points, 0);

export function rfmshPointsFor(questionNumber: number): number {
  const band = RFMSH_BANDS.find((b) => questionNumber >= b.from && questionNumber <= b.to);
  return band?.points ?? 0;
}
