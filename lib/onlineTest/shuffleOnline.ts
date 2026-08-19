export type BankItem = {
  id: string;
  question_number: number;
  block_key: string;
  text_kk: string | null;
  text_ru: string | null;
  answer_format: string;
  choices: { text: string; correct: boolean }[];
  image_svg: string | null;
};

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Shuffles question order within each block independently (blocks never
 * mix), and shuffles each item's own answer choices. Variant 1 keeps the
 * original order untouched, matching the docx pipeline's convention.
 *
 * NOTE: does not yet group by reading_group_id (passage + its questions
 * travelling together) — no Тілдер/БІЛ-reading content exists in the bank
 * yet, so this is a follow-up once that content is added.
 */
export function shuffleForVariant(items: BankItem[], variantNumber: number): BankItem[] {
  if (variantNumber === 1) return items;

  const byBlock = new Map<string, BankItem[]>();
  for (const item of items) {
    if (!byBlock.has(item.block_key)) byBlock.set(item.block_key, []);
    byBlock.get(item.block_key)!.push(item);
  }

  const shuffledByBlock = new Map<string, BankItem[]>();
  for (const [block, blockItems] of byBlock) {
    shuffledByBlock.set(block, shuffleArray(blockItems));
  }

  const cursors = new Map<string, number>();
  const result: BankItem[] = [];
  for (const item of items) {
    const cursor = cursors.get(item.block_key) ?? 0;
    const pool = shuffledByBlock.get(item.block_key)!;
    const picked = pool[cursor];
    cursors.set(item.block_key, cursor + 1);
    const choices = picked.choices.length > 1 ? shuffleArray(picked.choices) : picked.choices;
    result.push({ ...picked, choices });
  }
  return result;
}
