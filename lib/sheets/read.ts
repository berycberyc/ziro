/**
 * Жауап парағын суреттен оқу.
 *
 * Оқу телефонда жүреді, серверде емес: суреттер көп, әрқайсысы бірнеше
 * мегабайт, оларды ары-бері жіберудің қажеті жоқ.
 *
 * Әдіс matemica2 жобасынан алынды — онда НИШ парағы тірі суреттерде
 * тексерілген. Мұнда ол төрт түрлі параққа жалпыланды.
 *
 * ҚАЛАЙ ЖҰМЫС ІСТЕЙДІ
 *
 *   1. Суреттің әр жеріндегі қағаздың ақтығы бөлек есептеледі (көлеңке
 *      болса да, қағаз бен сияны шатастырмау үшін).
 *   2. Бұрыштағы төрт үлкен қара белгі табылады.
 *   3. Олар арқылы «парақтың миллиметрі → суреттің нүктесі» аудармасы
 *      құрылады (камера қисық ұстаса да).
 *   4. Жоғарғы жолақтағы код оқылады: парақтың түрі, нұсқа, оқушы.
 *   5. Түріне қарап, дөңгелектер қай жерде тұрғаны белгілі болады. Тор
 *      маңындағы ұсақ белгілер бойынша аударма жергілікті түзетіледі
 *      (қағаз үстелде толқынданып жатады).
 *   6. Әр дөңгелектің ішіндегі сия мөлшері өлшенеді.
 *
 * МАШИНА НЕНІ ШЕШПЕЙДІ
 *
 * Екі дөңгелек боялған немесе әлсіз боялған жолды өзі шешпейді — «күмәнді»
 * деп белгілейді, оны админ көзімен қарайды. Бос жол күмәнді емес: бала
 * жауап бермеуге құқылы.
 */

import { decodeSheetCode, type SheetCode } from "./code";
import {
  cornerSpots, layoutOf, SMALL_MARK, STRIP, stripMarkSpots, stripSpots,
  rfmshGeometry, type Bubble, type Layout, type RfmshGeometry, type SheetKind, type Spot,
} from "./layout";
import { readRfmshGrid, type RfmshAnswer } from "./rfmsh";
import type { SubjectKey } from "@/lib/questions/subjects";

/** Сұр сурет: 0 — қара, 255 — ақ. */
export interface Grey {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Paper {
  block: number;
  columns: number;
  rows: number;
  level: Float32Array;
}

/** Нүкте қағаздан қаншалықты қараңғы болса сия деп саналады. */
const INK = 0.72;

/**
 * Нүктенің қараңғылығы (0 — қара, 255 — ақ).
 *
 * Жай жарықтық емес: ашық көк гель қалам жарықтығы бойынша қағазға жақын
 * шығады да, баланың белгісі жоғалады. Сондықтан жарықтықтан ТҮСТІЛІК
 * алынады: қағаз бен көлеңкеде үш түс шамамен тең, ал кез келген сияда
 * қатты ажырайды. Қара баспаға бұл әсер етпейді.
 */
export function inkLevel(r: number, g: number, b: number): number {
  const bright = 0.299 * r + 0.587 * g + 0.114 * b;
  const colour = Math.max(r, g, b) - Math.min(r, g, b);
  return Math.max(0, Math.round(bright - colour));
}

/**
 * Суреттің екі сұр нұсқасы.
 *
 *   neutral — жоғарыдағы ереже бойынша (НИШ, Тілдер, белгілер, код);
 *   red     — тек қызыл арна (БИЛ). Қызғылт баспа қызыл арнада ақ болып
 *             кетеді, ал көк пен қара сия қараңғы күйінде қалады.
 */
export function greysFromRgba(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number) {
  const neutral = new Uint8Array(width * height);
  const red = new Uint8Array(width * height);
  for (let at = 0; at < neutral.length; at++) {
    const r = rgba[at * 4], g = rgba[at * 4 + 1], b = rgba[at * 4 + 2];
    neutral[at] = inkLevel(r, g, b);
    red[at] = r;
  }
  return {
    neutral: { width, height, data: neutral } as Grey,
    red: { width, height, data: red } as Grey,
  };
}

/** Қағаздың ақтығы торкөздер бойынша: әр жердің өз «ағы». */
export function paperOf(grey: Grey): Paper {
  // Торкөз белгіден едәуір үлкен: толығымен қара шаршымен жабылған торкөз
  // «қағаз қара» деп шешіп қоймауы үшін.
  const block = Math.max(24, Math.round(grey.width / 14));
  const columns = Math.max(1, Math.ceil(grey.width / block));
  const rows = Math.max(1, Math.ceil(grey.height / block));
  const level = new Float32Array(columns * rows);
  const counts = new Uint32Array(256);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      counts.fill(0);
      let seen = 0;
      const fromY = row * block, toY = Math.min(grey.height, fromY + block);
      const fromX = column * block, toX = Math.min(grey.width, fromX + block);
      for (let y = fromY; y < toY; y++) {
        for (let x = fromX; x < toX; x++) {
          counts[grey.data[y * grey.width + x]] += 1;
          seen++;
        }
      }
      // Ең ақ нүктелер — жылтыр; соларға теңелуге болмайды.
      const want = Math.max(1, Math.round((seen * 6) / 7));
      let running = 0, value = 255;
      for (let at = 0; at < 256; at++) {
        running += counts[at];
        if (running >= want) { value = at; break; }
      }
      level[row * columns + column] = Math.max(20, value);
    }
  }
  return { block, columns, rows, level };
}

export function paperAt(paper: Paper, x: number, y: number): number {
  const { block, columns, rows, level } = paper;
  const fx = Math.min(columns - 1, Math.max(0, x / block - 0.5));
  const fy = Math.min(rows - 1, Math.max(0, y / block - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(columns - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1);
  const tx = fx - x0, ty = fy - y0;
  const top = level[y0 * columns + x0] * (1 - tx) + level[y0 * columns + x1] * tx;
  const bottom = level[y1 * columns + x0] * (1 - tx) + level[y1 * columns + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

export function darkMap(grey: Grey, paper: Paper): Uint8Array {
  const { width, height, data } = grey;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * width + x;
      out[at] = data[at] < paperAt(paper, x, y) * INK ? 1 : 0;
    }
  }
  return out;
}

interface Blob {
  size: number;
  left: number; right: number; top: number; bottom: number;
  x: number; y: number;
}

/** Қараңғы дақтар. Рекурсиясыз — үлкен дақта стек толып кетпеуі үшін. */
function blobs(grey: Grey, dark: Uint8Array, least: number, most: number): Blob[] {
  const { width, height } = grey;
  const seen = new Uint8Array(width * height);
  const out: Blob[] = [];
  const queue = new Int32Array(width * height);
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || !dark[start]) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    let size = 0, sumX = 0, sumY = 0;
    let left = width, right = 0, top = height, bottom = 0;
    let tooBig = false;
    while (head < tail) {
      const at = queue[head++];
      const x = at % width, y = (at - x) / width;
      size++; sumX += x; sumY += y;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (size > most) tooBig = true;
      if (x > 0 && !seen[at - 1] && dark[at - 1]) { seen[at - 1] = 1; queue[tail++] = at - 1; }
      if (x + 1 < width && !seen[at + 1] && dark[at + 1]) { seen[at + 1] = 1; queue[tail++] = at + 1; }
      if (y > 0 && !seen[at - width] && dark[at - width]) { seen[at - width] = 1; queue[tail++] = at - width; }
      if (y + 1 < height && !seen[at + width] && dark[at + width]) { seen[at + width] = 1; queue[tail++] = at + width; }
    }
    if (!tooBig && size >= least) {
      out.push({ size, left, right, top, bottom, x: sumX / size, y: sumY / size });
    }
  }
  return out;
}

/**
 * Бұрыштағы төрт белгі: сол-жоғары, оң-жоғары, оң-төмен, сол-төмен.
 *
 * Белгі орнымен емес, түрімен танылады: шаршыға жақын және толық боялған.
 * Сонда оны боялған дөңгелекпен (ол кішірек), үстелдің шетімен (ол ұзын)
 * немесе көлеңкемен (ол борпылдақ) шатастырмайды.
 */
export function findCorners(grey: Grey, dark?: Uint8Array): [Spot, Spot, Spot, Spot] | null {
  const darkness = dark ?? darkMap(grey, paperOf(grey));
  // Ұсақ белгілер (3 мм) үлкен белгі (6,4 мм) болып кетпеуі үшін төменгі шек.
  const side = grey.width / 50;
  const least = Math.max(9, Math.round(side * side));
  const most = Math.round((grey.width / 4) ** 2);

  const square = blobs(grey, darkness, least, most).filter((one) => {
    const wide = one.right - one.left + 1;
    const tall = one.bottom - one.top + 1;
    if (wide < 3 || tall < 3) return false;
    const ratio = wide / tall;
    if (ratio < 0.6 || ratio > 1.7) return false;
    return one.size / (wide * tall) > 0.8;
  });
  if (square.length < 4) return null;

  const corners: Spot[] = [
    { x: 0, y: 0 }, { x: grey.width, y: 0 },
    { x: grey.width, y: grey.height }, { x: 0, y: grey.height },
  ];
  const found: Blob[] = [];
  const taken = new Set<number>();
  for (const corner of corners) {
    let bestAt = -1, bestFar = Infinity;
    square.forEach((one, at) => {
      if (taken.has(at)) return;
      const far = (one.x - corner.x) ** 2 + (one.y - corner.y) ** 2;
      if (far < bestFar) { bestFar = far; bestAt = at; }
    });
    if (bestAt < 0) return null;
    taken.add(bestAt);
    found.push(square[bestAt]);
  }

  // Бұл шынымен біздің парақ па — тексеру. Әйтпесе кездейсоқ төрт дақтан
  // мағынасыз аударма шығып, дөңгелек жоқ жерден ізделер еді.
  const [tl, tr, br, bl] = found;
  if (!(tl.x < tr.x && bl.x < br.x && tl.y < bl.y && tr.y < br.y)) return null;
  const sizes = found.map((one) => one.size);
  if (Math.max(...sizes) > 4 * Math.min(...sizes)) return null;
  const area = Math.abs((tr.x - tl.x) * (bl.y - tl.y) - (bl.x - tl.x) * (tr.y - tl.y));
  if (area < 0.2 * grey.width * grey.height) return null;

  return [
    { x: tl.x, y: tl.y }, { x: tr.x, y: tr.y },
    { x: br.x, y: br.y }, { x: bl.x, y: bl.y },
  ];
}

/** Төрт жұп нүкте бойынша аударма (гомография). */
export function mapping(from: Spot[], to: Spot[]): number[] | null {
  if (from.length !== 4 || to.length !== 4) return null;
  const rows: number[][] = [];
  for (let at = 0; at < 4; at++) {
    const f = from[at], t = to[at];
    rows.push([f.x, f.y, 1, 0, 0, 0, -f.x * t.x, -f.y * t.x, t.x]);
    rows.push([0, 0, 0, f.x, f.y, 1, -f.x * t.y, -f.y * t.y, t.y]);
  }
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-9) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const head = rows[column];
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const times = rows[row][column] / head[column];
      if (times === 0) continue;
      for (let at = column; at < 9; at++) rows[row][at] -= times * head[at];
    }
  }
  const out: number[] = [];
  for (let at = 0; at < 8; at++) out.push(rows[at][8] / rows[at][at]);
  out.push(1);
  return out;
}

export function place(map: number[], spot: Spot): Spot {
  const [a, b, c, d, e, f, g, h] = map;
  const bottom = g * spot.x + h * spot.y + 1;
  return { x: (a * spot.x + b * spot.y + c) / bottom, y: (d * spot.x + e * spot.y + f) / bottom };
}

/** Парақтың 1 мм-і суретте шамамен неше нүкте. */
function pointsPerMm(rough: number[]): number {
  const a = place(rough, { x: 20, y: 20 });
  const b = place(rough, { x: 30, y: 20 });
  return Math.max(1, Math.hypot(b.x - a.x, b.y - a.y) / 10);
}

/**
 * Ұсақ белгілерді «салмағы» бойынша іздеу.
 *
 * Пішіні бойынша емес: секторлар арасындағы сызықтың үстінде тұрған белгі
 * сызыққа жабысып, шаршы болудан қалады. Сондықтан белгі өлшеміндей терезе
 * күтілген жердің айналасында жылжиды да, сия ең көп жиналған орын алынады.
 */
export function findSmall(grey: Grey, paper: Paper, rough: number[], planned: Spot[], reachMm: number): (Spot | null)[] {
  const perMm = pointsPerMm(rough);
  const side = Math.max(3, Math.round(SMALL_MARK * perMm));
  const half = Math.floor(side / 2);
  const around = Math.round(perMm * reachMm);
  return planned.map((spot) => {
    const want = place(rough, spot);
    let best: Spot | null = null;
    let most = 0;
    for (let dy = -around; dy <= around; dy++) {
      for (let dx = -around; dx <= around; dx++) {
        const cx = Math.round(want.x + dx), cy = Math.round(want.y + dy);
        let ink = 0;
        for (let y = cy - half; y <= cy + half; y++) {
          for (let x = cx - half; x <= cx + half; x++) {
            if (x < 0 || y < 0 || x >= grey.width || y >= grey.height) continue;
            const here = Math.max(1, paperAt(paper, x, y));
            ink += Math.max(0, here - grey.data[y * grey.width + x]) / here;
          }
        }
        if (ink > most) { most = ink; best = { x: cx, y: cy }; }
      }
    }
    // Белгі толық боялған: терезедегі сия нүктелер санына жақын болуы керек.
    return most > side * side * 0.55 ? best : null;
  });
}

/** Тор маңындағы белгілер бойынша бөліктеп түзету. */
export interface Cells {
  xs: number[];
  ys: number[];
  planned: Spot[];
  found: (Spot | null)[];
  rough: number[];
  tune?: Map<string, Spot>;
  tuneKeyOf?: (spot: Spot) => string | null;
}

export function placeInCells(cells: Cells, spot: Spot): Spot {
  const base = place(cells.rough, spot);
  const { xs, ys } = cells;
  let cx = 0;
  while (cx < xs.length - 2 && spot.x > xs[cx + 1]) cx++;
  let cy = 0;
  while (cy < ys.length - 2 && spot.y > ys[cy + 1]) cy++;
  const tx = (spot.x - xs[cx]) / (xs[cx + 1] - xs[cx]);
  const ty = (spot.y - ys[cy]) / (ys[cy + 1] - ys[cy]);

  const shiftAt = (ix: number, iy: number): Spot | null => {
    const at = iy * xs.length + ix;
    const found = cells.found[at];
    if (!found) return null;
    const want = place(cells.rough, cells.planned[at]);
    return { x: found.x - want.x, y: found.y - want.y };
  };
  const corners = [shiftAt(cx, cy), shiftAt(cx + 1, cy), shiftAt(cx, cy + 1), shiftAt(cx + 1, cy + 1)];
  let got = base;
  // Бір белгі табылмаса — жалпы аударма қалады: үш бұрышпен түзету торкөзді
  // қисайтып жіберер еді.
  if (corners.every(Boolean)) {
    const [a, b, c, d] = corners as Spot[];
    const top = { x: a.x * (1 - tx) + b.x * tx, y: a.y * (1 - tx) + b.y * tx };
    const bottom = { x: c.x * (1 - tx) + d.x * tx, y: c.y * (1 - tx) + d.y * tx };
    got = { x: base.x + top.x * (1 - ty) + bottom.x * ty, y: base.y + top.y * (1 - ty) + bottom.y * ty };
  }
  if (cells.tune && cells.tuneKeyOf) {
    const key = cells.tuneKeyOf(spot);
    const extra = key ? cells.tune.get(key) : undefined;
    if (extra) return { x: got.x + extra.x, y: got.y + extra.y };
  }
  return got;
}

const TUNE_BANDS = 4;
function tuneKey(bubble: Bubble, layout: Layout): string {
  const rows = layout.rowsInCol[bubble.col] ?? 20;
  const band = Math.min(TUNE_BANDS - 1, Math.floor((bubble.row / rows) * TUNE_BANDS));
  return `${bubble.col}|${band}`;
}

/**
 * Торды басылған дөңгелектердің өзі бойынша тартып түзету.
 *
 * Белгілер сирек, ал дөңгелектер жүздеп тұр және әрқайсысының орны дәл
 * белгілі. Орта дөңгелектің СЫРТҚЫ ШЕҢБЕРІ бойынша ізделеді: бояу ішінде
 * отырады да, шеңберге аз түседі — сондықтан балалар ортадан жоғары боясада,
 * тор олардың соңынан жылжымайды. Әр бөлікке бір ортақ (медианалық) түзету.
 *
 * БИЛ-де қолданылмайды: қызыл арнада қызғылт шеңбер көрінбейді.
 */
function tuneByOvals(grey: Grey, paper: Paper, cells: Cells, layout: Layout): Map<string, Spot> {
  const rxMm = layout.oval.w / 2, ryMm = layout.oval.h / 2;
  const found = new Map<string, Spot[]>();
  for (const bubble of layout.bubbles) {
    const middle = placeInCells(cells, bubble);
    const side = placeInCells(cells, { x: bubble.x + rxMm, y: bubble.y });
    const under = placeInCells(cells, { x: bubble.x, y: bubble.y + ryMm });
    const rx = Math.hypot(side.x - middle.x, side.y - middle.y);
    const ry = Math.hypot(under.x - middle.x, under.y - middle.y);
    if (rx < 1 || ry < 1 || rx > grey.width / 20) continue;
    let sumX = 0, sumY = 0, all = 0;
    for (let dy = -Math.ceil(ry * 1.3); dy <= Math.ceil(ry * 1.3); dy++) {
      for (let dx = -Math.ceil(rx * 1.3); dx <= Math.ceil(rx * 1.3); dx++) {
        const far = (dx / rx) ** 2 + (dy / ry) ** 2;
        if (far < 0.75 || far > 1.4) continue;
        const x = Math.round(middle.x + dx), y = Math.round(middle.y + dy);
        if (x < 0 || y < 0 || x >= grey.width || y >= grey.height) continue;
        const here = Math.max(1, paperAt(paper, x, y));
        const ink = Math.max(0, here - grey.data[y * grey.width + x]) / here;
        sumX += dx * ink; sumY += dy * ink; all += ink;
      }
    }
    if (all < 3) continue;
    const shift = { x: sumX / all, y: sumY / all };
    if (Math.abs(shift.x) > rx * 0.5 || Math.abs(shift.y) > ry * 0.7) continue;
    const key = tuneKey(bubble, layout);
    if (!found.has(key)) found.set(key, []);
    found.get(key)!.push(shift);
  }
  const middleOf = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  const out = new Map<string, Spot>();
  found.forEach((list, key) => {
    if (list.length < 5) return;
    out.set(key, { x: middleOf(list.map((one) => one.x)), y: middleOf(list.map((one) => one.y)) });
  });
  return out;
}

/** Эллипс ішіндегі сия мөлшері, 0…1. */
function darknessAt(
  grey: Grey, paper: Paper, put: (s: Spot) => Spot, centre: Spot, alongMm: number, downMm: number,
): number {
  const middle = put(centre);
  const side = put({ x: centre.x + alongMm, y: centre.y });
  const under = put({ x: centre.x, y: centre.y + downMm });
  const most = Math.max(2, grey.width / 20);
  const rx = Math.min(most, Math.max(1, Math.hypot(side.x - middle.x, side.y - middle.y)));
  const ry = Math.min(most, Math.max(1, Math.hypot(under.x - middle.x, under.y - middle.y)));
  let ink = 0, all = 0;
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      if ((dx / rx) ** 2 + (dy / ry) ** 2 > 1) continue;
      const x = Math.round(middle.x + dx), y = Math.round(middle.y + dy);
      if (x < 0 || y < 0 || x >= grey.width || y >= grey.height) continue;
      // Нүктелердің үлесі емес, СИЯНЫҢ МӨЛШЕРІ: балалар іштей жіңішке
      // құсбелгі қояды, үлес бойынша ол көрінбей қалады.
      const here = Math.max(1, paperAt(paper, x, y));
      ink += Math.max(0, here - grey.data[y * grey.width + x]) / here;
      all++;
    }
  }
  return all === 0 ? 0 : ink / all;
}

/** Осыдан төмен — боялмаған. */
const FILLED = 0.34;
/** Боялған дөңгелек келесісінен кемінде осынша қараңғы болуы керек. */
const APART = 0.16;
/** Боялған дөңгелек сол жолдың ең ашық дөңгелегінен кемінде осынша қараңғы. */
const ROW_GAP = 0.12;
/** Код шаршысы қара деп саналу үшін. */
const STRIP_FILLED = 0.5;

export interface OvalSpot {
  subject: SubjectKey;
  question: number;
  letter: number;
  /** Суреттегі ортасы мен жарты осьтері (нүктемен). */
  x: number; y: number; rx: number; ry: number;
  dark: number;
}

export interface RowAnswer {
  subject: SubjectKey;
  question: number;
  /** Боялған әріптер: [] — бос, [1] — B, [0,2] — екеуі боялған (қате саналады). */
  letters: number[];
  /** Машина сенімсіз: адам көзімен қарау керек. */
  doubtful: boolean;
}

export type SheetReading =
  | { status: "no_sheet" }
  | { status: "no_code"; corners: Spot[] }
  | { status: "rfmsh"; code: SheetCode; numbers: RfmshAnswer[]; width: number; height: number }
  | {
      status: "ok";
      code: SheetCode;
      answers: RowAnswer[];
      ovals: OvalSpot[];
      width: number;
      height: number;
      /** Тор белгілерінің қаншасы табылды — сапаны көрсету үшін. */
      marksFound: number;
      marksTotal: number;
    };

/** Жолақтағы кодты оқу. */
function readCode(grey: Grey, paper: Paper, rough: number[]): SheetCode | null {
  const planned = stripMarkSpots();
  const found = findSmall(grey, paper, rough, planned, 3);
  let put = (s: Spot) => place(rough, s);
  if (found.every(Boolean)) {
    const local = mapping(planned, found as Spot[]);
    if (local) put = (s: Spot) => place(local, s);
  }
  const r = STRIP.w * 0.3;
  const bits = stripSpots().map((spot) => darknessAt(grey, paper, put, spot, r, r) > STRIP_FILLED);
  return decodeSheetCode(bits);
}

/**
 * Парақты оқу.
 *
 * Біздің парақ емес немесе мүлде қисық түсірілсе — no_sheet; код оқылмаса —
 * no_code. Екеуінде де «қайта түсіріңіз»: болжап, бөтен жауап бергенше,
 * сұраған дұрыс.
 */
export function readSheet(
  greys: { neutral: Grey; red: Grey },
  /** Тек тексеру үшін: кодсыз ескі суретті белгілі түр/тор ретінде оқу. */
  test?: { forceKind?: SheetKind; rfmsh?: RfmshGeometry; debug?: any },
): SheetReading {
  const base = greys.neutral;
  const basePaper = paperOf(base);
  const corners = findCorners(base, darkMap(base, basePaper));
  if (!corners) return { status: "no_sheet" };
  const rough = mapping(test?.rfmsh?.corners ?? cornerSpots(), corners);
  if (!rough) return { status: "no_sheet" };

  const code = test?.forceKind
    ? { kind: test.forceKind, variant: 1, zipgradeId: "00000" }
    : readCode(base, basePaper, rough);
  if (!code) return { status: "no_code", corners };
  const layout = layoutOf(code.kind);
  if (!layout) {
    const numbers = readRfmshGrid(base, basePaper, rough, test?.rfmsh ?? rfmshGeometry(), base, basePaper, test?.debug);
    return { status: "rfmsh", code, numbers, width: base.width, height: base.height };
  }

  const grey = layout.channel === "red" ? greys.red : base;
  const paper = layout.channel === "red" ? paperOf(grey) : basePaper;

  // Тор белгілері қара — кез келген арнада көрінеді.
  const planned: Spot[] = [];
  for (const y of layout.marksY) for (const x of layout.marksX) planned.push({ x, y });
  const found = findSmall(base, basePaper, rough, planned, 4);
  const cells: Cells = { xs: layout.marksX, ys: layout.marksY, planned, found, rough };

  if (layout.channel === "neutral") {
    const byXY = new Map<string, Bubble>();
    layout.bubbles.forEach((b) => byXY.set(`${b.x}|${b.y}`, b));
    cells.tune = tuneByOvals(grey, paper, cells, layout);
    cells.tuneKeyOf = (spot) => {
      const b = byXY.get(`${spot.x}|${spot.y}`);
      return b ? tuneKey(b, layout) : null;
    };
  }
  const put = (s: Spot) => placeInCells(cells, s);

  // Өлшеуіш — дөңгелектің ішкі бөлігі: шеттегі баспа сызығы бос дөңгелекті
  // де қараңғылатады.
  const alongMm = (layout.oval.w / 2) * 0.8;
  const downMm = (layout.oval.h / 2) * 0.8;

  const ovals: OvalSpot[] = [];
  const rows = new Map<string, { subject: SubjectKey; question: number; list: { letter: number; dark: number }[] }>();
  for (const bubble of layout.bubbles) {
    const dark = darknessAt(grey, paper, put, bubble, alongMm, downMm);
    const key = `${bubble.subject}|${bubble.question}`;
    if (!rows.has(key)) rows.set(key, { subject: bubble.subject, question: bubble.question, list: [] });
    rows.get(key)!.list.push({ letter: bubble.letter, dark });
    const middle = put(bubble);
    const edge = put({ x: bubble.x + layout.oval.w / 2, y: bubble.y });
    const down = put({ x: bubble.x, y: bubble.y + layout.oval.h / 2 });
    ovals.push({
      subject: bubble.subject, question: bubble.question, letter: bubble.letter,
      x: middle.x, y: middle.y,
      rx: Math.hypot(edge.x - middle.x, edge.y - middle.y),
      ry: Math.hypot(down.x - middle.x, down.y - middle.y),
      dark,
    });
  }

  const answers: RowAnswer[] = [...rows.values()].map(({ subject, question, list }) => {
    const sorted = [...list].sort((a, b) => b.dark - a.dark);
    const top = sorted[0], next = sorted[1];
    const floor = sorted[sorted.length - 1].dark;
    if (top.dark < FILLED) return { subject, question, letters: [], doubtful: false };
    // Төртеуі де қараңғы: не бәрі боялған, не жол көлеңкеде/бұлыңғыр — адам қарасын.
    if (floor >= FILLED + 0.1) {
      return { subject, question, letters: sorted.map((one) => one.letter).sort(), doubtful: true };
    }
    // Боялған деп тек жолдың ең ашығынан АНЫҚ қараңғысы саналады: көлеңке
    // мен бұлыңғыр суретте бос дөңгелектердің өзі 0,3-ке жетеді, бірақ төртеуі
    // бірдей. Бір жолдың ішінде салыстыру — көлеңкеге тәуелсіз.
    const filled = sorted
      .filter((one) => one.dark >= FILLED && one.dark - floor >= ROW_GAP)
      .map((one) => one.letter).sort();
    if (filled.length === 0) return { subject, question, letters: [], doubtful: true };
    if (filled.length > 1) {
      // Екі (не одан көп) боялған: НИШ ережесі бойынша бұл — қате. Бірақ біреуі
      // өшірілген болуы мүмкін — адам қарасын.
      return { subject, question, letters: filled, doubtful: true };
    }
    // Біреуі ғана боялған, бірақ келесісінен анық қараңғы емес — күмәнді.
    return { subject, question, letters: [top.letter], doubtful: top.dark - next.dark < APART };
  });

  return {
    status: "ok",
    code,
    answers,
    ovals,
    width: grey.width,
    height: grey.height,
    marksFound: found.filter(Boolean).length,
    marksTotal: planned.length,
  };
}

const LETTERS = ["A", "B", "C", "D"];

/**
 * Оқылғанды базаға жазылатын түрге келтіру: пән → { "1": "A", "2": "", "3": "AC" }.
 * Екі әріп — ZipGrade-тегідей, санағанда «қате» болады.
 */
export function answersBySubject(answers: RowAnswer[]): Partial<Record<SubjectKey, Record<string, string>>> {
  const out: Partial<Record<SubjectKey, Record<string, string>>> = {};
  for (const one of answers) {
    const box = (out[one.subject] ??= {});
    box[String(one.question)] = one.letters.map((l) => {
      const ch = LETTERS[l];
      if (!ch) throw new Error("bad_letter");
      return ch;
    }).join("");
  }
  return out;
}
