/**
 * Олимпиада нәтижелерінің Excel кестесі.
 *
 * Ұйымдастырушы кестені ЖҮКТЕП АЛАДЫ, «Нәтиже» бағанына өткендерге
 * «Өтті» деп жазады да, КЕРІ ЖҮКТЕЙДІ. Сайт тек екі бағанды оқиды:
 * «Код» және «Нәтиже». Қалғаны — анықтама.
 *
 * «Нәтиже» бағанында Excel-дің «Проверка данных» тізімі тұр: тек «Өтті»
 * таңдауға болады. Бірақ көшіріп қойғанда ол айналып өтіледі, сондықтан
 * сайт файлды қайта тексереді: «Өтті» немесе бос — басқасы қате.
 */

import * as XLSX from "xlsx";
import { formatAstana } from "@/lib/olympiad/time";

export const RESULT_WORD = "Өтті";
export const CODE_HEADER = "Код";
export const RESULT_HEADER = "Нәтиже";

export type ExportRow = {
  code: string;
  zipgrade_id: string | null;
  full_name: string | null;
  grade: string | null;
  school: string | null;
  city: string | null;
  region: string | null;
  lang: string;
  registered_at: string;
  started_at: string | null;
  finished_at: string | null;
  finish_reason: string | null;
  answers: Record<string, string>;
  leave_count: number;
  leave_seconds: number;
  offline_count: number;
  offline_seconds: number;
  passed: boolean;
};

function statusText(r: ExportRow, ended: boolean): string {
  if (!r.started_at) return "Кірмеді";
  if (r.finish_reason === "leaves") return "Аяқталды: беттен шығу шегі";
  if (r.finished_at) return "Өзі аяқтады";
  return ended ? "Уақыт бітті" : "Жазып жатыр";
}

export async function downloadResultsWorkbook(opts: {
  rows: ExportRow[];
  questionNumbers: number[];
  scores: Map<string, number> | null;
  ended: boolean;
  keepPassed: boolean;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Нәтижелер", { views: [{ state: "frozen", ySplit: 1, xSplit: 3 }] });

  const header: string[] = [
    CODE_HEADER,
    "Оқушы ID",
    "Аты-жөні",
    RESULT_HEADER,
    ...(opts.scores ? ["Балл (сайт есебі)"] : []),
    "Сынып",
    "Мектеп",
    "Қала",
    "Облыс",
    "Тіл",
    "Тіркелді",
    "Кірді",
    "Аяқтады",
    "Қатысуы",
    "Беттен шығу (рет)",
    "Беттен тыс (сек)",
    "Интернет үзілуі (рет)",
    "Интернетсіз (сек)",
    ...opts.questionNumbers.map((n) => String(n)),
  ];
  ws.addRow(header);

  for (const r of opts.rows) {
    ws.addRow([
      r.code,
      r.zipgrade_id ?? "",
      r.full_name ?? "",
      opts.keepPassed && r.passed ? RESULT_WORD : null,
      ...(opts.scores ? [opts.scores.get(r.code) ?? 0] : []),
      r.grade ?? "",
      r.school ?? "",
      r.city ?? "",
      r.region ?? "",
      r.lang === "ru" ? "орыс" : "қазақ",
      formatAstana(r.registered_at, "kk"),
      r.started_at ? formatAstana(r.started_at, "kk") : "",
      r.finished_at ? formatAstana(r.finished_at, "kk") : "",
      statusText(r, opts.ended),
      r.leave_count,
      r.leave_seconds,
      r.offline_count,
      r.offline_seconds,
      ...opts.questionNumbers.map((n) => r.answers?.[String(n)] ?? ""),
    ]);
  }

  // Код пен ID — мәтін (алдыңғы нөлдер жоғалмасын).
  ws.getColumn(1).numFmt = "@";
  ws.getColumn(2).numFmt = "@";

  const headRow = ws.getRow(1);
  headRow.font = { bold: true };
  headRow.alignment = { vertical: "middle", wrapText: true };

  const resultCol = ws.getColumn(4);
  resultCol.width = 12;
  ws.getColumn(1).width = 10;
  ws.getColumn(2).width = 10;
  ws.getColumn(3).width = 30;

  // «Нәтиже» бағаны: тек «Өтті» (тізімнен) немесе бос.
  const last = Math.max(opts.rows.length + 1, 2);
  for (let i = 2; i <= last; i++) {
    const cell = ws.getCell(i, 4);
    cell.dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${RESULT_WORD}"`],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: RESULT_HEADER,
      error: `Тек «${RESULT_WORD}» деп жазуға болады немесе бос қалдырыңыз.`,
    };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF5D6" } };
  }
  ws.getCell(1, 4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2D27A" } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "olimpiada-natizheler.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export type ResultsParse = {
  passedCodes: string[];
  notPassed: number;
  missing: number;
  errors: string[];
};

/**
 * Ұйымдастырушы толтырған кестені тексеру. Тек дәл «Өтті» немесе бос.
 * knownCodes — тіркелгендердің коды.
 */
export async function parseResultsFile(file: File, knownCodes: string[]): Promise<ResultsParse> {
  const errors: string[] = [];
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { passedCodes: [], notPassed: 0, missing: 0, errors: ["Файлда парақ жоқ."] };

  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  const head = (data[0] ?? []).map((h) => (h === null ? "" : String(h).trim()));
  const codeCol = head.indexOf(CODE_HEADER);
  const resultCol = head.indexOf(RESULT_HEADER);
  if (codeCol < 0) errors.push(`Бірінші жолда «${CODE_HEADER}» бағаны табылмады.`);
  if (resultCol < 0) errors.push(`Бірінші жолда «${RESULT_HEADER}» бағаны табылмады.`);
  if (errors.length) return { passedCodes: [], notPassed: 0, missing: 0, errors };

  const known = new Set(knownCodes);
  const seen = new Set<string>();
  const passed: string[] = [];
  let notPassed = 0;

  for (let i = 1; i < data.length; i++) {
    const r = data[i] ?? [];
    const excelRow = i + 1;
    const rawCode = r[codeCol];
    const rawResult = r[resultCol];
    const rowEmpty = r.every((v) => v === null || v === "");
    if (rowEmpty) continue;

    let code = rawCode === null ? "" : String(rawCode).trim();
    // Excel кодты санға айналдырып, алдыңғы нөлді жойған болуы мүмкін.
    if (/^\d{1,6}$/.test(code)) code = code.padStart(6, "0");

    if (!code) {
      errors.push(`${excelRow}-жол: код жоқ.`);
      continue;
    }
    if (!known.has(code)) {
      errors.push(`${excelRow}-жол: «${code}» коды тіркелгендер арасында жоқ.`);
      continue;
    }
    if (seen.has(code)) {
      errors.push(`${excelRow}-жол: «${code}» коды қайталанған.`);
      continue;
    }
    seen.add(code);

    if (rawResult === null || rawResult === "") {
      notPassed++;
    } else if (rawResult === RESULT_WORD) {
      passed.push(code);
    } else {
      errors.push(`${excelRow}-жол: «${String(rawResult)}» — қате сөз. Тек «${RESULT_WORD}» немесе бос.`);
    }
  }

  const missing = knownCodes.filter((c) => !seen.has(c)).length;
  return { passedCodes: passed, notPassed, missing, errors };
}
