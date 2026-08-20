"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";
import { buildVariantDocxBlob, type BankItem, type VariantSlot } from "@/lib/questionBank/buildVariantDocx";

type TestInfo = { id: string; code: string; title: string; profile_id: string; status: string };

export default function QuestionBankTestPage() {
  const params = useParams();
  const testId = params.testId as string;

  const [test, setTest] = useState<TestInfo | null>(null);
  const [items, setItems] = useState<BankItem[]>([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase
        .from("question_bank_tests")
        .select("id, code, title, profile_id, status")
        .eq("id", testId)
        .single();
      setTest(t);

      const { data: its } = await supabase
        .from("question_bank_items")
        .select("id, question_number, text_kk, text_ru, answer_format, choices, image_svg")
        .eq("test_id", testId)
        .order("question_number");
      setItems(its ?? []);

      const { data: vs } = await supabase
        .from("question_bank_variant_sets")
        .select("id")
        .eq("test_id", testId)
        .limit(1)
        .maybeSingle();
      setHasVariants(!!vs);

      setLoading(false);
    }
    load();
  }, [testId]);

  async function handleDownloadAll() {
    if (!test) return;
    setDownloading(true);
    setError("");

    try {
      const { data: vs } = await supabase
        .from("question_bank_variant_sets")
        .select("mapping")
        .eq("test_id", testId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!vs) {
        setError("Бұл тест үшін пересортировка кілті жоқ.");
        setDownloading(false);
        return;
      }

      const mapping = vs.mapping as Record<string, VariantSlot[]>;
      const itemsByNumber = new Map<number, BankItem>(items.map((it) => [it.question_number, it]));

      const zip = new JSZip();

      for (const variantNumber of [1, 2, 3, 4]) {
        const slots = mapping[String(variantNumber)];
        if (!slots) continue;

        for (const lang of ["kk", "ru"] as const) {
          const blob = await buildVariantDocxBlob({
            nameWord: test.title,
            variantNumber,
            lang,
            slots,
            itemsByNumber,
          });
          const langLabel = lang === "kk" ? "kaz" : "rus";
          zip.file(`${test.code}-variant${variantNumber}-${langLabel}.docx`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${test.code}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message ?? "Қате шықты.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <main className="p-10 text-ink/50">Жүктелуде...</main>;
  if (!test) return <main className="p-10 text-ink/70">Тест табылмады.</main>;

  return (
    <div>
      <Link href="/admin/question-bank" className="text-sm text-ink/50 hover:underline">
        ← Сұрақтар банкі
      </Link>
      <h1 className="font-display text-2xl font-bold text-admin">{test.title}</h1>
      <p className="mt-2 text-sm text-ink/60">
        {test.code} · {items.length} сұрақ
      </p>

      <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
        {!hasVariants && (
          <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Бұл тест үшін пересортировка кілті әлі есептелмеген — жүктеу қолжетімсіз.
          </p>
        )}
        <button
          onClick={handleDownloadAll}
          disabled={downloading || !hasVariants}
          className="focus-ring rounded-full bg-admin px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {downloading ? "Жасалуда..." : "8 файл жүктеу (4 нұсқа × 2 тіл)"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
