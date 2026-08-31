/**
 * ZipGrade пачкасын талдау.
 *
 * Пачка — бір пәннің жауап парақтары, бір оқушыға бір бет. Бізге әр
 * беттен үш нәрсе керек:
 *   • ZipGrade ID — бет кімдікі екенін білу үшін. Атпен салыстыруға
 *     болмайды: ZipGrade-тегі жазылуы мен базадағы жазылуы бір әріппен
 *     не бос орынмен ажырап кетеді, ал ID — бес цифр, ажырамайды.
 *   • «Нұсқа» шеңберлерінің координаталары — керектісін бояу үшін.
 *   • Парақтағы сұрақ саны — пачка шынымен осы пәннен бе, соны тексеру.
 *
 * Талдау БІР РЕТ, жүктеу кезінде жасалады. Нәтижесі базада сақталады да,
 * басып шығару соны дайын күйінде алады: жүзден аса бетті әр басып
 * шығаруда қайта талдау — бос жұмыс.
 *
 * Шеңберлерді неге мәтін арқылы табамыз. PDF ішінде шеңбер — қисық сызық,
 * оны оқу қиын әрі сенімсіз. Ал шеңбердің ішінде цифр жазылған, ал цифрдың
 * орны PDF-те дәл көрсетілген. ZipGrade цифрды шеңбердің дәл ортасына
 * қояды, сондықтан цифрдың ортасы = шеңбердің ортасы. Бес пачкада
 * тексерілді: көлденеңінен айырма 0.00 нүкте.
 */
import * as pdfjsLib from "pdfjs-dist";

// Воркер public ішінен алынады. Оны node_modules-тан бір рет көшіру керек
// (README_answer_sheets.md қараңыз) — кітапхана жаңарғанда қайта көшіріледі.
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

/** Цифрдың негізгі сызығынан шеңбердің ортасына дейін, қаріп өлшемінің үлесі. */
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

  const centers: [number, number][] = row.map((i) => [
    i.x + i.w / 2,
    i.y + i.size * BUBBLE_CENTER_K,
  ]);

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

/** Пачкада жоқ оқушылардың ID-лері. */
export function missingFromPack(pages: SheetPageIndex[], needed: string[]): string[] {
  const have = new Set(pages.map((p) => p.id));
  return needed.filter((id) => !have.has(id));
}
