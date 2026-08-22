export type SubjectKey =
  | "math"
  | "sandyq"
  | "zharatylystanu"
  | "tilder_kk"
  | "tilder_ru"
  | "tilder_en"
  | "bil_math"
  | "bil_reading"
  | "rfmsh";

export const SUBJECT_MAX_COUNT: Record<SubjectKey, number> = {
  math: 40,
  sandyq: 60,
  zharatylystanu: 20,
  tilder_kk: 20,
  tilder_ru: 20,
  tilder_en: 20,
  bil_math: 50,
  bil_reading: 10,
  rfmsh: 30,
};

export const SUBJECT_LABELS: Record<SubjectKey, string> = {
  math: "Математика",
  sandyq: "Сандық сипаттама",
  zharatylystanu: "Жаратылыстану",
  tilder_kk: "Тілдер (қазақ)",
  tilder_ru: "Тілдер (орыс)",
  tilder_en: "Тілдер (ағылшын)",
  bil_math: "БІЛ — математика",
  bil_reading: "БІЛ — оқылым",
  rfmsh: "РФМШ",
};

// Which subjects use the "shared simple form" (Математика/Сандық/Жаратылыстану
// style: plain question list, no passage grouping). Тілдер/БІЛ-reading use a
// different passage-based form (not built yet); RFMSH has no answer choices.
export const SIMPLE_ABCD_SUBJECTS: SubjectKey[] = ["math", "sandyq", "zharatylystanu", "bil_math"];
export const PASSAGE_SUBJECTS: SubjectKey[] = ["tilder_kk", "tilder_ru", "tilder_en", "bil_reading"];
export const NUMERIC_SUBJECTS: SubjectKey[] = ["rfmsh"];

export const TEST_TYPE_SUBJECTS: Record<string, SubjectKey[]> = {
  NIS: ["math", "sandyq", "zharatylystanu", "tilder_kk", "tilder_ru", "tilder_en"],
  BIL: ["bil_math", "bil_reading"],
  RFMS: ["rfmsh"],
};
