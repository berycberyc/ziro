export type AnswerFormat = "abcd" | "numeric" | "quantity";

export type ProfileBlock = {
  key: string;
  label: string;
  start: number;
  end: number;
};

export type TestProfile = {
  id: string;
  label: string;
  totalQuestions: number | null; // null = flexible (e.g. "Остальное")
  answerFormat: AnswerFormat;
  blocks: ProfileBlock[] | null; // null = single block covering everything
};

export const PROFILES: TestProfile[] = [
  {
    id: "nish_math",
    label: "НИШ Математика",
    totalQuestions: 40,
    answerFormat: "abcd",
    blocks: null,
  },
  {
    id: "nish_sandyq",
    label: "НИШ Сандық",
    totalQuestions: 60,
    answerFormat: "quantity",
    blocks: null,
  },
  {
    id: "nish_zharatylystanu",
    label: "НИШ Жаратылыстану",
    totalQuestions: null,
    answerFormat: "abcd",
    blocks: null,
  },
  {
    id: "nish_tilder",
    label: "НИШ Тілдер",
    totalQuestions: 60,
    answerFormat: "abcd",
    blocks: [
      { key: "kk", label: "Қазақ тілі", start: 1, end: 20 },
      { key: "ru", label: "Орыс тілі", start: 21, end: 40 },
      { key: "en", label: "Ағылшын тілі", start: 41, end: 60 },
    ],
  },
  {
    id: "bil",
    label: "БИЛ",
    totalQuestions: 60,
    answerFormat: "abcd",
    blocks: [
      { key: "math", label: "Математика", start: 1, end: 50 },
      { key: "reading", label: "Грамотность чтения", start: 51, end: 60 },
    ],
  },
  {
    id: "rfmsh",
    label: "РФМШ",
    totalQuestions: 30,
    answerFormat: "numeric",
    blocks: [
      { key: "p3", label: "3 балл", start: 1, end: 10 },
      { key: "p5", label: "5 балл", start: 11, end: 20 },
      { key: "p7", label: "7 балл", start: 21, end: 30 },
    ],
  },
  {
    id: "other",
    label: "Остальное",
    totalQuestions: null,
    answerFormat: "abcd",
    blocks: null,
  },
];

export function getProfile(id: string): TestProfile | undefined {
  return PROFILES.find((p) => p.id === id);
}

export function blockKeyFor(profile: TestProfile, questionNumber: number): string {
  if (!profile.blocks) return "main";
  const block = profile.blocks.find((b) => questionNumber >= b.start && questionNumber <= b.end);
  return block?.key ?? "main";
}
