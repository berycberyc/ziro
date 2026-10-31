/**
 * РФМШ парағын оқу: әр жолда 7 разрядтық сан.
 *
 * Цифр алты нүкте арасындағы жеті сызықпен жазылады. Машина цифрды
 * «танымайды» — әр сызық үшін «осы жерде сия бар ма» деп сұрайды. Жеті
 * жауап — бір цифр, жеті цифр — сан.
 *
 * Балалар цифрды нүктелерден үлкенірек жазады, сызық нүктеден сәл
 * ауытқиды. Сондықтан әр сызық бойында бірнеше жерден өлшенеді, әр
 * жерде көлденеңінен біраз аумақ қаралады да, ең қараңғысы алынады.
 * Аумақ ұяшықтың шекарасына жетпейтіндей таңдалған.
 *
 * Машина сенімсіз болған жол «күмәнді» болады — админ суретке қарап,
 * санды өзі жазады.
 */

import {
  findSmall, paperAt, placeInCells,
  type Cells, type Grey, type Paper,
} from "./read";
import { DIGIT_SEGMENTS, SEGMENTS, type RfmshGeometry, type Spot } from "./layout";

export interface RfmshAnswer {
  question: number;
  /** Оқылған сан ("" — бос). Күмәнді болса — машинаның болжамы. */
  value: string;
  unsure: boolean;
  /** Жолдың суреттегі орны (нүктемен) — түзету экранында қию үшін. */
  box: { x: number; y: number; w: number; h: number };
}

/** Сия картасы: 0 — қағаз, 1 — толық қара; 3×3 тегістелген. */
function inkMap(grey: Grey, paper: Paper): Float32Array {
  const { width, height, data } = grey;
  const raw = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const here = Math.max(1, paperAt(paper, x, y));
      raw[y * width + x] = Math.max(0, here - data[y * width + x]) / here;
    }
  }
  const out = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += raw[(y + dy) * width + x + dx];
      out[y * width + x] = sum / 9;
    }
  }
  return out;
}

function inkAt(ink: Float32Array, grey: Grey, x: number, y: number): number {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= grey.width || yi >= grey.height) return 0;
  return ink[yi * grey.width + xi];
}

/** Сегменттің ұзына бойындағы өлшемдер: ортасына жақын 7 нүкте. */
const ALONG = [0.25, 0.33, 0.42, 0.5, 0.58, 0.67, 0.75];

/**
 * Бір сегменттегі сия. Әр нүктеде перпендикуляр бойымен [−perp[0] … +perp[1]]
 * мм аумақтың ең қараңғысы, содан кейін — орташасы. Перпендикуляр a→b
 * бағытынан сағат тіліне қарсы 90° бұрылған (жоғарғы сегментте — төмен,
 * яғни ұяшықтың ішіне).
 */
function segmentInk(
  ink: Float32Array, grey: Grey, a: Spot, b: Spot, perpMm: [number, number], perMm: number,
): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  // Перпендикуляр бағыты: + ұяшықтың сыртына қарай (кейін таңбасы беріледі).
  const nx = -dy / len, ny = dx / len;
  const from = -perpMm[0] * perMm, to = perpMm[1] * perMm;
  let total = 0;
  for (const t of ALONG) {
    const cx = a.x + dx * t, cy = a.y + dy * t;
    let best = 0;
    for (let s = from; s <= to; s += 0.6) best = Math.max(best, inkAt(ink, grey, cx + nx * s, cy + ny * s));
    total += best;
  }
  return total / ALONG.length;
}

function digitOf(lit: boolean[]): { digit: number | null; sure: boolean } {
  const on = lit.map((v, k) => (v ? k : -1)).filter((k) => k >= 0);
  if (on.length === 0) return { digit: null, sure: true };
  // Бір санын балалар оң жаққа да, сол жаққа да жазады.
  if (on.length === 2 && on[0] === 1 && on[1] === 4) return { digit: 1, sure: true };
  let best = -1, bestDiff = 99;
  DIGIT_SEGMENTS.forEach((segs, d) => {
    let diff = 0;
    for (let k = 0; k < 7; k++) if (lit[k] !== segs.includes(k)) diff++;
    if (diff < bestDiff) { bestDiff = diff; best = d; }
  });
  if (bestDiff === 0) return { digit: best, sure: true };
  if (bestDiff === 1) return { digit: best, sure: false };
  return { digit: null, sure: false };
}

/** Сызылған деп санау шегі (сол парақтағы бос сызықтардан жоғары). */
const LIT_MIN = 0.08;
const LIT_ABOVE = 0.07;

export function readRfmshGrid(
  grey: Grey, paper: Paper, rough: number[], geom: RfmshGeometry, base: Grey, basePaper: Paper,
  debug?: { nodes?: Spot[]; scores?: number[][][]; limit?: number; marks?: (Spot | null)[] },
): RfmshAnswer[] {
  // 1. Жол белгілері бойынша жергілікті түзету.
  const planned: Spot[] = [];
  for (const y of geom.rowMarksY) for (const x of geom.rowMarksX) planned.push({ x, y });
  const found = findSmall(base, basePaper, rough, planned, 3);
  const cells: Cells = { xs: geom.rowMarksX, ys: geom.rowMarksY, planned, found, rough };
  const put0 = (s: Spot) => placeInCells(cells, s);

  const a0 = put0({ x: 50, y: 150 }), a1 = put0({ x: 60, y: 150 });
  const perMm = Math.max(1, Math.hypot(a1.x - a0.x, a1.y - a0.y) / 10);
  const ink = inkMap(grey, paper);

  // 2. Әр жолды басылған нүктелердің өзі бойынша түзету: жолдағы 42 нүктенің
  //    медианалық ығысуы (балалардың сызығы бірнешеуін бұрса да, медиана тұрақты).
  const reach = Math.round(0.9 * perMm);
  const rowShift = new Map<number, Spot>();
  for (let q = 1; q <= geom.questions; q++) {
    const xs: number[] = [], ys: number[] = [];
    for (let d = 0; d < geom.digits; d++) {
      for (const node of geom.nodes(q, d)) {
        const want = put0(node);
        let best = 0, bx = 0, by = 0;
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            const v = inkAt(ink, grey, want.x + dx, want.y + dy);
            if (v > best) { best = v; bx = dx; by = dy; }
          }
        }
        if (best > 0.15) { xs.push(bx); ys.push(by); }
      }
    }
    if (xs.length >= 10) {
      const mid = (l: number[]) => [...l].sort((p, r) => p - r)[Math.floor(l.length / 2)];
      rowShift.set(q, { x: mid(xs), y: mid(ys) });
    }
  }
  const putQ = (q: number, s: Spot) => {
    const p = put0(s);
    const sh = rowShift.get(q);
    return sh ? { x: p.x + sh.x, y: p.y + sh.y } : p;
  };

  // 3. Сегменттер.
  //    Көлденең сызықтарда сыртқа қарай аз (ұяшық шекарасы жақын), ішке көп.
  const gap = geom.edgeGap;
  const outer = Math.min(0.45, Math.max(0.2, gap - 0.9));
  const perp: [number, number][] = [
    [outer, 1.4], // жоғарғы: сыртқа (жоғары) шекараға жетпей, ішке (төмен) 1,4
    [1.6, 1.6], [1.6, 1.6],
    [1.3, 1.3],
    [1.6, 1.6], [1.6, 1.6],
    [outer, 1.4], // төменгі (ұштары ауыстырылған: перпендикуляр жоғары, ішке)
  ];
  const scores: number[][][] = [];
  for (let q = 1; q <= geom.questions; q++) {
    const row: number[][] = [];
    for (let d = 0; d < geom.digits; d++) {
      const n = geom.nodes(q, d).map((s) => putQ(q, s));
      row.push(SEGMENTS.map(([i, j], k) => {
        // Жоғарғы сегментте «сырт» — жоғары, төменгіде — төмен. Сол үшін
        // төменгі сегменттің ұштарын ауыстырамыз (перпендикуляр бағыты өзгереді).
        const [a, b] = k === 6 ? [n[j], n[i]] : [n[i], n[j]];
        return segmentInk(ink, grey, a, b, perp[k], perMm);
      }));
    }
    scores.push(row);
  }

  // 4. Шек — парақтың өзінен: сызықтардың басым көпшілігі бос.
  const all = scores.flat(2).sort((p, r) => p - r);
  const baseline = all[Math.floor(all.length * 0.5)] ?? 0;
  const limit = Math.max(LIT_MIN, baseline + LIT_ABOVE);
  if (debug) {
    debug.scores = scores; debug.limit = limit; debug.marks = found;
    debug.nodes = [];
    for (let q = 1; q <= geom.questions; q++) for (let d = 0; d < geom.digits; d++) debug.nodes.push(...geom.nodes(q, d).map((s) => putQ(q, s)));
  }

  return scores.map((row, qi) => {
    const q = qi + 1;
    const digits = row.map((segs) => digitOf(segs.map((v) => v >= limit)));
    let unsure = digits.some((d) => !d.sure);
    const firstAt = digits.findIndex((d) => d.digit !== null);
    let lastAt = -1;
    digits.forEach((d, k) => { if (d.digit !== null) lastAt = k; });
    // Ортасында бос разряд — «4_2» 42 емес: күмәнді.
    for (let k = firstAt; k >= 0 && k <= lastAt; k++) if (digits[k].digit === null) unsure = true;
    let value = digits.filter((d) => d.digit !== null).map((d) => String(d.digit)).join("");
    if (value.length > 1) value = value.replace(/^0+(?=\d)/, "");
    const b = geom.rowBox(q);
    const tl = putQ(q, { x: b.left, y: b.top }), br = putQ(q, { x: b.right, y: b.bottom });
    return { question: q, value, unsure, box: { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y } };
  });
}
