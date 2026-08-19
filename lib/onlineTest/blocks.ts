export type StageBlock = {
  key: string; // matches lib/docxTest/profiles.ts profile ids
  labelKk: string;
  labelRu: string;
  durationMinutes: number;
};

export const TEST_TYPE_BLOCKS: Record<string, StageBlock[]> = {
  NIS: [
    { key: "nish_math", labelKk: "Математика", labelRu: "Математика", durationMinutes: 60 },
    { key: "nish_sandyq", labelKk: "Сандық сипаттама", labelRu: "Числовая грамотность", durationMinutes: 30 },
    { key: "nish_zharatylystanu", labelKk: "Жаратылыстану", labelRu: "Естествознание", durationMinutes: 30 },
    { key: "nish_tilder", labelKk: "Тілдер", labelRu: "Языки", durationMinutes: 120 },
  ],
  BIL: [{ key: "bil", labelKk: "БІЛ", labelRu: "БИЛ", durationMinutes: 110 }],
  RFMS: [{ key: "rfmsh", labelKk: "РФМШ", labelRu: "РФМШ", durationMinutes: 120 }],
};

export function blocksForTestTypeCode(code: string): StageBlock[] {
  return TEST_TYPE_BLOCKS[code] ?? [];
}
