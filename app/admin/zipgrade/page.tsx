"use client";

import { useEffect, useState } from "react";

type QuizRow = { id: string; name: string; date: string; questions: number };

export default function ZipGradePage() {
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/zipgrade/quizzes")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setQuizzes(data.quizzes ?? []);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message ?? "Белгісіз қате");
        setLoading(false);
      });
  }, []);

  async function handleExport(quizId: string) {
    setDownloadingId(quizId);
    setError("");
    try {
      const res = await fetch(`/api/zipgrade/export?quizId=${encodeURIComponent(quizId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Қате: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zipgrade_${quizId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message ?? "Белгісіз қате");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">ZipGrade тесттері</h1>

      {loading && <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!loading && quizzes.length === 0 && !error && (
        <p className="mt-6 text-sm text-ink/50">Тест табылмады.</p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {quizzes.map((q) => (
          <div
            key={q.id}
            className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-3"
          >
            <div>
              <p className="font-medium text-ink">{q.name}</p>
              <p className="text-sm text-ink/50">
                {q.date} · {q.questions} сұрақ
              </p>
            </div>
            <button
              onClick={() => handleExport(q.id)}
              disabled={downloadingId === q.id}
              className="focus-ring rounded-full bg-admin px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {downloadingId === q.id ? "Жүктелуде..." : "CSV жүктеу"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
