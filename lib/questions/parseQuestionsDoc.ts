import {
  SUBJECT_MAX_COUNT,
  SUBJECT_LABELS,
  QUANTITY_SUBJECTS,
  PASSAGE_SUBJECTS,
  NUMERIC_SUBJECTS,
  MONOLINGUAL_SUBJECTS,
  type SubjectKey,
} from "@/lib/questions/subjects";

/**
 * Word файлындағы жолдарды сұрақтарға айналдыру.
 *
 * Формат (пайдаланушымен келісілген):
 *   [Сессия атауы] / [Тест түрі] / [Пән] / [Нұсқа 1]
 *   [question1]
 *   [Тақырып]Пайыздар
 *   [kk] ... [A] [B] [C] [D]
 *   [ru] ... [A] [B] [C] [D]
 *   [right_answer]B
 *
 * Пәнге қарай өзгешеліктер:
 *   сандық  — [A_баған] / [B_баған], жауап нұсқалары жүйеде тұр
 *   рфмш    — әріп емес, сан жауап; [A]–[D] жоқ
 *   тілдер  — бір тілде, [ru] блогы жоқ, [Мәтін N] арқылы оқылым мәтіні
 *   бил     — 1–50 әдеттегідей, 51–60 мәтінмен, нөмірлеу тұтас
 *
 * Мұнда ЕШТЕҢЕ базаға жазылмайды — тек оқылады және тексеріледі.
 */

export type ParsedChoice = { text_kk: string; text_ru: string; correct: boolean };

export type ParsedQuestion = {
  question_number: number;
  topic: string | null;
  text_kk: string;
  text_ru: string;
  choices: ParsedChoice[];
  correct_answer: string | null;
  column_a_kk: string;
  column_a_ru: string;
  column_b_kk: string;
  column_b_ru: string;
  passage_index: number | null;
};

export type ParsedPassage = { index: number; text: string };

export type ParseResult = {
  sessionTitle: string;
  testType: string;
  subjectLabel: string;
  variant: number | null;
  questions: ParsedQuestion[];
  passages: ParsedPassage[];
  errors: string[];
  warnings: string[];
};

const TAG = /^\[([^\]]+)\]\s*(.*)$/;

/** "[question12]" -> 12 */
function questionNumber(tag: string): number | null {
  const m = tag.match(/^question\s*(\d+)$/i);
  return m ? Number(m[1]) : null;
}

/** "[Нұсқа 2]" / "[вариант 2]" -> 2 */
function variantNumber(tag: string): number | null {
  const m = tag.match(/^(?:нұсқа|нускa|нуска|вариант|variant)\s*(\d+)$/i);
  return m ? Number(m[1]) : null;
}

/** "[Мәтін 3]" -> 3 */
function passageNumber(tag: string): number | null {
  const m = tag.match(/^(?:мәтін|матин|текст|passage)\s*(\d+)$/i);
  return m ? Number(m[1]) : null;
}

function isTag(tag: string, ...names: string[]) {
  const t = tag.trim().toLowerCase();
  return names.some((n) => t === n.toLowerCase());
}

export function parseQuestionsDocument(lines: string[], subject: SubjectKey): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];
  const passages: ParsedPassage[] = [];

  const isQuantity = QUANTITY_SUBJECTS.includes(subject);
  const isNumeric = NUMERIC_SUBJECTS.includes(subject);
  const isMono = MONOLINGUAL_SUBJECTS.includes(subject);
  const allowsPassages = PASSAGE_SUBJECTS.includes(subject);

  // Шапка: алғашқы белгісіз тегтер — атау, тест түрі, пән.
  const header: string[] = [];
  let variant: number | null = null;

  let current: ParsedQuestion | null = null;
  let lang: "kk" | "ru" = "kk";
  let passageIndex: number | null = null;
  let collectingPassage: ParsedPassage | null = null;

  const push = () => {
    if (current) questions.push(current);
    current = null;
  };

  const addText = (value: string) => {
    if (!value) return;
    if (collectingPassage) {
      collectingPassage.text += (collectingPassage.text ? "\n" : "") + value;
      return;
    }
    if (!current) return;
    if (lang === "ru" && !isMono) {
      current.text_ru += (current.text_ru ? "\n" : "") + value;
    } else {
      current.text_kk += (current.text_kk ? "\n" : "") + value;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const m = line.match(TAG);
    if (!m) {
      addText(line);
      continue;
    }

    const tag = m[1].trim();
    const rest = m[2].trim();

    // ---- нұсқа ----
    const vn = variantNumber(tag);
    if (vn !== null) {
      variant = vn;
      continue;
    }

    // ---- оқылым мәтіні ----
    const pn = passageNumber(tag);
    if (pn !== null) {
      push();
      if (!allowsPassages) {
        errors.push(`${SUBJECT_LABELS[subject]} пәнінде оқылым мәтіні болмауы керек ([${tag}]).`);
      }
      collectingPassage = { index: pn, text: rest };
      passages.push(collectingPassage);
      passageIndex = pn;
      continue;
    }

    // ---- жаңа сұрақ ----
    const qn = questionNumber(tag);
    if (qn !== null) {
      push();
      collectingPassage = null;
      lang = "kk";
      current = {
        question_number: qn,
        topic: null,
        text_kk: "",
        text_ru: "",
        choices: [],
        correct_answer: null,
        column_a_kk: "",
        column_a_ru: "",
        column_b_kk: "",
        column_b_ru: "",
        passage_index: passageIndex,
      };
      continue;
    }

    if (isTag(tag, "тақырып", "тема", "topic")) {
      if (current) current.topic = rest || null;
      continue;
    }

    if (isTag(tag, "kk", "қаз", "каз")) {
      collectingPassage = null;
      lang = "kk";
      if (rest) addText(rest);
      continue;
    }

    if (isTag(tag, "ru", "рус")) {
      collectingPassage = null;
      lang = "ru";
      if (rest) addText(rest);
      continue;
    }

    if (isTag(tag, "a_баған", "a_bagan", "колонка_a", "column_a")) {
      if (current) {
        if (lang === "ru" && !isMono) current.column_a_ru = rest;
        else current.column_a_kk = rest;
      }
      continue;
    }

    if (isTag(tag, "b_баған", "b_bagan", "колонка_b", "column_b")) {
      if (current) {
        if (lang === "ru" && !isMono) current.column_b_ru = rest;
        else current.column_b_kk = rest;
      }
      continue;
    }

    if (isTag(tag, "right_answer", "дұрыс_жауап", "правильный_ответ")) {
      if (current) current.correct_answer = rest;
      continue;
    }

    if (/^[ABCD]$/i.test(tag)) {
      if (!current) continue;
      const idx = "ABCD".indexOf(tag.toUpperCase());
      const choice =
        current.choices[idx] ?? { text_kk: "", text_ru: "", correct: false };
      if (lang === "ru" && !isMono) choice.text_ru = rest;
      else choice.text_kk = rest;
      current.choices[idx] = choice;
      continue;
    }

    // Танылмаған тег — шапка деп есептейміз (атау, тест түрі, пән).
    if (!current && !collectingPassage) {
      header.push(tag);
      continue;
    }

    warnings.push(`Түсініксіз белгі: [${tag}] — еленбеді.`);
  }
  push();

  // ---------------- тексеру ----------------

  if (variant === null) {
    errors.push("Нұсқа нөмірі жоқ. Файл басына [Нұсқа 1] деп жазыңыз.");
  } else if (variant < 1 || variant > 4) {
    errors.push(`Нұсқа нөмірі дұрыс емес: ${variant}. 1-ден 4-ке дейін болуы керек.`);
  }

  const expected = SUBJECT_MAX_COUNT[subject];
  if (questions.length !== expected) {
    errors.push(
      `Файлда ${questions.length} сұрақ, ал ${SUBJECT_LABELS[subject]} пәнінде ${expected} болуы керек.`
    );
  }

  const seen = new Set<number>();
  questions.forEach((q) => {
    const where = `${q.question_number}-сұрақ`;

    if (seen.has(q.question_number)) errors.push(`${where}: нөмір қайталанған.`);
    seen.add(q.question_number);

    if (q.question_number < 1 || q.question_number > expected) {
      errors.push(`${where}: нөмір 1–${expected} аралығында болуы керек.`);
    }

    if (!q.topic) errors.push(`${where}: [Тақырып] көрсетілмеген.`);

    if (isQuantity) {
      if (!q.column_a_kk.trim() || !q.column_b_kk.trim()) {
        errors.push(`${where}: [A_баған] немесе [B_баған] толтырылмаған.`);
      }
    } else if (!q.text_kk.trim()) {
      errors.push(`${where}: сұрақ мәтіні жоқ.`);
    }

    if (!isMono && !isQuantity && !q.text_ru.trim()) {
      errors.push(`${where}: орысша мәтіні жоқ ([ru] блогы).`);
    }

    if (isNumeric) {
      if (!q.correct_answer) errors.push(`${where}: [right_answer] жоқ.`);
    } else if (isQuantity) {
      if (!q.correct_answer || !/^[ABCD]$/i.test(q.correct_answer)) {
        errors.push(`${where}: [right_answer] A, B, C немесе D болуы керек.`);
      }
    } else {
      const filled = q.choices.filter((c) => c && c.text_kk.trim()).length;
      if (filled !== 4) errors.push(`${where}: 4 жауап нұсқасы толық емес (${filled}).`);
      if (!q.correct_answer || !/^[ABCD]$/i.test(q.correct_answer)) {
        errors.push(`${where}: [right_answer] A, B, C немесе D болуы керек.`);
      } else {
        const idx = "ABCD".indexOf(q.correct_answer.toUpperCase());
        q.choices.forEach((c, i) => {
          if (c) c.correct = i === idx;
        });
      }
    }

    if (allowsPassages && q.passage_index !== null) {
      if (!passages.some((p) => p.index === q.passage_index)) {
        errors.push(`${where}: [Мәтін ${q.passage_index}] табылмады.`);
      }
    }
  });

  // Жетпей тұрған нөмірлер
  for (let n = 1; n <= expected; n++) {
    if (!seen.has(n)) errors.push(`${n}-сұрақ файлда жоқ.`);
  }

  return {
    sessionTitle: header[0] ?? "",
    testType: header[1] ?? "",
    subjectLabel: header[2] ?? "",
    variant,
    questions: questions.sort((a, b) => a.question_number - b.question_number),
    passages,
    errors,
    warnings,
  };
}
