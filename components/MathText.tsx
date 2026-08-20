"use client";

import katex from "katex";
import { Fragment } from "react";

/** Splits on $...$ (inline math) and renders each math segment via KaTeX.
 * Plain text (including any existing "1/2" style notation with no $
 * delimiters) passes through completely unchanged. */
export default function MathText({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          const latex = part.slice(1, -1);
          try {
            const html = katex.renderToString(latex, { throwOnError: false, displayMode: false });
            return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <Fragment key={i}>{part}</Fragment>;
          }
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
