export type ParsedParagraph = { xml: string; text: string };

export type QuestionItem = {
  number: number;
  block: string;
  // one entry per language marker found (kk/ru/en/etc.) — each an array of raw paragraph XML
  questionParas: { lang: string; paras: string[] }[];
  // ABCD: 4 (or more) answer paragraphs, each flagged whether it was marked zirotrue
  // numeric: exactly 1 paragraph, correct is irrelevant (the value itself is the answer)
  answerParas: { xml: string; correct: boolean }[];
};

const QUESTION_MARKER = /^zi(?:ro|p)question\s+([a-z]+)\s*(\d+)/i;
const ANSWER_MARKER = /^ziroanswer/i;
const TRUE_MARKER = /zirotrue/i;

export function extractParagraphs(documentXml: string): ParsedParagraph[] {
  const matches = documentXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
  return matches.map((xml) => {
    const textMatches = xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [];
    const text = textMatches
      .map((t) => t.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))
      .join("")
      .trim();
    return { xml, text };
  });
}

/**
 * Groups paragraphs into question items using the ziroquestion/ziroanswer/zirotrue
 * text markers. Marker paragraphs themselves are dropped from the stored XML —
 * only the actual content paragraphs (question text, answer choices) are kept,
 * with their original XML untouched so formulas/formatting survive unmodified.
 */
export function parseItems(
  paragraphs: ParsedParagraph[],
  blockKeyFor: (n: number) => string
): QuestionItem[] {
  const items: QuestionItem[] = [];
  let current: QuestionItem | null = null;
  let mode: "question" | "answer" | null = null;
  let currentLang = "";

  for (const p of paragraphs) {
    const qMatch = p.text.match(QUESTION_MARKER);
    if (qMatch) {
      const lang = qMatch[1].toLowerCase();
      const number = parseInt(qMatch[2], 10);
      if (!current || current.number !== number) {
        current = { number, block: blockKeyFor(number), questionParas: [], answerParas: [] };
        items.push(current);
      }
      current.questionParas.push({ lang, paras: [] });
      currentLang = lang;
      mode = "question";
      continue;
    }
    if (ANSWER_MARKER.test(p.text)) {
      mode = "answer";
      continue;
    }
    if (!current || !mode) continue;

    if (mode === "question") {
      const entry = current.questionParas.find((q) => q.lang === currentLang);
      entry?.paras.push(p.xml);
    } else if (mode === "answer") {
      const correct = TRUE_MARKER.test(p.text);
      // Strip the zirotrue marker text out of every text node in this answer
      // paragraph (Word can split text across several <w:t> runs).
      const cleanedXml = correct
        ? p.xml.replace(
            /<w:t([^>]*)>([\s\S]*?)<\/w:t>/gi,
            (_m, attrs, inner) => `<w:t${attrs}>${inner.replace(/zirotrue/gi, "")}</w:t>`
          )
        : p.xml;
      current.answerParas.push({ xml: cleanedXml, correct });
    }
  }

  return items;
}
