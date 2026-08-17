export default function ResultsPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Нәтижелер</h1>
      <p className="mt-2 text-sm text-ink/60">
        ZipGrade кестелерін жүктеу және нәтижелерді есептеу осында болады.
      </p>

      <button
        disabled
        className="mt-6 cursor-not-allowed rounded-full bg-admin/30 px-6 py-2.5 text-sm font-semibold text-white"
      >
        ZipGrade кестелерін аплоад ету
      </button>
    </div>
  );
}
