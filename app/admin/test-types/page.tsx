"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import TestTypesList from "@/components/TestTypesList";
import CreateTestTypeForm from "@/components/CreateTestTypeForm";

type Stage = { subject: string; questions: number; minutes: number; format: string };
type TestType = {
  id: string;
  code: string;
  name_kk: string;
  name_ru: string;
  stages: Stage[];
  scoring_scheme: string;
};

export default function TestTypesPage() {
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [editing, setEditing] = useState<TestType | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("test_types")
      .select("id, code, name_kk, name_ru, stages, scoring_scheme")
      .order("created_at", { ascending: false });
    setTestTypes(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    await supabase.from("test_types").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Тест түрлері</h1>

      <div className="mt-6">
        <TestTypesList
          testTypes={testTypes}
          onEdit={(tt) => setEditing(tt)}
          onDelete={handleDelete}
        />
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-bold text-ink">
          {editing ? "Тест түрін өзгерту" : "Жаңа тест түрі"}
        </h2>
        <div className="mt-4">
          <CreateTestTypeForm
            editing={editing}
            onCancelEdit={() => setEditing(null)}
            onCreated={() => {
              setEditing(null);
              load();
            }}
          />
        </div>
      </div>
    </div>
  );
}
