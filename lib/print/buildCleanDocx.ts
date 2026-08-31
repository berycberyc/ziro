/**
 * Жүктелген Word файлынан басып шығаруға дайын нұсқа жасау.
 *
 * НЕГЕ ҚАЙТА ҚҰРАСТЫРМАЙМЫЗ. Бастапқыда таза құжат базадан нөлден
 * жиналатын, бірақ ондай құжатта формулалар суретке айналады: өңдеуге
 * келмейді, шрифт өлшемімен үйлеспейді, басып шығарғанда бұлыңғыр болады.
 * Ал пайдаланушының файлында формулалар — Word-тың нағыз теңдеулері.
 * Сондықтан құжатты қайта жасамай, СОЛ ФАЙЛДЫҢ көшірмесін тазалаймыз:
 * формулалар, суреттер, стильдер сол күйінде қалады.
 *
 * Не істейді:
 *   • [question12] → сұрақтың бірінші жолына «12. » деп қосады
 *   • [A] → «A) », [A_баған] → «A) »
 *   • [kk] / [ru] → біреуін қалдырып, екіншісінің бүкіл блогын өшіреді
 *   • [Тақырып], [right_answer], [Нұсқа 1], пән аты — өшіріледі
 *   • сурет басқа тілдегі блокта тұрса, қалған блокта сурет жоқ болса —
 *     сурет жоғалмас үшін көшіріледі
 */

import { buildQuantityTable, type QRow } from "./quantityTable";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML_SPACE = "http://www.w3.org/XML/1998/namespace";

/** Колонтитулдағы логотиптің ені: 3,2 см (EMU-мен, 1 см = 360000). */
const LOGO_W_EMU = 1152000;
const LOGO_H_EMU = Math.round(LOGO_W_EMU * 416 / 1188);

/** Біздің қосатын бөліктеріміз — пайдаланушының файлындағымен атаусыз
 *  қақтығыспау үшін атаулары бөлек. */
const HDR = "word/ziro-header.xml";
const FTR = "word/ziro-footer.xml";
const LOGO = "word/media/ziro-logo.png";

function headerXml(title: string, logoRelId: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="${W}" xmlns:r="${R}"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
 <w:p>
  <w:pPr>
   <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="C9CDD3"/></w:pBdr>
   <w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs>
   <w:spacing w:after="120"/>
  </w:pPr>
  <w:r><w:drawing>
   <wp:inline distT="0" distB="0" distL="0" distR="0">
    <wp:extent cx="${LOGO_W_EMU}" cy="${LOGO_H_EMU}"/>
    <wp:docPr id="900" name="Ziro"/>
    <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
     <pic:pic>
      <pic:nvPicPr><pic:cNvPr id="900" name="Ziro"/><pic:cNvPicPr/></pic:nvPicPr>
      <pic:blipFill><a:blip r:embed="${logoRelId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
      <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${LOGO_W_EMU}" cy="${LOGO_H_EMU}"/></a:xfrm>
       <a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
     </pic:pic></a:graphicData></a:graphic>
   </wp:inline>
  </w:drawing></w:r>
  <w:r><w:tab/></w:r>
  <w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(title)}</w:t></w:r>
 </w:p>
</w:hdr>`;
}

/** Бет нөмірі — астында, ортада. PAGE өрісін Word өзі толтырады. */
function footerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${W}" xmlns:r="${R}">
 <w:p>
  <w:pPr><w:jc w:val="center"/></w:pPr>
  <w:r><w:fldChar w:fldCharType="begin"/></w:r>
  <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
  <w:r><w:fldChar w:fldCharType="separate"/></w:r>
  <w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r>
  <w:r><w:fldChar w:fldCharType="end"/></w:r>
 </w:p>
</w:ftr>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decode(e: ZipEntry): string {
  return new TextDecoder("utf-8").decode(e.data);
}
function encodeInto(e: ZipEntry, text: string): void {
  e.data = new TextEncoder().encode(text);
}

/** Файлда әлі жоқ, бос емес rId нөмірін табады. */
function nextRelId(relsXml: string): number {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  return (ids.length ? Math.max(...ids) : 0) + 1;
}

/**
 * Колонтитул мен бет нөмірін құжатқа қосады.
 *
 * Неге қолмен: құжат нөлден жиналмайды, пайдаланушының файлы тазаланады.
 * Сондықтан колонтитулды да сол пакеттің ішіне қосамыз — жаңа бөліктер,
 * оларға сілтеме және sectPr-дегі жазба.
 */
async function addHeaderFooter(
  entries: ZipEntry[],
  doc: Document,
  body: Element,
  title: string
): Promise<void> {
  // 1. Логотип. Без него колонтитул не нужен — выходим до любых изменений.
  let logoBytes: Uint8Array;
  try {
    const res = await fetch("/logo-wide.png");
    if (!res.ok) return;
    logoBytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    return;
  }

  // 2. Байланыстар тізімі. Файлда болмаса — құрамыз, шықпаймыз.
  //
  //    Бұрын осы жерде `if (!rels) return` тұрған. Word-та жасалмаған
  //    файлда бұл бөлік болмайды, сондықтан функция логотип пен
  //    колонтитулды пакетке салып қойып, содан кейін шығып кететін.
  //    Нәтижесінде түрі жарияланбаған үш бөлік қалып, Word файлды
  //    «бүлінген» деп санайтын.
  let rels = entries.find((e) => e.name === "word/_rels/document.xml.rels");
  if (!rels) {
    rels = {
      name: "word/_rels/document.xml.rels",
      data: new TextEncoder().encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `</Relationships>`
      ),
    };
    entries.push(rels);
  }

  // 3. Бөліктердің түрін жариялау. Бұл қадамсыз Word файлды ашпайды.
  const ct = entries.find((e) => e.name === "[Content_Types].xml");
  if (!ct) return;
  let ctXml = decode(ct);
  if (!/Extension="png"/i.test(ctXml)) {
    ctXml = ctXml.replace(
      /(<Types[^>]*>)/,
      '$1<Default Extension="png" ContentType="image/png"/>'
    );
  }
  if (!ctXml.includes('PartName="/word/ziro-header.xml"')) {
    ctXml = ctXml.replace(
      "</Types>",
      '<Override PartName="/word/ziro-header.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
        '<Override PartName="/word/ziro-footer.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
        "</Types>"
    );
  }

  // 4. Бәрі дайын — енді ғана пакетке жазамыз.
  const logoRelId = "rIdZiroLogo";
  entries.push({ name: LOGO, data: logoBytes });
  entries.push({
    name: "word/_rels/ziro-header.xml.rels",
    data: new TextEncoder().encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="${logoRelId}" Type="${R}/image" Target="media/ziro-logo.png"/>
</Relationships>`
    ),
  });
  entries.push({ name: HDR, data: new TextEncoder().encode(headerXml(title, logoRelId)) });
  entries.push({ name: FTR, data: new TextEncoder().encode(footerXml()) });

  encodeInto(ct, ctXml);

  let relsXml = decode(rels);
  const n = nextRelId(relsXml);
  const hdrId = `rId${n}`;
  const ftrId = `rId${n + 1}`;
  relsXml = relsXml.replace(
    "</Relationships>",
    `<Relationship Id="${hdrId}" Type="${R}/header" Target="ziro-header.xml"/>` +
      `<Relationship Id="${ftrId}" Type="${R}/footer" Target="ziro-footer.xml"/>` +
      "</Relationships>"
  );
  encodeInto(rels, relsXml);

  // 5. document.xml түбірі r кеңістігін жариялауы керек, әйтпесе
  //    sectPr ішіндегі r:id-ді ешнәрсеге байлауға болмайды.
  const root = doc.documentElement;
  if (!root.getAttribute("xmlns:r")) {
    root.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:r", R);
  }

  // 6. sectPr: колонтитулға сілтемелер ең басында тұруы тиіс.
  //    Барлық бөлімді өңдейміз — файлда бөлім үзілісі болуы мүмкін.
  const sects = Array.from(body.getElementsByTagNameNS(W, "sectPr"));
  if (sects.length === 0) {
    const s = doc.createElementNS(W, "w:sectPr");
    body.appendChild(s);
    sects.push(s);
  }

  const mk = (tag: string, id: string) => {
    const el = doc.createElementNS(W, `w:${tag}`);
    el.setAttributeNS(W, "w:type", "default");
    el.setAttributeNS(R, "r:id", id);
    return el;
  };

  for (const sectPr of sects) {
    for (const tag of ["headerReference", "footerReference", "titlePg"]) {
      for (const el of Array.from(sectPr.getElementsByTagNameNS(W, tag))) {
        el.parentNode?.removeChild(el);
      }
    }

    // pgMar: header, footer, gutter схема бойынша міндетті. Оларсыз Word
    // колонтитулды беттің шетінен қай қашықтықта басатынын білмейді.
    const pgMar = sectPr.getElementsByTagNameNS(W, "pgMar")[0];
    if (pgMar) {
      for (const [name, val] of [["header", "709"], ["footer", "709"], ["gutter", "0"]]) {
        if (!pgMar.getAttributeNS(W, name)) pgMar.setAttributeNS(W, `w:${name}`, val);
      }
    }

    sectPr.insertBefore(mk("footerReference", ftrId), sectPr.firstChild);
    sectPr.insertBefore(mk("headerReference", hdrId), sectPr.firstChild);
  }
}

/**
 * Сұрақты жауаптарынан ажыратпау.
 *
 * Word-та екі бөлек қасиет бар, екеуі де керек:
 *   • keepNext — абзац келесі абзацпен бір бетте қалады. Сұрақ пен жауап
 *     нұсқаларын бір-бірінен ажыратпайды.
 *   • keepLines — абзацтың ӨЗІ екі бетке бөлінбейді. Ұзын сұрақтың мәтіні
 *     жартылай төменгі бетте, жартылай келесі бетте қалмауы үшін керек.
 *
 * Алғашында тек keepNext қойылған еді, сондықтан блоктар бүтін көшкенімен,
 * ұзын сұрақтың өз мәтіні қақ бөлініп қалатын.
 *
 * keepNext соңғы нұсқаға қойылмайды: әйтпесе келесі сұрақ та жабысып,
 * бүкіл құжат бір бетке тартылып кетер еді. keepLines болса әр абзацқа
 * қойылады — ол көршісіне әсер етпейді.
 */
function keepBlocksTogether(
  doc: Document,
  keep: Element[],
  starts: Set<Element>,
  spaceStarts: Set<Element>
): void {
  const blocks: Element[][] = [];
  let cur: Element[] = [];
  for (const el of keep) {
    if (starts.has(el) && cur.length) {
      blocks.push(cur);
      cur = [];
    }
    cur.push(el);
  }
  if (cur.length) blocks.push(cur);

  const setSpaceBefore = (d: Document, el: Element, twips: number) => {
    if (el.localName !== "p") return;
    let pPr = Array.from(el.children).find((c) => c.localName === "pPr");
    if (!pPr) {
      pPr = d.createElementNS(W, "w:pPr");
      el.insertBefore(pPr, el.firstChild);
    }
    let spacing = Array.from(pPr.children).find((c) => c.localName === "spacing");
    if (!spacing) {
      spacing = d.createElementNS(W, "w:spacing");
      pPr.appendChild(spacing);
    }
    spacing.setAttributeNS(W, "w:before", String(twips));
  };

  const addFlag = (el: Element, name: "keepNext" | "keepLines") => {
    if (el.localName !== "p") return;
    let pPr = Array.from(el.children).find((c) => c.localName === "pPr");
    if (!pPr) {
      pPr = doc.createElementNS(W, "w:pPr");
      el.insertBefore(pPr, el.firstChild);
    }
    if (!Array.from(pPr.children).some((c) => c.localName === name)) {
      pPr.insertBefore(doc.createElementNS(W, `w:${name}`), pPr.firstChild);
    }
  };

  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    const last = block.length - 1;

    for (let i = 0; i <= last; i++) {
      addFlag(block[i], "keepLines");
      if (i < last) addFlag(block[i], "keepNext");
    }

    // Сұрақтардың арасындағы аралық — бос жолмен емес, аралықпен.
    // Бос жол бет ауысқанда жоғарыда жалғыз қалып қоюы мүмкін, ал
    // аралық олай істемейді: ол жай ғана сұрақты жоғарғысынан
    // алыстатады. Бірінші сұраққа қойылмайды — беттің басында керегі жоқ.
    // Аралық блоктың басына емес, аралық керек әр абзацқа қойылады:
    // мәтінге тиесілі сұрақтар бір блоктың ішінде тұрса да, бір-бірінен
    // алшақ болуы тиіс. Бірінші абзацқа қойылмайды — беттің басында
    // керегі жоқ.
    for (let i = 0; i <= last; i++) {
      if (b === 0 && i === 0) continue;
      if (spaceStarts.has(block[i])) setSpaceBefore(doc, block[i], 240); // 12 пункт
    }
  }
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

type ZipEntry = { name: string; data: Uint8Array };

async function readZipEntries(file: File): Promise<ZipEntry[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(data.buffer);

  let eocd = -1;
  for (let i = data.length - 22; i >= 0 && i > data.length - 66000; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Бұл docx файл емес сияқты.");

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = new TextDecoder().decode(data.subarray(ptr + 46, ptr + 46 + nameLen));

    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = data.subarray(start, start + compSize);
    entries.push({ name, data: method === 0 ? raw : await inflateRaw(raw) });

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// CRC-32 — zip үшін қажет.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function writeZip(entries: ZipEntry[]): Promise<Blob> {
  // OPC пакетінде каталог жазбалары болмауы керек.
  entries = entries.filter((e) => !e.name.endsWith("/"));
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = new TextEncoder().encode(e.name);
    const compressed = await deflateRaw(e.data);
    const crc = crc32(e.data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 8, true); // deflate
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, e.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    chunks.push(local, compressed);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compressed.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + compressed.length;
  }

  const centralSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, end] as BlobPart[], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// ---------------------------------------------------------------
// Тазалау
// ---------------------------------------------------------------

const TAG_RE = /^\[([^\]]+)\]\s*([\s\S]*)$/;

/** Word-тың формулалары бөлек кеңістікте сақталады. */
const M = "http://schemas.openxmlformats.org/officeDocument/2006/math";

function paragraphText(p: Element): string {
  return Array.from(p.getElementsByTagNameNS(W, "t"))
    .map((t) => t.textContent ?? "")
    .join("")
    .trim();
}

/**
 * Абзацта формула бар ма.
 *
 * Неге керек: paragraphText тек әдеттегі мәтінді санайды, формула оған
 * көрінбейді. Сондықтан мәтіні жоқ, тек формуладан тұратын сұрақ «бос
 * абзац» болып саналып, нөмірі қойылмай қалатын. Дәл сол себепті 25, 26
 * және 40-сұрақтардың нөмірі жоғалған еді — қалған 37-де формуланың
 * жанында сөз бар, сол сөз абзацты «толық» етіп көрсеткен.
 */
function hasMath(p: Element): boolean {
  return (
    p.getElementsByTagNameNS(M, "oMath").length > 0 ||
    p.getElementsByTagNameNS(M, "oMathPara").length > 0
  );
}

/**
 * Жеке жолда тұрған формуланы (oMathPara) жол ішіндегі формулаға (oMath)
 * айналдырады.
 *
 * oMathPara — бұл «өз жолы бар» формула: Word оны бүкіл жолға жайып,
 * ортаға тұрғызады, сондықтан нөмір оның қасына сыймайды. Ішіндегі
 * oMath-ты сыртқа шығарсақ, формула жолдың бір бөлігі болады да, нөмір
 * сол жолда қалады. Формуланың өзі өзгермейді.
 */
function inlineMathParas(p: Element): void {
  for (const para of Array.from(p.getElementsByTagNameNS(M, "oMathPara"))) {
    const parent = para.parentNode;
    if (!parent) continue;
    for (const child of Array.from(para.getElementsByTagNameNS(M, "oMath"))) {
      parent.insertBefore(child, para);
    }
    parent.removeChild(para);
  }
}

/** Абзац тек бет үзілімінен тұра ма? */
function isPageBreakOnly(p: Element): boolean {
  const breaks = Array.from(p.getElementsByTagNameNS(W, "br")).filter(
    (b) => b.getAttributeNS(W, "type") === "page" || b.getAttribute("w:type") === "page"
  );
  return breaks.length > 0 && paragraphText(p) === "";
}

function hasImage(p: Element): boolean {
  return (
    p.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "*").length > 0 ||
    p.getElementsByTagName("w:drawing").length > 0 ||
    p.getElementsByTagName("w:pict").length > 0
  );
}

/**
 * Абзац басындағы [X] белгісін өшіріп, орнына replacement қояды.
 * Word белгіні бөліп жазуы мүмкін ("[", "B", "]5"), сондықтан бүкіл
 * мәтін бойынша есептеп, әріптерді бөліктерден ретімен қиямыз.
 */
function stripTagPrefix(p: Element, replacement: string) {
  const runs = Array.from(p.getElementsByTagNameNS(W, "t"));
  const full = runs.map((t) => t.textContent ?? "").join("");
  const m = full.match(/^\s*\[[^\]]*\]\s*/);
  if (!m) return;

  let remove = m[0].length;
  for (const t of runs) {
    const s = t.textContent ?? "";
    if (remove <= 0) break;
    if (s.length <= remove) {
      remove -= s.length;
      t.textContent = "";
    } else {
      t.textContent = s.slice(remove);
      remove = 0;
    }
  }
  if (replacement && runs.length > 0) {
    runs[0].textContent = replacement + (runs[0].textContent ?? "");
    runs[0].setAttributeNS(XML_SPACE, "xml:space", "preserve");
  }
}

function makeNumberRun(doc: Document, text: string): Element {
  const r = doc.createElementNS(W, "w:r");
  const t = doc.createElementNS(W, "w:t");
  t.setAttributeNS(XML_SPACE, "xml:space", "preserve");
  t.textContent = text;
  r.appendChild(t);
  return r;
}

/** Бір тілге арналған таза көшірме жасайды. */
export async function buildCleanDocx(
  file: File,
  lang: "kk" | "ru",
  /** Колонтитулда шығатын жазу, мысалы «Математика — 1-нұсқа». */
  headerTitle?: string
): Promise<Blob> {
  const entries = await readZipEntries(file);
  const docEntry = entries.find((e) => e.name === "word/document.xml");
  if (!docEntry) throw new Error("Файл ішінен word/document.xml табылмады.");

  const xml = new TextDecoder("utf-8").decode(docEntry.data);
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  if (!body) throw new Error("Құжаттың құрылымы танылмады.");

  // Сандық сипаттама — бөлек жиналады: тізім емес, кесте керек.
  // Файлда [A_баған] белгісі болса, сол пән деп танимыз.
  const isQuantity = /\[\s*[ABab]_(баған|bagan)\s*\]/.test(
    Array.from(body.getElementsByTagNameNS(W, "t"))
      .map((t) => t.textContent ?? "")
      .join("\n")
  );
  if (isQuantity) {
    return buildQuantityDoc(entries, doc, body, lang, headerTitle);
  }

  const keep: Element[] = [];
  let mode: "header" | "await" | "kk" | "ru" | "passage" = "header";
  let pendingNumber: string | null = null;
  // Оқылым мәтінінің ішінде тұрмыз ба.
  //
  // Неге керек: блок келесі сұрақ басталғанша созылады, ал мәтіннің
  // абзацтары сұрақтың басы болып саналмайтын. Сондықтан бүкіл мәтін
  // алдындағы сұрақтың блогына жабысып, Word оларды бір бүтін ретінде
  // тасымалдайтын: беттің төменінде орын болса да, сұрақ мәтінмен бірге
  // келесі бетке кетіп қалатын.
  let inPassage = false;
  /** Сұрақ басталатын абзацтар — блокты бөлу үшін. */
  // Екі бөлек жиын:
  //   spaceStarts — алдына аралық қойылатын абзацтар (әр сұрақ, әр мәтін);
  //   blockStarts — бет ауысуы мүмкін жерлер.
  // Бұрын біреу болатын, сондықтан «аралық керек» пен «бетті үзуге болады»
  // бір нәрсе болып шыққан. Мәтін мен оның сұрақтарын бір бетте ұстау үшін
  // оларды ажырату қажет: аралық бар, ал үзілу жоқ.
  const spaceStarts = new Set<Element>();
  const blockStarts = new Set<Element>();
  const questionStarts = {
    add(el: Element) {
      spaceStarts.add(el);
      blockStarts.add(el);
    },
  };
  // Суреттер екі тілде де болуы мүмкін: [kk] блогында қазақшасы, [ru]
  // блогында орысшасы — өйткені суреттегі жазулар аударылмайды.
  //
  // Ереже: осы тілдің өз суреті болса, соны ғана аламыз. Болмаса — басқа
  // тілдегісін аламыз (таза сызба, жазуы жоқ жағдай). Бұрын басқа тілдегі
  // сурет әрқашан қосылатын, сондықтан екі суреті бар сұрақта екеуі де
  // бір параққа түсіп қалатын.
  let otherLangImages: Element[] = [];
  let keptImageInQuestion = false;

  for (const el of Array.from(body.children)) {
    if (el.localName !== "p") {
      keep.push(el);
      continue;
    }

    const text = paragraphText(el);
    const m = text.match(TAG_RE);
    const key = m ? m[1].trim().toLowerCase() : null;

    if (key) {
      if (/^question\s*\d+$/.test(key)) {
        // Сұрақ мәтіні табылмай қалса да сурет жоғалмасын.
        if (otherLangImages.length > 0 && !keptImageInQuestion) keep.push(...otherLangImages);
        otherLangImages = [];
        keptImageInQuestion = false;
        pendingNumber = `${key.match(/\d+/)![0]}. `;
        mode = "await";
        continue;
      }
      if (["kk", "қаз", "каз"].includes(key)) {
        mode = "kk";
        continue;
      }
      if (["ru", "рус"].includes(key)) {
        mode = "ru";
        continue;
      }
      if (["тақырып", "тема", "topic", "right_answer", "дұрыс_жауап"].includes(key)) continue;
      if (/^(нұсқа|нускa|нуска|вариант|variant)\s*\d+$/.test(key)) continue;

      if (/^[abcd]$/.test(key)) {
        if ((mode === "kk" || mode === "ru") && mode !== lang) continue;
        stripTagPrefix(el, key.toUpperCase() + ") ");
        keep.push(el);
        continue;
      }
      if (/^[ab]_(баған|bagan)$/.test(key)) {
        if ((mode === "kk" || mode === "ru") && mode !== lang) continue;
        // Сандықта сұрақтың жеке мәтіні жоқ: [question12]-ден кейін бірден
        // бағандар келеді. Сондықтан нөмір А бағанының алдына қойылады —
        // әйтпесе қоятын жер табылмай, барлық сұрақ нөмірсіз шығатын.
        const isFirstColumn = key.startsWith("a");
        stripTagPrefix(
          el,
          (pendingNumber && isFirstColumn ? pendingNumber : "") +
            key[0].toUpperCase() + ") "
        );
        if (pendingNumber && isFirstColumn) {
          questionStarts.add(el);
          pendingNumber = null;
        }
        keep.push(el);
        continue;
      }
      if (/^(мәтін|матин|текст|passage)\s*\d+$/.test(key)) {
        stripTagPrefix(el, "");
        spaceStarts.add(el);
        blockStarts.add(el);
        keep.push(el);
        mode = "passage";
        inPassage = true;
        continue;
      }
      // Танылмаған, бірақ жалғыз тұрған белгі — сессия аты, пән аты.
      if (/^\[[^\]]+\]$/.test(text.trim())) continue;
      if (mode === "header") continue;
    }

    if ((mode === "kk" || mode === "ru") && mode !== lang) {
      // Басқа тілдің суретін бірден қоспаймыз — өз тілімізде суреті бар-жоғы
      // белгісіз. Сұрақ біткенде ғана шешеміз.
      if (hasImage(el)) otherLangImages.push(el);
      continue;
    }
    if (mode === "header") continue;

    // Бет үзілімдері екі тілде бірдей болуы үшін алынып тасталады —
    // беттің бөлінуін пайдаланушы өзі қайта қояды.
    if (isPageBreakOnly(el)) continue;

    // Сұрақтың ішіндегі бос жолдар алынып тасталады.
    //
    // Неге: бастапқы файлда бос жол әдетте шарт пен жауаптардың арасында
    // тұрады, ал сұрақтар бір-біріне жабысып қалады — көзбен қарағанда
    // қайсысы қай сұрақтікі екені білінбейді. Дұрысы керісінше: шарт пен
    // жауаптар тығыз, ал сұрақтардың арасы бос. Сондықтан ішкі бос
    // жолдарды алып тастап, сұрақтың алдына аралық қоямыз (төменде,
    // keepBlocksTogether ішінде).
    //
    // Бос жол — мәтіні де, суреті де, формуласы да жоқ абзац.
    if (!paragraphText(el) && !hasImage(el) && !hasMath(el)) continue;

    // Сұрақтың басы — мәтін де, формула да, сурет те бола алады.
    // Бұрын тек мәтін есептелетін, сондықтан жалғыз формуладан тұратын
    // сұрақтың нөмірі қойылмай, кезекте ілініп қалатын.
    const elHasMath = hasMath(el);
    const elHasImage = hasImage(el);
    const isQuestionStart = Boolean(pendingNumber) && (Boolean(text) || elHasMath || elHasImage);

    if (isQuestionStart) {
      if (!text && !elHasMath && elHasImage) {
        // Тек суреттен тұратын сұрақ: нөмірді суреттің үстіне, бөлек жолға.
        // Суреттің қасына қоюға болмайды — ол жолға сыймай, нөмір ығысады.
        const numberPara = doc.createElementNS(W, "w:p");
        numberPara.appendChild(makeNumberRun(doc, pendingNumber!));
        questionStarts.add(numberPara);
        keep.push(numberPara);
      } else {
        // Жеке жолдағы формуланы жол ішіне түсіреміз — сонда нөмір
        // формуланың қасында, бір жолда тұрады.
        if (elHasMath) inlineMathParas(el);
        const run = makeNumberRun(doc, pendingNumber!);
        const first = el.firstElementChild;
        if (first && first.localName === "pPr") el.insertBefore(run, first.nextSibling);
        else el.insertBefore(run, el.firstChild);
        questionStarts.add(el);
      }
      // Мәтінге тиесілі сұрақ блокты үзбейді: мәтін мен оның сұрақтары
      // бір бетте қалуы керек. Бірақ алдында аралық болуы тиіс, сондықтан
      // ол spaceStarts-қа түседі.
      if (inPassage) blockStarts.delete(el);
      pendingNumber = null;
    }

    if (elHasImage) keptImageInQuestion = true;
    keep.push(el);

    // Өз тілінде суреті болса, басқа тілдегісі керек емес.
    if (keptImageInQuestion) otherLangImages = [];
  }

  // Соңғы сұрақ: өз тілінде суреті болмаса, басқа тілдегісін қосамыз.
  if (otherLangImages.length > 0 && !keptImageInQuestion) keep.push(...otherLangImages);

  keepBlocksTogether(doc, keep, blockStarts, spaceStarts);

  while (body.firstChild) body.removeChild(body.firstChild);
  keep.forEach((el) => body.appendChild(el));

  if (headerTitle) await addHeaderFooter(entries, doc, body, headerTitle);

  const out = new XMLSerializer().serializeToString(doc);
  docEntry.data = new TextEncoder().encode(out);

  return writeZip(entries);
}


/**
 * Сандық сипаттаманың баспа нұсқасы — кесте түрінде.
 *
 * Файлды сұрақтарға бөліп, әрқайсысынан үш бөлікті жинаймыз: шарт (болса),
 * А бағаны, В бағаны. Содан кейін бәрін бір кестеге саламыз.
 *
 * Тілі бөлек: [kk] блогынан тек қазақшасы, [ru] блогынан тек орысшасы
 * алынады — екеуі бір ұяшыққа қосылмайды.
 */
async function buildQuantityDoc(
  entries: ZipEntry[],
  doc: Document,
  body: Element,
  lang: "kk" | "ru",
  headerTitle?: string
): Promise<Blob> {
  const rows: QRow[] = [];
  let cur: QRow | null = null;
  let mode: "header" | "await" | "kk" | "ru" = "header";
  /** Қай бөлікке жазып отырмыз: шарт, А немесе В. */
  let slot: "condition" | "a" | "b" = "condition";

  const flush = () => {
    if (cur) rows.push(cur);
    cur = null;
  };

  for (const el of Array.from(body.children)) {
    if (el.localName !== "p") continue;

    const text = paragraphText(el);
    const m = text.match(TAG_RE);
    const key = m ? m[1].trim().toLowerCase() : null;

    if (key) {
      if (/^question\s*\d+$/.test(key)) {
        flush();
        cur = { number: `${key.match(/\d+/)![0]}.`, condition: [], colA: [], colB: [] };
        mode = "await";
        slot = "condition";
        continue;
      }
      if (["kk", "қаз", "каз"].includes(key)) { mode = "kk"; slot = "condition"; continue; }
      if (["ru", "рус"].includes(key)) { mode = "ru"; slot = "condition"; continue; }
      if (/^[ab]_(баған|bagan)$/.test(key)) {
        if (mode !== lang) continue;
        slot = key.startsWith("a") ? "a" : "b";
        // Белгіні алып тастап, қалғанын сол ұяшыққа саламыз.
        stripTagPrefix(el, "");
        if (paragraphText(el) || hasImage(el) || hasMath(el)) {
          (slot === "a" ? cur!.colA : cur!.colB).push(el);
        }
        continue;
      }
      // Қалған белгілер — тақырып, дұрыс жауап, сессия аты — керек емес.
      continue;
    }

    if (mode !== lang || !cur) continue;
    if (isPageBreakOnly(el)) continue;
    if (!paragraphText(el) && !hasImage(el) && !hasMath(el)) continue;

    // Белгіден кейінгі жалғасы: сурет немесе қосымша жол сол ұяшыққа.
    if (slot === "a") cur.colA.push(el);
    else if (slot === "b") cur.colB.push(el);
    else cur.condition.push(el);
  }
  flush();

  const table = buildQuantityTable(doc, rows, lang);

  const sect = Array.from(body.children).filter((c) => c.localName === "sectPr");
  while (body.firstChild) body.removeChild(body.firstChild);
  body.appendChild(table);
  // Кестеден кейін бос абзац керек — Word талабы.
  body.appendChild(doc.createElementNS(W, "w:p"));
  for (const sp of sect) body.appendChild(sp);

  if (headerTitle) await addHeaderFooter(entries, doc, body, headerTitle);

  const docEntry = entries.find((e) => e.name === "word/document.xml")!;
  docEntry.data = new TextEncoder().encode(new XMLSerializer().serializeToString(doc));
  return writeZip(entries);
}
