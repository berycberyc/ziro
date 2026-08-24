import type { SubjectKey } from "@/lib/questions/subjects";
import {
  NIS_SECTIONS,
  NIS_TIEBREAK_ORDER,
  BIL_POINTS,
  BIL_SECTIONS,
  rfmshPointsFor,
  RFMSH_MAX,
  type NisSection,
} from "@/lib/scoring/rules";

/**
 * Бір ғана санау машинасы — онлайн да, ZipGrade-тен келген офлайн да
 * осы арқылы өтеді. Кіріс: шикі жауаптар + дұрыс жауап кілті.
 */

export type AnswerKeyItem = {
  subject: SubjectKey;
  variant_number: number;
  question_number: number;
  /** "A".."D" немесе сандық жауап */
  correct: string;
};

export type Sheet = {
  zipgrade_id: string;
  subject: SubjectKey;
  variant_number: number;
  /** { сұрақ нөмірі -> оқушы белгілегені } */
  answers: Record<number, string>;
};

export type Student = {
  zipgrade_id: string;
  first_name: string;
  last_name: string;
};

export type Verdict = "correct" | "wrong" | "blank";

/**
 * Оқушының белгісін бағалау.
 * Бос — blank. Бір әріп/сан — кілтпен салыстырылады.
 * Екі белгі («CD») — әрқашан қате (пайдаланушы бекіткен ереже).
 */
export function judge(given: string | undefined | null, correct: string | undefined): Verdict {
  const g = (given ?? "").trim();
  if (g === "") return "blank";

  // Бірнеше көпіршік боялған — қате деп саналады.
  if (/^[A-Da-d]{2,}$/.test(g)) return "wrong";

  const key = (correct ?? "").trim();
  if (key === "") return "wrong"; // кілт жоқ — дұрыс деп санауға негіз жоқ

  if (/^[A-Da-d]$/.test(g)) return g.toUpperCase() === key.toUpperCase() ? "correct" : "wrong";

  // Сандық жауап: бос орындар мен үтірді елемей салыстырамыз.
  const norm = (s: string) => s.replace(/\s/g, "").replace(",", ".");
  return norm(g) === norm(key) ? "correct" : "wrong";
}

function keyLookup(key: AnswerKeyItem[]) {
  const map = new Map<string, string>();
  key.forEach((k) => map.set(`${k.subject}|${k.variant_number}|${k.question_number}`, k.correct));
  return (subject: string, variant: number, qnum: number) =>
    map.get(`${subject}|${variant}|${qnum}`);
}

function sectionQuestionNumbers(section: NisSection, key: AnswerKeyItem[]): number[] {
  const nums = new Set<number>();
  key
    .filter((k) => k.subject === section.subject)
    .filter((k) => {
      if (section.from == null || section.to == null) return true;
      return k.question_number >= section.from && k.question_number <= section.to;
    })
    .forEach((k) => nums.add(k.question_number));
  return [...nums].sort((a, b) => a - b);
}

// ---------------------------------------------------------------
// НИШ
// ---------------------------------------------------------------

export type NisWeight = {
  section: string;
  question_number: number;
  answered_correct: number;
  cohort: number;
  share_correct: number;
  weight: number;
};

export type NisResult = {
  zipgrade_id: string;
  first_name: string;
  last_name: string;
  /** бөлім кілті -> ұпай (бүтінге дейін дөңгелектелген) */
  scores: Record<string, number>;
  total: number;
  /** шектен төмен бөлімдер (қызыл) */
  belowThreshold: string[];
  rank: number;
};

export function scoreNis(
  sheets: Sheet[],
  key: AnswerKeyItem[],
  students: Map<string, Student>
): { results: NisResult[]; weights: NisWeight[] } {
  const lookup = keyLookup(key);

  // Пән бойынша парақтар
  const bySubject = new Map<string, Sheet[]>();
  sheets.forEach((s) => {
    const list = bySubject.get(s.subject) ?? [];
    list.push(s);
    bySubject.set(s.subject, list);
  });

  const weights: NisWeight[] = [];
  const weightBySection = new Map<string, Map<number, number>>();

  NIS_SECTIONS.forEach((section) => {
    const list = bySubject.get(section.subject) ?? [];
    const qnums = sectionQuestionNumbers(section, key);
    const perQuestion = new Map<number, number>();

    qnums.forEach((qnum) => {
      let correctCount = 0;
      list.forEach((sheet) => {
        const v = judge(sheet.answers[qnum], lookup(sheet.subject, sheet.variant_number, qnum));
        if (v === "correct") correctCount++;
      });
      // Бос жауап та, қате жауап та бөлгішке кіреді — барлық қатысушы.
      const cohort = list.length;
      const share = cohort > 0 ? correctCount / cohort : 0;
      const weight = 1 - share;
      perQuestion.set(qnum, weight);
      weights.push({
        section: section.key,
        question_number: qnum,
        answered_correct: correctCount,
        cohort,
        share_correct: share,
        weight,
      });
    });

    weightBySection.set(section.key, perQuestion);
  });

  // Оқушылар
  const ids = new Set(sheets.map((s) => s.zipgrade_id));
  const results: NisResult[] = [];

  ids.forEach((id) => {
    const scores: Record<string, number> = {};
    const below: string[] = [];

    NIS_SECTIONS.forEach((section) => {
      const perQuestion = weightBySection.get(section.key) ?? new Map();
      const totalWeight = [...perQuestion.values()].reduce((a, b) => a + b, 0);
      const sheet = sheets.find((s) => s.zipgrade_id === id && s.subject === section.subject);

      let earned = 0;
      let correctCount = 0;
      let questionCount = 0;

      perQuestion.forEach((w, qnum) => {
        questionCount++;
        if (!sheet) return;
        const v = judge(sheet.answers[qnum], lookup(sheet.subject, sheet.variant_number, qnum));
        if (v === "correct") {
          earned += w;
          correctCount++;
        }
      });

      let score: number;
      if (totalWeight > 0) {
        score = (earned / totalWeight) * section.maxScore;
      } else {
        // Сирек жағдай: барлық сұраққа бәрі дұрыс жауап берген (немесе
        // сұрақ жоқ) — салмақтардың қосындысы нөл, бөлуге болмайды.
        // Ондайда қарапайым пайызбен санаймыз.
        score = questionCount > 0 ? (correctCount / questionCount) * section.maxScore : 0;
      }

      const rounded = Math.round(score);
      scores[section.key] = rounded;
      if (section.threshold != null && rounded < section.threshold) below.push(section.key);
    });

    const student = students.get(id);
    results.push({
      zipgrade_id: id,
      first_name: student?.first_name ?? "",
      last_name: student?.last_name ?? "",
      scores,
      total: Object.values(scores).reduce((a, b) => a + b, 0),
      belowThreshold: below,
      rank: 0,
    });
  });

  // Реттеу: жалпы сома, сосын математика, сандық, жаратылыстану.
  results.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    for (const k of NIS_TIEBREAK_ORDER) {
      const diff = (b.scores[k] ?? 0) - (a.scores[k] ?? 0);
      if (diff !== 0) return diff;
    }
    return a.zipgrade_id.localeCompare(b.zipgrade_id);
  });
  results.forEach((r, i) => {
    r.rank = i + 1;
  });

  return { results, weights };
}

// ---------------------------------------------------------------
// БИЛ — дұрыс +4, бос 0, қате −1
// ---------------------------------------------------------------

export type SimpleResult = {
  zipgrade_id: string;
  first_name: string;
  last_name: string;
  scores: Record<string, number>;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  rank: number;
};

export function scoreBil(
  sheets: Sheet[],
  key: AnswerKeyItem[],
  students: Map<string, Student>
): SimpleResult[] {
  const lookup = keyLookup(key);
  const ids = new Set(sheets.map((s) => s.zipgrade_id));
  const results: SimpleResult[] = [];

  ids.forEach((id) => {
    const scores: Record<string, number> = {};
    let correct = 0;
    let wrong = 0;
    let blank = 0;

    BIL_SECTIONS.forEach((section) => {
      const sheet = sheets.find((s) => s.zipgrade_id === id && s.subject === section.subject);
      const qnums = key
        .filter((k) => k.subject === section.subject)
        .map((k) => k.question_number);
      const unique = [...new Set(qnums)].sort((a, b) => a - b);

      let score = 0;
      unique.forEach((qnum) => {
        const v = judge(
          sheet?.answers[qnum],
          lookup(section.subject, sheet?.variant_number ?? 1, qnum)
        );
        if (v === "correct") {
          score += BIL_POINTS.correct;
          correct++;
        } else if (v === "wrong") {
          score += BIL_POINTS.wrong;
          wrong++;
        } else {
          score += BIL_POINTS.blank;
          blank++;
        }
      });
      scores[section.key] = score;
    });

    const student = students.get(id);
    results.push({
      zipgrade_id: id,
      first_name: student?.first_name ?? "",
      last_name: student?.last_name ?? "",
      scores,
      correct,
      wrong,
      blank,
      total: Object.values(scores).reduce((a, b) => a + b, 0),
      rank: 0,
    });
  });

  results.sort((a, b) => b.total - a.total || a.zipgrade_id.localeCompare(b.zipgrade_id));
  results.forEach((r, i) => {
    r.rank = i + 1;
  });
  return results;
}

// ---------------------------------------------------------------
// РФМШ — 1–10 × 3, 11–20 × 5, 21–30 × 7
// ---------------------------------------------------------------

export function scoreRfmsh(
  sheets: Sheet[],
  key: AnswerKeyItem[],
  students: Map<string, Student>
): SimpleResult[] {
  const lookup = keyLookup(key);
  const results: SimpleResult[] = [];

  sheets
    .filter((s) => s.subject === "rfmsh")
    .forEach((sheet) => {
      const qnums = [
        ...new Set(key.filter((k) => k.subject === "rfmsh").map((k) => k.question_number)),
      ].sort((a, b) => a - b);

      let score = 0;
      let correct = 0;
      let wrong = 0;
      let blank = 0;

      qnums.forEach((qnum) => {
        const v = judge(sheet.answers[qnum], lookup("rfmsh", sheet.variant_number, qnum));
        if (v === "correct") {
          score += rfmshPointsFor(qnum);
          correct++;
        } else if (v === "wrong") wrong++;
        else blank++;
      });

      const student = students.get(sheet.zipgrade_id);
      results.push({
        zipgrade_id: sheet.zipgrade_id,
        first_name: student?.first_name ?? "",
        last_name: student?.last_name ?? "",
        scores: { rfmsh: score },
        correct,
        wrong,
        blank,
        total: score,
        rank: 0,
      });
    });

  results.sort((a, b) => b.total - a.total || a.zipgrade_id.localeCompare(b.zipgrade_id));
  results.forEach((r, i) => {
    r.rank = i + 1;
  });
  return results;
}

export { RFMSH_MAX };
