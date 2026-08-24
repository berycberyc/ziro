export type SubjectKey =
  | "math"
  | "sandyq"
  | "zharatylystanu"
  | "tilder"
  | "bil_math"
  | "bil_reading"
  | "rfmsh";

export const SUBJECT_MINUTES: Record<SubjectKey, number> = {
  math: 60,
  sandyq: 30,
  zharatylystanu: 30,
  tilder: 120,
  bil_math: 92,
  bil_reading: 18,
  rfmsh: 120,
};

export const SUBJECT_MAX_COUNT: Record<SubjectKey, number> = {
  math: 40,
  sandyq: 60,
  zharatylystanu: 20,
  tilder: 60,
  bil_math: 50,
  bil_reading: 10,
  rfmsh: 30,
};

export const SUBJECT_LABELS: Record<SubjectKey, string> = {
  math: "Математика",
  sandyq: "Сандық сипаттамалар / Количественные характеристики",
  zharatylystanu: "Жаратылыстану / Естествознание",
  tilder: "Тілдер / Языки",
  bil_math: "БИЛ — математика",
  bil_reading: "БИЛ — оқылым",
  rfmsh: "РФМШ / РФММ",
};

// Fixed answer choices for Сандық сипаттамалар (quantity comparison) —
// always the same 4, never typed per-question.
export const QUANTITY_CHOICE_LABELS: Record<"A" | "B" | "C" | "D", { kk: string; ru: string }> = {
  A: { kk: "А бағаны үлкен", ru: "Столбец A больше" },
  B: { kk: "В бағаны үлкен", ru: "Столбец B больше" },
  C: { kk: "А = В", ru: "A = B" },
  D: { kk: "Анықтау мүмкін емес", ru: "Невозможно определить" },
};

// Which subjects use the "shared simple form" (Математика/Жаратылыстану/
// БИЛ-математика style: plain ABCD question list). Сандық has its own
// quantity-comparison form; Тілдер/БИЛ-оқылым use the passage-based form;
// РФМШ has no answer choices at all.
export const SIMPLE_ABCD_SUBJECTS: SubjectKey[] = ["math", "zharatylystanu", "bil_math"];
export const QUANTITY_SUBJECTS: SubjectKey[] = ["sandyq"];
export const PASSAGE_SUBJECTS: SubjectKey[] = ["tilder", "bil_reading"];

// Тілдер жалғыз тілде жазылады (қазақ бөлімі қазақша, орыс бөлімі орысша,
// ағылшын бөлімі ағылшынша) — аударманың мағынасы жоқ. БИЛ-оқылым екі тілде.
export const MONOLINGUAL_SUBJECTS: SubjectKey[] = ["tilder"];

// Тілдер 60 сұрақ: 1–20 қазақ тілі, 21–40 орыс тілі, 41–60 ағылшын тілі.
// Бөлу тек ұпай санағанда болады, енгізуде де, тестте де тұтас 1–60.
export const TILDER_SECTIONS = [
  { key: "tilder_kk", label: "Қазақ тілі", from: 1, to: 20, maxScore: 200 },
  { key: "tilder_ru", label: "Орыс тілі", from: 21, to: 40, maxScore: 200 },
  { key: "tilder_en", label: "Ағылшын тілі", from: 41, to: 60, maxScore: 200 },
] as const;
export const NUMERIC_SUBJECTS: SubjectKey[] = ["rfmsh"];

export const TEST_TYPE_SUBJECTS: Record<string, SubjectKey[]> = {
  NIS: ["math", "sandyq", "zharatylystanu", "tilder"],
  BIL: ["bil_math", "bil_reading"],
  RFMS: ["rfmsh"],
};
