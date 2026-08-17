import type { QuestionItem } from "./parse";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Returns a new item order for one variant. Variant 1 keeps the original
 * order untouched. Variants 2-4 shuffle question order within each block
 * independently (blocks never mix), and shuffle each item's own answer
 * choices independently too.
 */
export function buildVariant(items: QuestionItem[], variantNumber: number): QuestionItem[] {
  if (variantNumber === 1) {
    // Still shuffle answer-choice order for variant 1? No — variant 1 is the
    // original, untouched submission, exactly as uploaded.
    return items;
  }

  // Group by block, preserving each block's own relative slot positions.
  const blockOrder: string[] = [];
  const byBlock = new Map<string, QuestionItem[]>();
  for (const item of items) {
    if (!byBlock.has(item.block)) {
      byBlock.set(item.block, []);
      blockOrder.push(item.block);
    }
    byBlock.get(item.block)!.push(item);
  }

  const shuffledByBlock = new Map<string, QuestionItem[]>();
  for (const [block, blockItems] of byBlock) {
    let shuffled = shuffleArray(blockItems);
    // Avoid an accidental identity shuffle when there's more than one item.
    if (blockItems.length > 1 && shuffled.every((it, i) => it === blockItems[i])) {
      shuffled = shuffleArray(blockItems);
    }
    shuffledByBlock.set(block, shuffled);
  }

  // Reassemble in original slot order, pulling the next shuffled item for each block.
  const cursors = new Map<string, number>();
  const result: QuestionItem[] = [];
  for (const item of items) {
    const cursor = cursors.get(item.block) ?? 0;
    const pool = shuffledByBlock.get(item.block)!;
    const picked = pool[cursor];
    cursors.set(item.block, cursor + 1);

    // Shuffle this item's own answer choices (ABCD only — numeric items have 1 line).
    const answerParas =
      picked.answerParas.length > 1 ? shuffleArray(picked.answerParas) : picked.answerParas;

    result.push({ ...picked, answerParas });
  }

  return result;
}
