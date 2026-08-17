import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getProfile, blockKeyFor } from "@/lib/docxTest/profiles";
import { extractParagraphs, parseItems } from "@/lib/docxTest/parse";
import { buildVariant } from "@/lib/docxTest/shuffle";
import { buildVariantBody, buildAnswerKeySection } from "@/lib/docxTest/generate";
import { packageDocx } from "@/lib/docxTest/packageDocx";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const nameWord = String(form.get("name_word") ?? "").trim();
    const profileId = String(form.get("profile_id") ?? "");
    const lang = (String(form.get("lang") ?? "kk") === "ru" ? "ru" : "kk") as "kk" | "ru";

    if (!file || !nameWord || !profileId) {
      return NextResponse.json(
        { error: "Файл, атауы (NAME_WORD) және профиль міндетті." },
        { status: 400 }
      );
    }

    const profile = getProfile(profileId);
    if (!profile) {
      return NextResponse.json({ error: "Белгісіз профиль." }, { status: 400 });
    }
    if (profile.answerFormat === "quantity") {
      return NextResponse.json(
        { error: "«НИШ Сандық» профилі әзірге қолжетімсіз — жақын арада қосылады." },
        { status: 400 }
      );
    }

    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const originalZip = await JSZip.loadAsync(originalBuffer);
    const documentXmlFile = originalZip.file("word/document.xml");
    if (!documentXmlFile) {
      return NextResponse.json({ error: "Файлдан word/document.xml табылмады." }, { status: 400 });
    }
    const documentXml = await documentXmlFile.async("string");

    const paragraphs = extractParagraphs(documentXml);
    const items = parseItems(paragraphs, (n) => blockKeyFor(profile, n));

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Файлдан бірде-бір ziroquestion белгісі табылмады. Форматты тексеріңіз." },
        { status: 400 }
      );
    }

    const outputZip = new JSZip();

    for (let variantNumber = 1; variantNumber <= 4; variantNumber++) {
      const variantItems = buildVariant(items, variantNumber);
      const { bodyXml, answerKey } = buildVariantBody(variantItems, {
        nameWord,
        variantNumber,
        lang,
        answerFormat: profile.answerFormat,
      });
      const keySection = buildAnswerKeySection(lang, variantNumber, answerKey);
      const fullBody = bodyXml + keySection;

      const docxBuffer = await packageDocx(originalBuffer, fullBody);
      outputZip.file(`${nameWord}-Variant-${variantNumber}.docx`, docxBuffer);
    }

    const zipBuffer = await outputZip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${nameWord || "variants"}.zip"`,
      },
    });
  } catch (err: any) {
    console.error("generate-test-variants error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Белгісіз қате орын алды." },
      { status: 500 }
    );
  }
}
