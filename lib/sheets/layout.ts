import type { SubjectKey } from "@/lib/questions/subjects";

/**
 * Жауап парақтарының өлшемдері — миллиметрмен, парақтың СОЛ ЖАҚ ЖОҒАРҒЫ
 * бұрышынан.
 *
 * Парақ төрт түрлі: НИШ (математика + сандық + жаратылыстану), НИШ Тілдер,
 * БИЛ және РФМШ. Бәрінде екі нәрсе БІР ЖЕРДЕ тұрады:
 *
 *   • бұрыштағы төрт үлкен қара белгі;
 *   • жоғарғы жолақтағы код (28 шаршы).
 *
 * Сондықтан машина алдымен белгілерді табады, кодты оқиды, кодтан парақтың
 * түрін біледі — содан кейін ғана дөңгелектерді қай жерден іздеу керегін
 * таниды.
 *
 * Сандар қайдан алынған. НИШ пен Тілдер — түпнұсқа PDF-тен: әр дөңгелектің
 * ортасы 600 dpi-да өлшенді. БИЛ мен РФМШ парағын біз өзіміз салдық, сандар
 * — сол салған бағдарламадан. Парақ пен оқушы бір сандармен жұмыс істейді:
 * қайсысы өзгерсе, екіншісі де өзгеру керек (public/sheets ішіндегі PDF-тер).
 */

export type SheetKind = "nis" | "tilder" | "bil" | "rfmsh";

export interface Spot { x: number; y: number }

/** Кодтағы түрдің нөмірі. Өзгертуге болмайды — басылған парақтар оқылмай қалады. */
export const KIND_NUMBER: Record<SheetKind, number> = { nis: 0, tilder: 1, bil: 2, rfmsh: 3 };
export const KIND_BY_NUMBER: SheetKind[] = ["nis", "tilder", "bil", "rfmsh"];

export const KIND_LABEL: Record<SheetKind, string> = {
  nis: "НИШ (Мат · Сандық · Жаратылыстану)",
  tilder: "НИШ Тілдер",
  bil: "БИЛ",
  rfmsh: "РФМШ",
};

/** A4 */
export const PAGE = { width: 210, height: 297 };

/** Бұрыштағы үлкен белгілер: ортасы. Тәртібі: сол-жоғары, оң-жоғары, оң-төмен, сол-төмен. */
export const CORNER_SIZE = 6.43;
export function cornerSpots(): [Spot, Spot, Spot, Spot] {
  return [
    { x: 11.18, y: 11.18 }, { x: 198.8, y: 11.18 },
    { x: 198.8, y: 287.87 }, { x: 11.18, y: 287.87 },
  ];
}

/** Код жолағы: 28 шаршы. */
export const STRIP = { left: 62.0, top: 11.5, w: 2.4, h: 4.5, step: 3.0, count: 28 };

export function stripSpots(): Spot[] {
  return Array.from({ length: STRIP.count }, (_, i) => ({
    x: STRIP.left + i * STRIP.step + STRIP.w / 2,
    y: STRIP.top + STRIP.h / 2,
  }));
}

/** Жолақтың өз төрт белгісі: сол-жоғары, оң-жоғары, оң-төмен, сол-төмен. */
export function stripMarkSpots(): [Spot, Spot, Spot, Spot] {
  const right = STRIP.left + (STRIP.count - 1) * STRIP.step + STRIP.w;
  const above = STRIP.top - 3.0;
  const below = STRIP.top + STRIP.h + 3.0;
  return [
    { x: STRIP.left - 4.5, y: above }, { x: right + 4.5, y: above },
    { x: right + 4.5, y: below }, { x: STRIP.left - 4.5, y: below },
  ];
}

/** Ұсақ белгілердің өлшемі (жолақтағы да, тор маңындағы да). */
export const SMALL_MARK = 3.0;

export interface Bubble {
  subject: SubjectKey;
  /** Пәннің ішіндегі сұрақ нөмірі, 1-ден. */
  question: number;
  /** 0 — A … 3 — D */
  letter: number;
  x: number;
  y: number;
  /** Тордың бағаны (дөңгелектер тобы) және сол бағандағы жол. */
  col: number;
  row: number;
}

export interface Layout {
  kind: SheetKind;
  /** Тор маңындағы ұсақ белгілер: x-тер мен y-тер (тор түрінде тұр). */
  marksX: number[];
  marksY: number[];
  /** Дөңгелектің өлшемі, мм. */
  oval: { w: number; h: number };
  bubbles: Bubble[];
  /** Бағандағы жол саны (подтяжка үшін). */
  rowsInCol: number[];
  /**
   * Қай арнамен оқу керек. «red» — БИЛ: парақ қызғылт, ал қызыл арнада
   * қызғылт баспа ағарып кетеді де, тек баланың көк/қара сиясы қалады.
   */
  channel: "neutral" | "red";
  /** Парақтан жазылатын пәндер. */
  subjects: SubjectKey[];
  /** Әр пәнде қанша сұрақ. */
  count: Partial<Record<SubjectKey, number>>;
}

// ---- НИШ: түпнұсқадан өлшенген ----
const NIS_X = [
  22.331, 27.665, 33.041, 38.375, 52.345, 57.679, 63.055, 68.389,
  82.359, 87.736, 93.07, 98.404, 112.374, 117.75, 123.084, 128.418,
  142.388, 147.765, 153.099, 158.432, 172.403, 177.779, 183.155, 188.489,
];
const NIS_Y = [
  160.499, 166.362, 172.373, 178.385, 184.396, 190.428, 196.397, 202.409, 208.399, 214.431,
  220.506, 226.518, 232.487, 238.54, 244.509, 250.52, 256.553, 262.543, 268.533, 274.587,
];

// ---- Тілдер: түпнұсқадан өлшенген (белгілері НИШ-пен теңестірілгеннен кейін) ----
const TIL_X = [
  31.284, 40.746, 50.207, 59.648, 93.938, 103.399, 112.861, 122.301,
  152.527, 162.01, 171.45, 180.89,
];
const TIL_Y = [
  159.652, 165.494, 171.59, 177.686, 183.782, 189.963, 195.932, 202.07, 208.124, 214.22,
  220.316, 226.412, 232.486, 238.582, 244.678, 250.753, 256.849, 262.945, 268.999, 275.137,
];

// ---- БИЛ: өзіміз салған парақ ----
const BIL = {
  col1X: [139.4, 144.0, 148.6, 153.2], col1Y: 90.105,
  col2X: [175.95, 180.55, 185.15, 189.75], col2Y: 121.105,
  step: 3.81,
};

function nis(): Layout {
  const bubbles: Bubble[] = [];
  for (let col = 0; col < 6; col++) {
    const subject: SubjectKey = col < 2 ? "math" : col < 5 ? "sandyq" : "zharatylystanu";
    const first = col < 2 ? col * 20 : col < 5 ? (col - 2) * 20 : 0;
    for (let row = 0; row < 20; row++) {
      for (let letter = 0; letter < 4; letter++) {
        bubbles.push({
          subject, question: first + row + 1, letter,
          x: NIS_X[col * 4 + letter], y: NIS_Y[row], col, row,
        });
      }
    }
  }
  return {
    kind: "nis",
    marksX: [8, 73.91, 163.96, 202], marksY: [160, 217, 275],
    oval: { w: 3.02, h: 1.76 },
    bubbles, rowsInCol: [20, 20, 20, 20, 20, 20], channel: "neutral",
    subjects: ["math", "sandyq", "zharatylystanu"],
    count: { math: 40, sandyq: 60, zharatylystanu: 20 },
  };
}

function tilder(): Layout {
  const bubbles: Bubble[] = [];
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 20; row++) {
      for (let letter = 0; letter < 4; letter++) {
        bubbles.push({
          subject: "tilder", question: col * 20 + row + 1, letter,
          x: TIL_X[col * 4 + letter], y: TIL_Y[row], col, row,
        });
      }
    }
  }
  return {
    kind: "tilder",
    marksX: [8, 71.71, 132.33, 202], marksY: [160, 217, 275],
    oval: { w: 3.02, h: 1.76 },
    bubbles, rowsInCol: [20, 20, 20], channel: "neutral",
    subjects: ["tilder"], count: { tilder: 60 },
  };
}

function bil(): Layout {
  const bubbles: Bubble[] = [];
  for (let row = 0; row < 50; row++) {
    for (let letter = 0; letter < 4; letter++) {
      bubbles.push({
        subject: "bil", question: row + 1, letter,
        x: BIL.col1X[letter], y: BIL.col1Y + row * BIL.step, col: 0, row,
      });
    }
  }
  for (let row = 0; row < 10; row++) {
    for (let letter = 0; letter < 4; letter++) {
      bubbles.push({
        subject: "bil", question: 51 + row, letter,
        x: BIL.col2X[letter], y: BIL.col2Y + row * BIL.step, col: 1, row,
      });
    }
  }
  return {
    kind: "bil",
    marksX: [125.9, 163.45, 202], marksY: [91, 180, 272],
    oval: { w: 3.3, h: 3.3 },
    bubbles, rowsInCol: [50, 10], channel: "red",
    subjects: ["bil"], count: { bil: 60 },
  };
}

const CACHE = new Map<SheetKind, Layout>();

/** РФМШ үшін null: онда дөңгелек жоқ, сан жазылады (кейін қосылады). */
export function layoutOf(kind: SheetKind): Layout | null {
  if (kind === "rfmsh") return null;
  let one = CACHE.get(kind);
  if (!one) {
    one = kind === "nis" ? nis() : kind === "tilder" ? tilder() : bil();
    CACHE.set(kind, one);
  }
  return one;
}

/** Тест түрі бойынша қандай парақтар басылады. */
export function kindsForTestType(code: string | null | undefined): SheetKind[] {
  if (code === "NIS") return ["nis", "tilder"];
  if (code === "BIL") return ["bil"];
  if (code === "RFMS") return ["rfmsh"];
  return [];
}
