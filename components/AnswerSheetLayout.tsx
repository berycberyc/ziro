type Stage = {
  subject: string;
  questions: number;
  minutes: number;
  format: "abcd" | "number";
};

function QuestionRow({ number, format }: { number: number; format: "abcd" | "number" }) {
  if (format === "number") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="w-5 text-right text-ink/50">{number}.</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-5 w-5 border border-ink/40"
              aria-hidden
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-5 text-right text-ink/50">{number}.</span>
      <div className="flex gap-1.5">
        {["A", "B", "C", "D"].map((letter) => (
          <span
            key={letter}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-ink/50"
          >
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AnswerSheetLayout({
  title,
  stages,
}: {
  title: string;
  stages: Stage[];
}) {
  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white p-8 text-ink print:p-4">
      <div className="flex items-center justify-between border-b border-ink/20 pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-ink/40">
            Жауап парағы
          </p>
          <h2 className="font-display text-xl font-bold">{title}</h2>
        </div>
        <div className="h-16 w-16 border border-ink/30 text-center text-[10px] leading-[64px] text-ink/30">
          QR
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-b border-ink/20 pb-4 text-xs text-ink/50">
        <span>Аты-жөні: ______________________</span>
        <span>Аудитория: __________</span>
        <span>Тіл: __________</span>
        <span>Нұсқа: __________</span>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {stages.map((stage, i) => (
          <div key={i}>
            <p className="mb-2 text-sm font-semibold text-ink">
              {stage.subject}{" "}
              <span className="font-normal text-ink/40">
                ({stage.questions} сұрақ, {stage.minutes} мин)
              </span>
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {Array.from({ length: stage.questions }, (_, q) => (
                <QuestionRow key={q} number={q + 1} format={stage.format} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
