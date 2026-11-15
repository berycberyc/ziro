/**
 * Олимпиада тапсырмаларының Word файлын оқу.
 *
 * Формат — біздің әдеттегі белгілер (lib/questions/parseQuestionsDoc.ts),
 * тек КІЛТСІЗ:
 *
 *   [question1]
 *   [kk] Сұрақ мәтіні ...
 *   [A] ...  [B] ...  [C] ...  [D] ...
 *   [ru] Текст вопроса ...
 *   [A] ...  [B] ...  [C] ...  [D] ...
 *
 *   [question2]
 *   [kk] Ашық сұрақ: жауап нұсқалары жоқ
 *   [ru] Открытый вопрос: без вариантов
 *
 * [A]–[D] бар сұрақ — нұсқалы (ABCD), жоқ сұрақ — ашық жауап.
 * Формулалар ($...$) мен суреттер әдеттегідей: сурет [kk] ішінде тұрса —
 * қазақшаға, [ru] ішінде — орысшаға, жалғыз сурет екі тілге де.
 *
 * Файлда [right_answer] болса — ол ЕЛЕНБЕЙДІ (кілт олимпиададан кейін
 * бөлек жүктеледі), тек ескерту шығады.
 */

export type OlympiadChoice = { kk: string; ru: string };

export type OlympiadParsedQuestion = {
  number: number;
  kind: "abcd" | "open";
  text_kk: string;
  text_ru: string;
  image_index: number | null;
  image_index_ru: number | null;
  choices: OlympiadChoice[];
};

export type OlympiadParseResult = {
  questions: OlympiadParsedQuestion[];
  errors: string[];
  warnings: string[];
};

const TAG = /^\[([^\]]+)\]\s*(.*)$/;

function isTag(tag: string, ...names: string[]) {
  const t = tag.trim().toLowerCase();
  return names.some((n) => t === n.toLowerCase());
}

export function parseOlympiadDocument(lines: string[]): OlympiadParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: OlympiadParsedQuestion[] = [];

  let current: OlympiadParsedQuestion | null = null;
  let lang: "kk" | "ru" = "kk";
  let keyWarned = false;

  const push = () => {
    if (current) questions.push(current);
    current = null;
  };

  const addText = (value: string) => {
    if (!value || !current) return;
    if (lang === "ru") current.text_ru += (current.text_ru ? "\n" : "") + value;
    else current.text_kk += (current.text_kk ? "\n" : "") + value;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const img = line.match(/^\[\[image:(\d+)\]\]$/);
    if (img) {
      const idx = Number(img[1]);
      if (current) {
        if (lang === "ru") {
          if (current.image_index_ru === null) current.image_index_ru = idx;
          else warnings.push(`${current.number}-сұрақ: [ru] ішінде бірнеше сурет — біріншісі алынды.`);
        } else {
          if (current.image_index === null) current.image_index = idx;
          else warnings.push(`${current.number}-сұрақ: [kk] ішінде бірнеше сурет — біріншісі алынды.`);
        }
      } else {
        warnings.push("Бірінші сұрақтан бұрынғы сурет еленбеді.");
      }
      continue;
    }

    const m = line.match(TAG);
    if (!m) {
      addText(line);
      continue;
    }

    const tag = m[1].trim();
    const rest = m[2].trim();

    const qn = tag.match(/^question\s*(\d+)$/i);
    if (qn) {
      push();
      lang = "kk";
      current = {
        number: Number(qn[1]),
        kind: "open",
        text_kk: "",
        text_ru: "",
        image_index: null,
        image_index_ru: null,
        choices: [],
      };
      continue;
    }

    if (isTag(tag, "kk", "қаз", "каз")) {
      lang = "kk";
      if (rest) addText(rest);
      continue;
    }

    if (isTag(tag, "ru", "рус")) {
      lang = "ru";
      if (rest) addText(rest);
      continue;
    }

    if (isTag(tag, "right_answer", "дұрыс_жауап", "правильный_ответ")) {
      if (!keyWarned) {
        warnings.push(
          "Файлда [right_answer] бар — ол сақталмайды. Кілт олимпиададан кейін бөлек жүктеледі."
        );
        keyWarned = true;
      }
      continue;
    }

    if (/^[ABCD]$/i.test(tag)) {
      if (!current) continue;
      const idx = "ABCD".indexOf(tag.toUpperCase());
      const choice = current.choices[idx] ?? { kk: "", ru: "" };
      if (lang === "ru") choice.ru = rest;
      else choice.kk = rest;
      current.choices[idx] = choice;
      current.kind = "abcd";
      continue;
    }

    if (isTag(tag, "тақырып", "тема", "topic")) continue;

    // Сұрақтан бұрынғы белгілер — тақырып жолдары, еленбейді.
    if (!current) continue;

    warnings.push(`${current.number}-сұрақ: түсініксіз белгі [${tag}] — еленбеді.`);
  }
  push();

  // ---------------- тексеру ----------------

  if (questions.length === 0) {
    errors.push("Файлдан бірде-бір сұрақ табылмады. Әр сұрақ [question1], [question2] ... деп басталуы керек.");
  }

  const seen = new Set<number>();
  for (const q of questions) {
    const where = `${q.number}-сұрақ`;
    if (seen.has(q.number)) errors.push(`${where}: нөмір қайталанған.`);
    seen.add(q.number);

    if (!q.text_kk.trim() && q.image_index === null) errors.push(`${where}: қазақша мәтіні жоқ ([kk]).`);
    if (!q.text_ru.trim() && q.image_index_ru === null && q.image_index === null) {
      errors.push(`${where}: орысша мәтіні жоқ ([ru]).`);
    }

    if (q.kind === "abcd") {
      const filledKk = [0, 1, 2, 3].filter((i) => q.choices[i]?.kk.trim()).length;
      if (filledKk !== 4 || q.choices.length !== 4) {
        errors.push(`${where}: қазақша 4 жауап нұсқасы толық емес (${filledKk}).`);
      }
      const filledRu = [0, 1, 2, 3].filter((i) => q.choices[i]?.ru.trim()).length;
      if (filledRu > 0 && filledRu < 4) {
        errors.push(`${where}: орысша жауап нұсқалары толық емес (${filledRu}).`);
      } else if (filledRu === 0) {
        warnings.push(`${where}: орысша жауап нұсқалары жоқ — қазақшасы көрсетіледі.`);
      }
      // Бос орындарды толтырамыз (тексеру қате берсе де, құрылым бұзылмасын).
      for (let i = 0; i < 4; i++) q.choices[i] = q.choices[i] ?? { kk: "", ru: "" };
    }
  }

  const sorted = questions.sort((a, b) => a.number - b.number);
  const max = sorted.length ? sorted[sorted.length - 1].number : 0;
  for (let n = 1; n <= max; n++) {
    if (!seen.has(n)) errors.push(`${n}-сұрақ файлда жоқ (нөмірлер 1-ден бастап қатарынан болуы керек).`);
  }
  if (max > 200) errors.push("Сұрақ саны 200-ден аспауы керек.");

  return { questions: sorted, errors, warnings };
}
