"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AnswerSheetLayout from "@/components/AnswerSheetLayout";

type TestType = {
  id: string;
  name_kk: string;
  name_ru: string;
  stages: { subject: string; questions: number; minutes: number; format: "abcd" | "number" }[];
};

export default function AnswerSheetPage() {
  const params = useParams();
  const router = useRouter();
  const [testType, setTestType] = useState<TestType | null>(null);

  useEffect(() => {
    supabase
      .from("test_types")
      .select("id, name_kk, name_ru, stages")
      .eq("id", params.id)
      .single()
      .then(({ data }) => setTestType(data));
  }, [params.id]);

  if (!testType) {
    return <p className="text-ink/50">Жүктелуде...</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <button
          onClick={() => router.back()}
          className="focus-ring text-sm font-medium text-ink/60 hover:text-ink"
        >
          ← Артқа
        </button>
        <button
          onClick={() => window.print()}
          className="focus-ring rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Басып шығару
        </button>
      </div>

      <AnswerSheetLayout
        title={`${testType.name_kk} / ${testType.name_ru}`}
        stages={testType.stages}
      />
    </div>
  );
}
