/**
 * Сандық сипаттама үшін кесте құрастыру.
 *
 * Неге бөлек: сандықтың мәні — екі шаманы ҚАТАР қою, сонда көз бірден
 * салыстырады. Тізіммен («A) …» үстінде, «B) …» астында) бұл мағына
 * жоғалады: бала екеуін бірінен соң бірін оқиды. Сондықтан баспа
 * нұсқасында кесте болуы керек: № | А қатары | В қатары.
 *
 * Жол түрлері:
 *   • қарапайым  — № , А ұяшығы, В ұяшығы
 *   • шарты бар  — алдымен бүкіл ені бойынша шарт жолы, астында бағандар
 *                  (нөмір ұяшығы екі жолға біріктіріледі)
 *
 * Суреттер: шарт суреті бүкіл енге, баған суреті — сол ұяшықтың ішіне.
 */
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** Бағандардың ені (twip). A4, өрістерді алып тастағанда ≈ 9900. */
const COL_NUM = 700;
const COL_HALF = 4600;

type QRow = {
  number: string;
  condition: Element[];
  colA: Element[];
  colB: Element[];
};

function el(doc: Document, name: string): Element {
  return doc.createElementNS(W_NS, "w:" + name);
}

function attr(e: Element, name: string, value: string) {
  e.setAttributeNS(W_NS, "w:" + name, value);
}

/** Мәтіні бар қарапайым абзац (кесте ұяшығына арналған). */
function textPara(doc: Document, text: string, bold = false): Element {
  const p = el(doc, "p");
  const pPr = el(doc, "pPr");
  const jc = el(doc, "jc");
  attr(jc, "val", "center");
  pPr.appendChild(jc);
  p.appendChild(pPr);
  const r = el(doc, "r");
  if (bold) {
    const rPr = el(doc, "rPr");
    rPr.appendChild(el(doc, "b"));
    r.appendChild(rPr);
  }
  const t = el(doc, "t");
  t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  t.appendChild(doc.createTextNode(text));
  r.appendChild(t);
  p.appendChild(r);
  return p;
}

/** Ұяшық: ені, біріктіру, ішіндегі абзацтар. */
function cell(
  doc: Document,
  width: number,
  content: Element[],
  opts?: { span?: number; vMerge?: "restart" | "continue" }
): Element {
  const tc = el(doc, "tc");
  const tcPr = el(doc, "tcPr");

  const w = el(doc, "tcW");
  attr(w, "w", String(width));
  attr(w, "type", "dxa");
  tcPr.appendChild(w);

  if (opts?.span && opts.span > 1) {
    const gs = el(doc, "gridSpan");
    attr(gs, "val", String(opts.span));
    tcPr.appendChild(gs);
  }
  if (opts?.vMerge) {
    const vm = el(doc, "vMerge");
    if (opts.vMerge === "restart") attr(vm, "val", "restart");
    tcPr.appendChild(vm);
  }
  const va = el(doc, "vAlign");
  attr(va, "val", "center");
  tcPr.appendChild(va);

  tc.appendChild(tcPr);

  // Ұяшық бос болмауы керек — Word талабы.
  const items = content.length > 0 ? content : [textPara(doc, "")];
  for (const c of items) {
    // Ұяшық ішіндегі бәрі ортаға тураланады.
    if (c.localName === "p") {
      let pPr = Array.from(c.children).find((x) => x.localName === "pPr");
      if (!pPr) {
        pPr = el(doc, "pPr");
        c.insertBefore(pPr, c.firstChild);
      }
      if (!Array.from(pPr.children).some((x) => x.localName === "jc")) {
        const jc = el(doc, "jc");
        attr(jc, "val", "center");
        pPr.appendChild(jc);
      }
    }
    tc.appendChild(c);
  }
  return tc;
}

function row(doc: Document, cells: Element[], opts?: { header?: boolean }): Element {
  const tr = el(doc, "tr");
  const trPr = el(doc, "trPr");
  // Сұрақ екі бетке бөлінбесін.
  trPr.appendChild(el(doc, "cantSplit"));
  if (opts?.header) trPr.appendChild(el(doc, "tblHeader"));
  tr.appendChild(trPr);
  for (const c of cells) tr.appendChild(c);
  return tr;
}

/** Кестенің жақтаулары мен ені. */
function tableProps(doc: Document): Element {
  const tblPr = el(doc, "tblPr");

  const w = el(doc, "tblW");
  attr(w, "w", "5000");
  attr(w, "type", "pct");
  tblPr.appendChild(w);

  const borders = el(doc, "tblBorders");
  for (const side of ["top", "left", "bottom", "right", "insideH", "insideV"]) {
    const b = el(doc, side);
    attr(b, "val", "single");
    attr(b, "sz", "4");
    attr(b, "space", "0");
    attr(b, "color", "808080");
    borders.appendChild(b);
  }
  tblPr.appendChild(borders);

  const margins = el(doc, "tblCellMar");
  for (const [side, val] of [["top", "60"], ["left", "80"], ["bottom", "60"], ["right", "80"]]) {
    const m = el(doc, side);
    attr(m, "w", val);
    attr(m, "type", "dxa");
    margins.appendChild(m);
  }
  tblPr.appendChild(margins);

  return tblPr;
}

/** Жиналған сұрақтардан кесте жасайды. */
export function buildQuantityTable(doc: Document, rows: QRow[], lang: "kk" | "ru"): Element {
  const tbl = el(doc, "tbl");
  tbl.appendChild(tableProps(doc));

  const grid = el(doc, "tblGrid");
  for (const wdt of [COL_NUM, COL_HALF, COL_HALF]) {
    const gc = el(doc, "gridCol");
    attr(gc, "w", String(wdt));
    grid.appendChild(gc);
  }
  tbl.appendChild(grid);

  // Шапка — бір рет, бірақ бет ауысқанда қайталанады (tblHeader).
  const head = lang === "kk"
    ? ["№", "А қатары", "В қатары"]
    : ["№", "Колонка А", "Колонка В"];
  tbl.appendChild(
    row(doc, [
      cell(doc, COL_NUM, [textPara(doc, head[0], true)]),
      cell(doc, COL_HALF, [textPara(doc, head[1], true)]),
      cell(doc, COL_HALF, [textPara(doc, head[2], true)]),
    ], { header: true })
  );

  for (const q of rows) {
    if (q.condition.length > 0) {
      // Шарт — бүкіл ені бойынша, нөмір ұяшығы екі жолға созылады.
      tbl.appendChild(
        row(doc, [
          cell(doc, COL_NUM, [textPara(doc, q.number)], { vMerge: "restart" }),
          cell(doc, COL_HALF * 2, q.condition, { span: 2 }),
        ])
      );
      tbl.appendChild(
        row(doc, [
          cell(doc, COL_NUM, [], { vMerge: "continue" }),
          cell(doc, COL_HALF, q.colA),
          cell(doc, COL_HALF, q.colB),
        ])
      );
    } else {
      tbl.appendChild(
        row(doc, [
          cell(doc, COL_NUM, [textPara(doc, q.number)]),
          cell(doc, COL_HALF, q.colA),
          cell(doc, COL_HALF, q.colB),
        ])
      );
    }
  }
  return tbl;
}

export type { QRow };
