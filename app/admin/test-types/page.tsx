"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import CreateTestTypeForm from "@/components/CreateTestTypeForm";
import TestTypesList from "@/components/TestTypesList";

type TestType = {
  id: string;
  code: string;
  name_kk: string;
  name_ru: string;
  stages: any[];
  scoring_scheme: string;
};

export default function AdminTestTypesPage() {
  const [testTypes, setTestTypes] = useState<TestType[]>([]);

  const loadTestTypes = useCallback(async () => {
    const { data } = await supabase
      .from("test_types")
      .select("id, code, name_kk, name_ru, stages, scoring_scheme")
      .order("created_at", { ascending: false });
    setTestTypes(data ?? []);
  }, []);

  useEffect(() => {
    loadTestTypes();
  }, [loadTestTypes]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">
        Тест түрлері
      </h1>

      <section className="mt-8">
        <TestTypesList testTypes={testTypes} />
      </section>

      <section className="mt-6">
        <CreateTestTypeForm onCreated={loadTestTypes} />
      </section>
    </div>
  );
}
