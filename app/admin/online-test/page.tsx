export default function OnlineTestPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Онлайн тест</h1>
      <p className="mt-2 text-sm text-ink/60">
        .docx файлдарын жүктеу арқылы онлайн тест жасау осында болады.
      </p>

      <div className="mt-6 flex max-w-md cursor-not-allowed items-center justify-center rounded-2xl border-2 border-dashed border-ink/15 bg-white px-6 py-10 text-sm text-ink/40">
        .docx файлын осында сүйреп апарыңыз (жақын арада)
      </div>
    </div>
  );
}
