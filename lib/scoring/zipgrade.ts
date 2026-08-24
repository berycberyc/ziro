import * as XLSX from "xlsx";
import type { SubjectKey } from "@/lib/questions/subjects";

/**
 * ZipGrade экспорт файлын оқу.
 *
 * Файл құрылымы (пайдаланушы берген үлгіден):
 *   QuizName | QuizClass | FirstName | LastName | StudentID | CustomID |
 *   Earned Points | Possible Points | PercentCorrect | QuizCreated |
 *   DataExported | Key Version | Stu1 | PriKey1 | Points1 | Mark1 | Stu2 | ...
 *
 *   StudentID   — біздің zipgrade_id
 *   Key Version — нұсқа нөмірі
 *   StuN        — оқушы белгілегені (бос, "A", немесе "CD" сияқты қосарлы)
 *   PriKeyN     — ZipGrade-тегі дұрыс жауап (тек тексеру үшін; санауға
 *                 біздің базадағы кілт қолданылады)
 *
 * Оқушы аттары ZipGrade-те қолмен теріледі және базамен сәйкес келмеуі
 * мүмкін — сондықтан тек StudentID бойынша байланыстырамыз.
 */

export type ParsedRow = {
  zipgrade_id: string;
  variant_number: number;
  /** { сұрақ нөмірі -> оқушы белгілегені } */
  answers: Record<number, string>;
  /** { сұрақ нөмірі -> ZipGrade кілті } */
  zipKey: Record<number, string>;
};

export type ParsedFile = {
  quizName: string;
  rows: ParsedRow[];
  questionCount: number;
};

function cell(row: any, name: string): string {
  const v = row[name];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

export function parseZipGradeFile(buffer: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

  if (rows.length === 0) return { quizName: "", rows: [], questionCount: 0 };

  // Stu1, Stu2, ... — қанша сұрақ бар екенін содан білеміз.
  const headers = Object.keys(rows[0]);
  const questionCount = headers.filter((h) => /^Stu\d+$/.test(h)).length;

  const parsed: ParsedRow[] = rows
    .map((r) => {
      const answers: Record<number, string> = {};
      const zipKey: Record<number, string> = {};
      for (let i = 1; i <= questionCount; i++) {
        answers[i] = cell(r, `Stu${i}`).toUpperCase();
        zipKey[i] = cell(r, `PriKey${i}`).toUpperCase();
      }
      return {
        zipgrade_id: cell(r, "StudentID"),
        variant_number: parseInt(cell(r, "Key Version") || "1", 10) || 1,
        answers,
        zipKey,
      };
    })
    .filter((r) => r.zipgrade_id !== "");

  return {
    quizName: cell(rows[0], "QuizName"),
    rows: parsed,
    questionCount,
  };
}

/**
 * Онлайн жауаптарды ZipGrade-тің дәл сол бағандарымен жазу — екі дереккөз
 * бірдей көрінсін, есептеу машинасы екеуін ажыратпасын.
 */
export function buildZipGradeStyleSheet(params: {
  quizName: string;
  questionCount: number;
  rows: {
    zipgrade_id: string;
    first_name: string;
    last_name: string;
    variant_number: number;
    answers: Record<number, string>;
    key: Record<number, string>;
  }[];
}): any[][] {
  const { quizName, questionCount, rows } = params;

  const header = [
    "QuizName",
    "QuizClass",
    "FirstName",
    "LastName",
    "StudentID",
    "CustomID",
    "Earned Points",
    "Possible Points",
    "PercentCorrect",
    "QuizCreated",
    "DataExported",
    "Key Version",
  ];
  for (let i = 1; i <= questionCount; i++) {
    header.push(`Stu${i}`, `PriKey${i}`, `Points${i}`, `Mark${i}`);
  }

  const exported = new Date().toISOString().slice(0, 19).replace("T", " ");

  const body = rows.map((r) => {
    let earned = 0;
    const line: any[] = [
      quizName,
      "",
      r.first_name,
      r.last_name,
      r.zipgrade_id,
      "",
      0, // төменде толтырылады
      questionCount,
      0,
      "",
      exported,
      r.variant_number,
    ];

    for (let i = 1; i <= questionCount; i++) {
      const given = r.answers[i] ?? "";
      const correct = r.key[i] ?? "";
      const isCorrect =
        given !== "" && correct !== "" && given.toUpperCase() === correct.toUpperCase();
      if (isCorrect) earned++;
      line.push(given, correct, isCorrect ? 1 : 0, isCorrect ? "C" : "X");
    }

    line[6] = earned;
    line[8] = questionCount > 0 ? Math.round((earned / questionCount) * 1000) / 10 : 0;
    return line;
  });

  return [header, ...body];
}

export const SUBJECT_QUIZ_NAMES: Record<SubjectKey, string> = {
  math: "Ниш матем",
  sandyq: "Ниш сандық",
  zharatylystanu: "Ниш жаратылыстану",
  tilder: "Ниш тілдер",
  bil: "БИЛ",
  rfmsh: "РФМШ",
};
