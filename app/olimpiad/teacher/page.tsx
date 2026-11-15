"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import TeacherSettings, { type OlympiadRow } from "@/components/olympiad/teacher/TeacherSettings";
import TeacherQuestions, { type QuestionRow } from "@/components/olympiad/teacher/TeacherQuestions";
import TeacherResults from "@/components/olympiad/teacher/TeacherResults";
import { Card, Msg, darkBtn, inputCls, primaryBtn, useL } from "@/components/olympiad/ui";
import { formatAstana } from "@/lib/olympiad/time";

/**
 * Олимпиада ұйымдастырушысының кабинеті (/olimpiad/teacher).
 * Кіретін рөл: 'olimp_teacher' (және біздің әкімші). Сайттың әдеттегі
 * мұғалім/әкімші беттеріне қатысы жоқ.
 */
export default function OlympiadTeacherPage() {
  const { L, lang, setLang } = useL();
  const [status, setStatus] = useState<"loading" | "login" | "forbidden" | "ok">("loading");
  const [olympiad, setOlympiad] = useState<OlympiadRow | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [now, setNow] = useState(Date.now());

  const loadData = useCallback(async () => {
    const [{ data: o }, { data: q }] = await Promise.all([
      supabase.from("olympiad").select("*").eq("id", 1).single(),
      supabase.from("olympiad_questions").select("*").order("number"),
    ]);
    if (o) setOlympiad(o as OlympiadRow);
    setQuestions((q ?? []) as QuestionRow[]);
    setNow(Date.now());
  }, []);

  const check = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setStatus("login");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
    if (profile?.role !== "olimp_teacher" && profile?.role !== "admin") {
      setStatus("forbidden");
      return;
    }
    await loadData();
    setStatus("ok");
  }, [loadData]);

  useEffect(() => {
    check();
  }, [check]);

  // Минут сайын «басталды / аяқталды» күйін жаңартып тұрамыз.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setStatus("login");
  }

  const header = (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/olimpiad" className="font-display text-base font-bold text-ink">
          {L("Олимпиада · ұйымдастырушы", "Олимпиада · организатор")}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher lang={lang} onChange={setLang} />
          {status === "ok" || status === "forbidden" ? (
            <button onClick={logout} className="text-sm text-ink/60 hover:text-ink">{L("Шығу", "Выйти")}</button>
          ) : null}
        </div>
      </div>
    </header>
  );

  if (status === "loading") {
    return <div className="min-h-screen bg-parchment">{header}<p className="p-10 text-center text-ink/50">{L("Жүктелуде...", "Загрузка...")}</p></div>;
  }

  if (status === "login") {
    return (
      <div className="min-h-screen bg-parchment">
        {header}
        <LoginForm onDone={check} />
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="min-h-screen bg-parchment">
        {header}
        <div className="mx-auto max-w-md p-6">
          <Msg kind="err">{L("Бұл бет тек олимпиада ұйымдастырушысына арналған.", "Эта страница только для организатора олимпиады.")}</Msg>
        </div>
      </div>
    );
  }

  if (!olympiad) {
    return (
      <div className="min-h-screen bg-parchment">
        {header}
        <div className="mx-auto max-w-md p-6">
          <Msg kind="err">{L("Олимпиада баптаулары табылмады (базаға 068 миграциясы қосылмаған).", "Настройки олимпиады не найдены (в базе не выполнена миграция 068).")}</Msg>
        </div>
      </div>
    );
  }

  const started = olympiad.starts_at ? new Date(olympiad.starts_at).getTime() <= now : false;
  const ended = olympiad.ends_at ? new Date(olympiad.ends_at).getTime() <= now : false;

  return (
    <div className="min-h-screen bg-parchment pb-16">
      {header}
      <main className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
        <nav className="flex flex-wrap gap-2 text-sm">
          {[
            ["#settings", L("Баптаулар", "Настройки")],
            ["#questions", L("Тапсырмалар", "Задания")],
            ["#results", L("Нәтижелер", "Результаты")],
            ["#password", L("Құпиясөз", "Пароль")],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full bg-white px-4 py-1.5 font-semibold text-ink/70 shadow-sm hover:text-ink">
              {label}
            </a>
          ))}
        </nav>

        <Msg kind={ended ? "ok" : started ? "warn" : "ok"}>
          {!olympiad.starts_at
            ? L("Олимпиада уақыты әлі қойылмаған.", "Время олимпиады ещё не задано.")
            : ended
            ? L("Олимпиада аяқталды: ", "Олимпиада завершилась: ") + formatAstana(olympiad.ends_at, lang)
            : started
            ? L("Олимпиада жүріп жатыр, аяқталуы: ", "Олимпиада идёт, окончание: ") + formatAstana(olympiad.ends_at, lang)
            : L("Олимпиада басталады: ", "Олимпиада начнётся: ") + formatAstana(olympiad.starts_at, lang)}
        </Msg>

        <TeacherSettings olympiad={olympiad} onSaved={loadData} />
        <TeacherQuestions questions={questions} started={started} onSaved={loadData} />
        <TeacherResults
          questions={questions}
          ended={ended}
          publishedAt={olympiad.results_published_at}
          onPublished={loadData}
        />
        <PasswordCard />
      </main>
    </div>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const { L } = useL();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(true);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="mx-4 mt-10 flex flex-col gap-3 rounded-3xl border border-ink/10 bg-white p-8 shadow-lg sm:mx-auto sm:max-w-sm">
      <h1 className="font-display text-xl font-bold text-ink">{L("Ұйымдастырушы кіруі", "Вход организатора")}</h1>
      <input required type="email" autoComplete="username" placeholder="Email" className={inputCls}
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <input required type="password" autoComplete="current-password" placeholder={L("Құпиясөз", "Пароль")} className={inputCls}
        value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-sm text-clay">{L("Email немесе құпиясөз қате.", "Неверный email или пароль.")}</p>}
      <button type="submit" disabled={loading} className={primaryBtn}>
        {loading ? L("Тексерілуде...", "Проверяем...") : L("Кіру", "Войти")}
      </button>
    </form>
  );
}

function PasswordCard() {
  const { L } = useL();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) {
      setMsg({ kind: "err", text: L("Кемінде 8 таңба болсын.", "Минимум 8 символов.") });
      return;
    }
    if (pw !== pw2) {
      setMsg({ kind: "err", text: L("Екі құпиясөз сәйкес емес.", "Пароли не совпадают.") });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) {
      setMsg({ kind: "err", text: L("Өзгермеді: ", "Не изменён: ") + error.message });
      return;
    }
    setPw("");
    setPw2("");
    setMsg({ kind: "ok", text: L("Құпиясөз өзгертілді.", "Пароль изменён.") });
  }

  return (
    <Card id="password" title={L("Құпиясөзді өзгерту", "Смена пароля")}>
      <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
        <input type="password" autoComplete="new-password" placeholder={L("Жаңа құпиясөз", "Новый пароль")} className={inputCls}
          value={pw} onChange={(e) => setPw(e.target.value)} />
        <input type="password" autoComplete="new-password" placeholder={L("Қайталаңыз", "Повторите")} className={inputCls}
          value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}
        <div>
          <button type="submit" disabled={saving} className={darkBtn}>
            {saving ? L("Сақталуда...", "Сохраняем...") : L("Өзгерту", "Изменить")}
          </button>
        </div>
      </form>
    </Card>
  );
}

