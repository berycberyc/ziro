"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";
import { buildVariantDocxBlob, type BankItem } from "@/lib/questionBank/buildVariantDocx";

type TestInfo = { id: string; code: string; title: string; profile_id: string; status: string };
type BankItemWithVariant = BankItem & { variant_number: number };

export default function QuestionBankTestPage() {
  const params = useParams();
  const testId = params.testId as string;

  const [test, setTest] = useState<TestInfo | null>(null);
  const [items, setItems] = useState<BankItemWithVariant[]>([]);
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
        .select("id, question_number, text_kk, text_ru, answer_format, choices, image_svg, variant_number")
        .eq("test_id", testId)
        .order("variant_number")
        .order("question_number");
      setItems((its ?? []) as BankItemWithVariant[]);

      setLoading(false);
    }
    load();
  }, [testId]);

  const variantCounts = [1, 2, 3, 4].map((v) => ({
    variant: v,
    count: items.filter((it) => it.variant_number === v).length,
  }));
  const allVariantsReady = variantCounts.every((v) => v.count > 0);

  async function handleDownloadAll() {
    if (!test) return;
    setDownloading(true);
    setError("");

    try {
      const zip = new JSZip();

      for (const variantNumber of [1, 2, 3, 4]) {
        const variantItems = items.filter((it) => it.variant_number === variantNumber);
        if (variantItems.length === 0) continue;

        for (const lang of ["kk", "ru"] as const) {
          const blob = await buildVariantDocxBlob({
            nameWord: test.title,
            variantNumber,
            lang,
            items: variantItems,
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
      <p className="mt-2 text-sm text-ink/60">{test.code}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {variantCounts.map((v) => (
          <span
            key={v.variant}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              v.count > 0 ? "bg-parent-soft text-parent" : "bg-red-50 text-red-700"
            }`}
          >
            Нұсқа {v.variant}: {v.count} сұрақ
          </span>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
        {!allVariantsReady && (
          <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Барлық 4 нұсқа әлі толтырылмаған — жүктеу қолжетімсіз.
          </p>
        )}
        <button
          onClick={handleDownloadAll}
          disabled={downloading || !allVariantsReady}
          className="focus-ring rounded-full bg-admin px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {downloading ? "Жасалуда..." : "8 файл жүктеу (4 нұсқа × 2 тіл)"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
