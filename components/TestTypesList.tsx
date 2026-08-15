import Link from "next/link";

type Stage = { subject: string; questions: number; minutes: number; format: string };
type TestType = {
  id: string;
  code: string;
  name_kk: string;
  name_ru: string;
  stages: Stage[];
  scoring_scheme: string;
};

export default function TestTypesList({ testTypes }: { testTypes: TestType[] }) {
  if (testTypes.length === 0) {
    return <p className="text-sm text-ink/50">Әзірге тест түрі жоқ.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {testTypes.map((tt) => (
        <div key={tt.id} className="rounded-xl border border-ink/10 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink">
              {tt.name_kk} / {tt.name_ru}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink/40">{tt.code}</span>
              <Link
                href={`/admin/test-types/${tt.id}`}
                className="focus-ring rounded-full border border-admin/30 px-3 py-1 text-xs font-semibold text-admin hover:bg-admin-soft"
              >
                Жауап парағы
              </Link>
            </div>
          </div>
          <p className="mt-1 text-sm text-ink/50">
            {tt.stages.map((s) => `${s.subject} (${s.questions})`).join(" · ")}
          </p>
        </div>
      ))}
    </div>
  );
}
