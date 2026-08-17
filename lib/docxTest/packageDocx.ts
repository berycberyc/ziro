import JSZip from "jszip";

/**
 * Takes the original uploaded docx (as a Buffer), replaces the body content
 * of word/document.xml with newBodyXml (keeping the original sectPr/page
 * setup that follows the body), and returns the new docx as a Buffer.
 * All other parts of the zip (styles, media/images, embedded formula
 * relationships) are carried over unchanged.
 */
export async function packageDocx(originalBuffer: Buffer, newBodyXml: string): Promise<Buffer> {
  const zip = await JSZip.loadAsync(originalBuffer);
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("word/document.xml not found in uploaded file");
  }
  const originalXml = await documentXmlFile.async("string");

  const bodyMatch = originalXml.match(/<w:body>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) {
    throw new Error("Could not locate <w:body> in document.xml");
  }

  // Keep the final sectPr (page size/margins) if present at the end of the body.
  const sectPrMatch = bodyMatch[1].match(/<w:sectPr[\s\S]*?<\/w:sectPr>\s*$/);
  const sectPr = sectPrMatch ? sectPrMatch[0] : "";

  const newXml = originalXml.replace(
    /<w:body>[\s\S]*<\/w:body>/,
    `<w:body>${newBodyXml}${sectPr}</w:body>`
  );

  zip.file("word/document.xml", newXml);
  const out = await zip.generateAsync({ type: "nodebuffer" });
  return out;
}
