/**
 * Олимпиада кілті: Excel-ден оқу және балл есептеу.
 *
 * Кілт файлы (Excel), бірінші жол — тақырып:
 *   №  | Жауап | Балл
 *   1  | B     | 1
 *   2  | 12,5  | 2
 *   3  | 3/4; 0,75 |      <- бірнеше дұрыс жауап «;» арқылы, бос балл = 1
 *   4  | X     |          <- тапсырма алынды: бәріне балл беріледі
 *
 * Әріптер латынша да, кирилше де (А, В, С) қабылданады.
 * Бұл балл тек ұйымдастырушыға көмек — ресми нәтижені ол өзі шешеді.
 */

import * as XLSX from "xlsx";

export type KeyRow = {
  number: number;
  answers: string[];
  points: number;
  voided: boolean;
};

export type KeyParseResult = { rows: KeyRow[]; errors: string[] };

export type QuestionKind = { number: number; kind: "abcd" | "open" };

const CYR_TO_LAT: Record<string, string> = { "А": "A", "В": "B", "С": "C" };

function normalizeLetter(s: string): string {
  const up = s.trim().toUpperCase();
  return CYR_TO_LAT[up] ?? up;
}

/** Ашық жауапты салыстыру үшін: кіші әріп, бос орынсыз, үтір = нүкте. */
export function normalizeOpen(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
}

function sameOpen(given: string, expected: string): boolean {
  const a = normalizeOpen(given);
  const b = normalizeOpen(expected);
  if (!a) return false;
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return a !== "" && b !== "" && Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export async function parseKeyFile(file: File, questions: QuestionKind[]): Promise<KeyParseResult> {
  const errors: string[] = [];
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { rows: [], errors: ["Файлда парақ жоқ."] };
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });

  const kinds = new Map(questions.map((q) => [q.number, q.kind]));
  const rows: KeyRow[] = [];
  const seen = new Set<number>();

  // Бірінші жол — тақырып.
  for (let i = 1; i < data.length; i++) {
    const r = data[i] ?? [];
    const excelRow = i + 1;
    const numText = cellText(r[0]);
    const ansText = cellText(r[1]);
    const ptsText = cellText(r[2]);
    if (!numText && !ansText && !ptsText) continue;

    const number = Number(numText);
    if (!Number.isInteger(number) || number < 1) {
      errors.push(`${excelRow}-жол: № дұрыс емес («${numText}»).`);
      continue;
    }
    const kind = kinds.get(number);
    if (!kind) {
      errors.push(`${excelRow}-жол: ${number}-сұрақ тапсырмаларда жоқ.`);
      continue;
    }
    if (seen.has(number)) {
      errors.push(`${excelRow}-жол: ${number}-сұрақ қайталанған.`);
      continue;
    }
    seen.add(number);

    let points = 1;
    if (ptsText) {
      points = Number(ptsText.replace(",", "."));
      if (!Number.isFinite(points) || points < 0) {
        errors.push(`${excelRow}-жол: балл дұрыс емес («${ptsText}»).`);
        continue;
      }
    }

    if (["X", "Х"].includes(ansText.toUpperCase())) {
      rows.push({ number, answers: [], points, voided: true });
      continue;
    }

    const parts = ansText.split(";").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) {
      errors.push(`${excelRow}-жол: ${number}-сұрақтың жауабы жоқ.`);
      continue;
    }

    if (kind === "abcd") {
      const letters = parts.map(normalizeLetter);
      const bad = letters.filter((l) => !/^[ABCD]$/.test(l));
      if (bad.length) {
        errors.push(`${excelRow}-жол: ${number}-сұрақ нұсқалы — жауап A, B, C немесе D болуы керек («${ansText}»).`);
        continue;
      }
      rows.push({ number, answers: Array.from(new Set(letters)), points, voided: false });
    } else {
      rows.push({ number, answers: parts, points, voided: false });
    }
  }

  for (const q of questions) {
    if (!seen.has(q.number)) errors.push(`${q.number}-сұрақтың кілті жоқ.`);
  }

  return { rows: rows.sort((a, b) => a.number - b.number), errors };
}

/** Бір оқушының балы. answers — Word-тағы әріппен ({ "5": "B" }). */
export function scoreAnswers(
  answers: Record<string, string>,
  key: KeyRow[],
  kinds: Map<number, "abcd" | "open">
): number {
  let total = 0;
  for (const k of key) {
    if (k.voided) {
      total += k.points;
      continue;
    }
    const given = answers[String(k.number)];
    if (!given) continue;
    const kind = kinds.get(k.number);
    const ok =
      kind === "abcd"
        ? k.answers.includes(normalizeLetter(given))
        : k.answers.some((a) => sameOpen(given, a));
    if (ok) total += k.points;
  }
  return Math.round(total * 100) / 100;
}

/** Кілт үлгісі: № бағаны толтырылған, сұрақ түрі көрсетілген. */
export function downloadKeyTemplate(questions: QuestionKind[]) {
  const rows: (string | number)[][] = [["№", "Жауап", "Балл", "Түрі (ақпарат үшін)"]];
  for (const q of questions) {
    rows.push([q.number, "", "", q.kind === "abcd" ? "A/B/C/D" : "ашық / открытый"]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 8 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Кілт");
  XLSX.writeFile(wb, "olimpiada-kilt-ulgi.xlsx");
}
