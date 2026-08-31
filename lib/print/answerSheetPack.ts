/**
 * ZipGrade парақтарын талдау.
 *
 * Екі түрлі файл өңделеді:
 *
 *   ПАЧКА — бір пәннің оқушылық парақтары, бір оқушыға бір бет. Одан
 *   ZipGrade ID, беттің нөмірі және «Нұсқа» шеңберлері алынады.
 *
 *   КІЛТ ҮЛГІСІ — сол пәннің БОС парағы, тізімсіз, бір бет. Одан «Нұсқа»
 *   шеңберлерінен басқа әр сұрақтың A/B/C/D шеңберлері де алынады, сонда
 *   жүйе дұрыс жауаптарды өзі бояп бере алады.
 *
 * Неге кілт үшін бөлек бос парақ керек. Пачканың әр бетінде нақты
 * оқушының аты жазулы және оның ID-і боялған. Ондай бетке дұрыс
 * жауаптарды бояп сканерлесек, ZipGrade оны сол оқушының жүз пайыздық
 * жұмысы деп жазып алар еді.
 *
 * Талдау БІР РЕТ, жүктеу кезінде жасалады. Нәтижесі базада сақталады да,
 * басып шығару соны дайын күйінде алады.
 *
 * Шеңберлерді неге мәтін арқылы табамыз. PDF ішінде шеңбер — қисық сызық,
 * оны оқу қиын әрі сенімсіз. Ал шеңбердің ішінде әріп не цифр жазылған,
 * ал таңбаның орны PDF-те дәл көрсетілген. ZipGrade таңбаны шеңбердің дәл
 * ортасына қояды, сондықтан таңбаның ортасы = шеңбердің ортасы. Бес
 * пачкада тексерілді: көлденеңінен айырма 0.00 нүкте.
 */
import * as pdfjsLib from "pdfjs-dist";

// Воркер public ішінен алынады. Оны node_modules-тан бір рет көшіру керек
// (README_answer_sheets.md қараңыз) — кітапхана жаңарғанда қайта көшіріледі.
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

/** Таңбаның негізгі сызығынан шеңбердің ортасына дейін, қаріп өлшемінің үлесі. */
const BUBBLE_CENTER_K = 0.357;
/** Шеңбердің радиусы — көрші шеңберлердің қашықтығының үлесі. */
const RADIUS_K = 0.4;
/**
 * Боялатын дақтың радиусы шеңберден сәл кіші: координата бір нүктеге
 * жылжыса да, дақ сызықтан шықпайды. ZipGrade қараңғылықтың үлесіне
 * қарайды, ал 0.85 радиус — ауданның 72%-ы, баланың қарындашынан әлдеқайда
 * толық.
 */
export const FILL_RADIUS_K = 0.85;

export const LETTERS = ["A", "B", "C", "D"] as const;
export type Letter = (typeof LETTERS)[number];

export type SheetPageIndex = {
  /** ZipGrade ID — бес цифр. */
  id: string;
  /** Пачкадағы беттің нөмірі, 0-ден басталады. */
  page: number;
  /** «Нұсқа» шеңберлерінің орталары, солдан оңға. Бастауы — беттің сол төменгі бұрышы. */
  bubbles: [number, number][];
  /** Шеңбердің радиусы, нүктемен. */
  r: number;
};

export type SheetPackIndex = {
  pageCount: number;
  questionCount: number;
  pages: SheetPageIndex[];
};

/** Бір сұрақтың төрт шеңбері. */
export type KeyRow = { n: number; bubbles: [number, number][] };

export type KeyTemplateIndex = {
  questionCount: number;
  /** «Нұсқа» шеңберлері. */
  variantBubbles: [number, number][];
  variantR: number;
  /** Сұрақтардың шеңберлері, нөмірі бойынша реттелген. */
  rows: KeyRow[];
  r: number;
};

type Item = { s: string; x: number; y: number; w: number; size: number };

/** PDF мәтінінің бір бөлігі — бізге қажет түрде. */
function toItems(content: any): Item[] {
  const items: Item[] = [];
  for (const raw of content.items ?? []) {
    const s = String(raw.str ?? "").trim();
    if (!s) continue;
    items.push({
      s,
      x: raw.transform[4],
      y: raw.transform[5],
      w: raw.width,
      size: Math.abs(raw.transform[0]) || raw.height || 1,
    });
  }
  return items;
}

/** Таңбаның ортасы = шеңбердің ортасы. */
function centerOf(i: Item): [number, number] {
  return [i.x + i.w / 2, i.y + i.size * BUBBLE_CENTER_K];
}

/**
 * «Нұсқа» жазуының астындағы шеңберлер қатары.
 *
 * Дәл сол биіктікте, сәл оң жақта Student ID торы тұр — оның да ішінде
 * цифрлар бар. Екеуін қадаммен ажыратамыз: бір қатардың қадамы бірдей,
 * ал торға өткенде қадам бұзылады.
 */
function findVariantBubbles(items: Item[]): { bubbles: [number, number][]; r: number } | null {
  const lbl = items.find((i) => i.s === "Нұсқа" || i.s === "Вариант");
  if (!lbl) return null;

  const row = items
    .filter(
      (i) =>
        /^[1-9]$/.test(i.s) &&
        i.y < lbl.y &&
        lbl.y - i.y < 30 &&
        i.x > lbl.x - 12 &&
        i.x < lbl.x + 90
    )
    .sort((a, b) => a.x - b.x);
  if (row.length < 2) return null;

  const centers = row.map(centerOf);

  const step = centers[1][0] - centers[0][0];
  const run: [number, number][] = [centers[0]];
  for (let k = 1; k < centers.length; k++) {
    if (Math.abs(centers[k][0] - run[run.length - 1][0] - step) < 0.6) run.push(centers[k]);
    else break;
  }
  return { bubbles: run, r: step * RADIUS_K };
}

/**
 * Student ID — тордың үстіндегі ірі цифрлар. Олар бір бөлік болып
 * («7 1 0 5 2») та, бөлек-бөлек те келуі мүмкін, екеуі де өңделеді.
 * Тордың өз цифрлары кіші, сондықтан ең ірісін ғана аламыз.
 *
 * Бос бланкте ірі цифрлар мүлде болмайды — сонда null қайтады, және
 * дәл осымен оқушылық парақ пен кілт үлгісі ажыратылады.
 */
function findId(items: Item[]): string | null {
  const lbl = items.find((i) => i.s === "Student ID" || i.s === "ID");
  if (!lbl) return null;

  const band = items.filter(
    (i) =>
      i.y < lbl.y && lbl.y - i.y < 30 && i.x > lbl.x - 40 && i.x < lbl.x + 120 && /[0-9]/.test(i.s)
  );
  if (band.length === 0) return null;

  const biggest = Math.max(...band.map((i) => i.size));
  // Тордың цифрлары мен сұрақ нөмірлері кіші: 10 нүкте. ID-дікі — 15.
  if (biggest < 12) return null;

  const id = band
    .filter((i) => i.size > biggest - 0.01)
    .sort((a, b) => a.x - b.x)
    .map((i) => i.s.replace(/[^0-9]/g, ""))
    .join("");
  return id.length > 0 ? id : null;
}

/**
 * Сұрақ саны = жеке тұрған «A» әріптерінің саны: әр сұрақтың қатарында
 * A, B, C, D тұр, ал парақта басқа жалғыз «A» жоқ.
 */
function countQuestions(items: Item[]): number {
  return items.filter((i) => i.s === "A").length;
}

/**
 * Жауап шеңберлері. Әр «A» әрпінен бастап сол қатардағы келесі үшеуін
 * аламыз (B, C, D), ал сұрақтың нөмірі — сол жақтағы ең жақын сан.
 * Парақ бірнеше бағанға бөлінген, сондықтан «сол қатар» деген биіктігі
 * бірдей дегенді білдіреді, ал бағанның шекарасын әріптердің реті шешеді.
 */
function findAnswerRows(items: Item[]): { rows: KeyRow[]; r: number } | null {
  const letters = items.filter((i) => /^[A-D]$/.test(i.s));
  const numbers = items.filter((i) => /^[0-9]{1,3}$/.test(i.s));

  const rows: KeyRow[] = [];
  let step = 0;

  for (const a of letters.filter((i) => i.s === "A")) {
    const group = letters
      .filter((l) => Math.abs(l.y - a.y) < 1 && l.x >= a.x - 0.5 && l.x < a.x + 70)
      .sort((p, q) => p.x - q.x)
      .slice(0, 4);
    if (group.length < 4) continue;
    if (group.map((g) => g.s).join("") !== "ABCD") continue;

    const num = numbers
      .filter((n) => Math.abs(n.y - a.y) < 3 && n.x < a.x && a.x - n.x < 40)
      .sort((p, q) => q.x - p.x)[0];
    if (!num) continue;

    step = group[1].x - group[0].x;
    rows.push({ n: Number(num.s), bubbles: group.map(centerOf) });
  }

  if (rows.length === 0 || step <= 0) return null;
  rows.sort((p, q) => p.n - q.n);
  return { rows, r: step * RADIUS_K };
}

/** Пачканы талдап, беттердің көрсеткішін қайтарады. */
export async function parseAnswerSheetPack(
  file: File | ArrayBuffer,
  onProgress?: (done: number, total: number) => void
): Promise<SheetPackIndex> {
  const source = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  // pdf.js берілген буферді өзіне алып қояды (detached), сондықтан көшірмесін
  // береміз — әйтпесе шақырған жақтағы буфер жарамсыз болып қалады.
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(source.slice(0)) }).promise;

  const pages: SheetPageIndex[] = [];
  let questionCount = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const items = toItems(await (await doc.getPage(p)).getTextContent());

    if (p === 1) questionCount = countQuestions(items);

    const id = findId(items);
    const v = findVariantBubbles(items);

    if (!id) throw new Error(`${p}-беттен ZipGrade ID табылмады.`);
    if (!v) throw new Error(`${p}-беттен «Нұсқа» шеңберлері табылмады.`);

    pages.push({ id, page: p - 1, bubbles: v.bubbles, r: v.r });
    onProgress?.(p, doc.numPages);
  }

  const seen = new Set<string>();
  for (const pg of pages) {
    if (seen.has(pg.id)) {
      throw new Error(`Пачкада ${pg.id} ID-і екі рет кездеседі — файл бүлінген.`);
    }
    seen.add(pg.id);
  }

  return { pageCount: doc.numPages, questionCount, pages };
}

/** Кілт үлгісін (бос парақты) талдау. */
export async function parseKeyTemplate(file: File | ArrayBuffer): Promise<KeyTemplateIndex> {
  const source = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(source.slice(0)) }).promise;

  if (doc.numPages !== 1) {
    throw new Error(
      `Үлгіде ${doc.numPages} бет бар. Кілт үлгісі — тізімсіз БІР бос парақ, оқушылар пачкасы емес.`
    );
  }

  const items = toItems(await (await doc.getPage(1)).getTextContent());

  if (findId(items)) {
    throw new Error("Бұл парақта ZipGrade ID толтырылған — бұл оқушының парағы, кілт үлгісі емес.");
  }

  const v = findVariantBubbles(items);
  if (!v) throw new Error("Парақтан «Нұсқа» шеңберлері табылмады.");

  const a = findAnswerRows(items);
  if (!a) throw new Error("Парақтан жауап шеңберлері табылмады.");

  const expected = countQuestions(items);
  const numbers = a.rows.map((r) => r.n);
  const ok =
    a.rows.length === expected &&
    numbers.every((n, i) => n === i + 1) &&
    new Set(numbers).size === numbers.length;
  if (!ok) {
    throw new Error(
      `Сұрақтардың нөмірленуі оқылмады: ${a.rows.length} қатар табылды, күтілгені 1-ден ${expected}-ге дейін.`
    );
  }

  return {
    questionCount: expected,
    variantBubbles: v.bubbles,
    variantR: v.r,
    rows: a.rows,
    r: a.r,
  };
}

/** Пачкада жоқ оқушылардың ID-лері. */
export function missingFromPack(pages: SheetPageIndex[], needed: string[]): string[] {
  const have = new Set(pages.map((p) => p.id));
  return needed.filter((id) => !have.has(id));
}
