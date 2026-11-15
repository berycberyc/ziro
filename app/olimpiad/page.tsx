"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AddStudentForm from "@/components/AddStudentForm";
import { Card, Msg, darkBtn, ghostBtn, inputCls, primaryBtn, useL } from "@/components/olympiad/ui";
import { formatAstana } from "@/lib/olympiad/time";

/**
 * Олимпиаданың басты беті (/olimpiad).
 *
 * Мұнда ата-ана тіркеледі (не бар аккаунтымен кіреді), оқушыны қосады
 * және олимпиадаға жазады. Ата-ана аккаунты мен оқушы — сайттың кәдімгі
 * аккаунты мен оқушысы. Олимпиадаға жазылу — бөлек кесте, брондауға
 * да, төлемге де қатысы жоқ.
 */

type PublicInfo = {
  text1_kk: string;
  text1_ru: string;
  registration_open: boolean;
  registration_closes_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  results_published: boolean;
};

type MyReg = {
  student_id: string;
  full_name: string;
  zipgrade_id: string;
  code: string;
  lang: "kk" | "ru";
  result: "passed" | "not_passed" | null;
};

type StudentRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  grade: string | null;
  language: string | null;
};

const CONSENT_KK =
  "Баламның олимпиадаға қатысуы үшін оның деректері (аты-жөні, сыныбы, мектебі, қаласы, облысы, олимпиададағы жауаптары) олимпиада ұйымдастырушысына берілуіне келісемін.";
const CONSENT_RU =
  "Я согласен(на) на передачу данных ребёнка (ФИО, класс, школа, город, область, ответы на олимпиаде) организатору олимпиады для её проведения.";

export default function OlympiadPage() {
  const { L, lang, setLang } = useL();
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [infoError, setInfoError] = useState(false);
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [text2, setText2] = useState<{ kk: string; ru: string }>({ kk: "", ru: "" });

  useEffect(() => {
    supabase.rpc("olympiad_public_info").then(({ data, error }) => {
      if (error || !data) setInfoError(true);
      else setInfo(data as PublicInfo);
    });
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const text1 = info ? (lang === "ru" && info.text1_ru ? info.text1_ru : info.text1_kk) : "";

  return (
    <div className="min-h-screen bg-parchment pb-16">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-wide.png" alt="Ziro" className="h-7 w-auto" />
          </Link>
          <LanguageSwitcher lang={lang} onChange={setLang} />
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
        {/* Шапка: НЗМ және БИЛ логотиптері (public/olimpiad/nis.png, bil.jpg) */}
        <section className="rounded-3xl bg-ink px-6 py-8 text-center text-white shadow-lg">
          <div className="flex items-center justify-center gap-6">
            <Logo src="/olimpiad/nis.png" fallback={L("НЗМ", "НИШ")} />
            <Logo src="/olimpiad/bil.jpg" fallback="БИЛ" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-extrabold sm:text-3xl">
            {L("НЗМ · БИЛ олимпиадасы", "Олимпиада НИШ · БИЛ")}
          </h1>
          <p className="mt-1 text-sm text-white/70">{L("1-тур · 6-сынып", "1 тур · 6 класс")}</p>
          {info?.starts_at && (
            <p className="mt-4 inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm">
              {formatAstana(info.starts_at, lang)} – {info.ends_at ? formatAstana(info.ends_at, lang).split(", ").pop() : ""}{" "}
              {L("(Астана уақыты)", "(время Астаны)")}
            </p>
          )}
        </section>

        {infoError && <Msg kind="err">{L("Олимпиада туралы ақпарат жүктелмеді.", "Не удалось загрузить информацию об олимпиаде.")}</Msg>}

        {text1 && (
          <Card>
            <div className="whitespace-pre-line text-sm leading-relaxed text-ink/80">{text1}</div>
          </Card>
        )}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-bold text-ink">{L("Олимпиадаға кіру", "Вход на олимпиаду")}</p>
              <p className="text-sm text-ink/60">{L("Олимпиада күні оқушы осы жерден кіреді.", "В день олимпиады ученик заходит здесь.")}</p>
            </div>
            <Link href="/olimpiad/enter" className={darkBtn}>{L("Кіру", "Войти")}</Link>
          </div>
        </Card>

        {info && userId !== undefined && (
          userId ? (
            <ParentArea userId={userId} info={info} onText2={setText2} text2={text2} />
          ) : info.registration_open ? (
            <Signup />
          ) : (
            <Card>
              <p className="text-sm text-ink/70">
                {info.results_published
                  ? L("Нәтижені көру үшін аккаунтыңызға кіріңіз.", "Чтобы увидеть результат, войдите в аккаунт.")
                  : L("Тіркеу жабық.", "Регистрация закрыта.")}
              </p>
              <LoginForm />
            </Card>
          )
        )}
      </main>
    </div>
  );
}

function Logo({ src, fallback }: { src: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 font-display text-lg font-extrabold">
        {fallback}
      </div>
    );
  }
  return <img src={src} alt={fallback} className="h-16 w-auto rounded-xl bg-white p-1" onError={() => setFailed(true)} />;
}

// ------------------------------------------------------------------
// Тіркелмеген адам: жаңа аккаунт немесе кіру
// ------------------------------------------------------------------
function Signup() {
  const { L } = useL();
  const [mode, setMode] = useState<"new" | "login">("new");

  return (
    <Card title={L("Олимпиадаға тіркелу", "Регистрация на олимпиаду")}>
      <div className="mb-4 inline-flex rounded-full bg-parchment p-1 text-sm">
        {(["new", "login"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 font-semibold ${mode === m ? "bg-ink text-white" : "text-ink/60"}`}
          >
            {m === "new" ? L("Жаңа тіркелу", "Новая регистрация") : L("Аккаунтым бар", "У меня есть аккаунт")}
          </button>
        ))}
      </div>
      {mode === "new" ? <NewParentForm /> : <LoginForm />}
    </Card>
  );
}

function NewParentForm() {
  const { L } = useL();
  const [v, setV] = useState({ firstName: "", lastName: "", phone: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needConfirm, setNeedConfirm] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (v.password.length < 6) {
      setError(L("Құпиясөз кемінде 6 таңба болсын.", "Пароль — минимум 6 символов."));
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: v.email.trim(),
      password: v.password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/olimpiad` : undefined,
        data: { first_name: v.firstName.trim(), last_name: v.lastName.trim(), phone: v.phone.trim() },
      },
    });
    setLoading(false);
    if (err) {
      setError(
        /registered|already/i.test(err.message)
          ? L("Бұл email тіркелген — «Аккаунтым бар» арқылы кіріңіз.", "Этот email уже зарегистрирован — войдите через «У меня есть аккаунт».")
          : L("Тіркелу мүмкін болмады: ", "Не удалось зарегистрироваться: ") + err.message
      );
      return;
    }
    // Email растау өшірулі болса — бірден кірген күйде боламыз
    // (onAuthStateChange бетті өзі жаңартады). Қосулы болса — хат күтеміз.
    if (!data.session) setNeedConfirm(true);
  }

  if (needConfirm) {
    return (
      <Msg kind="warn">
        {L(
          "Поштаңызға хат жіберілді. Сілтемені басып растаңыз да, осы бетке қайта кіріп тіркеуді аяқтаңыз.",
          "На почту отправлено письмо. Подтвердите по ссылке, затем вернитесь на эту страницу и завершите регистрацию."
        )}
      </Msg>
    );
  }

  const field = (k: keyof typeof v, label: string, type = "text", auto?: string) => (
    <input
      required
      type={type}
      autoComplete={auto}
      placeholder={label}
      className={inputCls}
      value={v[k]}
      onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))}
    />
  );

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <p className="text-sm text-ink/60 sm:col-span-2">
        {L("1-қадам: ата-ананың деректері (сайттағы аккаунтыңыз болады).", "Шаг 1: данные родителя (станет вашим аккаунтом на сайте).")}
      </p>
      {field("firstName", L("Аты", "Имя"), "text", "given-name")}
      {field("lastName", L("Тегі", "Фамилия"), "text", "family-name")}
      {field("phone", L("Телефон", "Телефон"), "tel", "tel")}
      {field("email", "Email", "email", "email")}
      {field("password", L("Құпиясөз", "Пароль"), "password", "new-password")}
      <div className="sm:col-span-2">
        {error && <p className="mb-2 text-sm text-clay">{error}</p>}
        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? L("Тіркелуде...", "Регистрируем...") : L("Жалғастыру", "Продолжить")}
        </button>
      </div>
    </form>
  );
}

function LoginForm() {
  const { L } = useL();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(true);
  }

  return (
    <form onSubmit={submit} className="mt-3 flex max-w-sm flex-col gap-3">
      <input required type="email" autoComplete="username" placeholder="Email" className={inputCls}
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <input required type="password" autoComplete="current-password" placeholder={L("Құпиясөз", "Пароль")} className={inputCls}
        value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-sm text-clay">{L("Email немесе құпиясөз қате.", "Неверный email или пароль.")}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? L("Тексерілуде...", "Проверяем...") : L("Кіру", "Войти")}
        </button>
        <Link href="/forgot-password" className="text-sm text-ink/60 underline">
          {L("Құпиясөзді ұмыттыңыз ба?", "Забыли пароль?")}
        </Link>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------
// Кірген ата-ана: оқушылары, тіркеу, кодтар, нәтиже
// ------------------------------------------------------------------
function ParentArea({
  userId,
  info,
  text2,
  onText2,
}: {
  userId: string;
  info: PublicInfo;
  text2: { kk: string; ru: string };
  onText2: (t: { kk: string; ru: string }) => void;
}) {
  const { L, lang } = useL();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [regs, setRegs] = useState<MyReg[]>([]);
  const [adding, setAdding] = useState(false);
  const [registering, setRegistering] = useState<StudentRow | null>(null);
  const [justCode, setJustCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from("students").select("id, full_name, first_name, last_name, grade, language").eq("parent_id", userId).order("created_at"),
      supabase.rpc("olympiad_my_registrations"),
    ]);
    setStudents((s ?? []) as StudentRow[]);
    setRegs((r ?? []) as MyReg[]);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // 2-мәтін (олимпиада туралы нұсқау) тек тіркелген ата-анаға көрсетіледі.
  useEffect(() => {
    if (!regs.length || text2.kk || text2.ru) return;
    supabase.rpc("olympiad_my_text2").then(({ data }) => {
      if (data) onText2(data as { kk: string; ru: string });
    });
  }, [regs.length, text2.kk, text2.ru, onText2]);

  const registeredIds = new Set(regs.map((r) => r.student_id));
  const unregistered = students.filter((s) => !registeredIds.has(s.id));
  const t2 = lang === "ru" && text2.ru ? text2.ru : text2.kk;

  return (
    <>
      {regs.length > 0 && (
        <Card title={L("Олимпиадаға тіркелгендер", "Зарегистрированы на олимпиаду")}>
          <div className="flex flex-col gap-3">
            {regs.map((r) => (
              <div
                key={r.student_id}
                className={`rounded-2xl border p-4 ${justCode === r.code ? "border-gold bg-gold/10" : "border-ink/10"}`}
              >
                <p className="font-semibold text-ink">{r.full_name}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-parchment p-3">
                    <p className="text-xs text-ink/50">{L("Оқушы ID", "ID ученика")}</p>
                    <p className="font-mono text-lg font-bold text-ink">{r.zipgrade_id}</p>
                  </div>
                  <div className="rounded-xl bg-parchment p-3">
                    <p className="text-xs text-ink/50">{L("Олимпиада коды", "Код олимпиады")}</p>
                    <p className="font-mono text-lg font-bold text-ink">{r.code}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink/50">
                  {L("Тест тілі: ", "Язык теста: ")}
                  {r.lang === "ru" ? L("орыс", "русский") : L("қазақ", "казахский")}
                </p>
                {r.result && (
                  <p
                    className={`mt-3 rounded-xl px-4 py-3 text-center font-display text-lg font-bold ${
                      r.result === "passed" ? "bg-mint/15 text-mint" : "bg-ink/5 text-ink/70"
                    }`}
                  >
                    {r.result === "passed" ? L("Өтті", "Прошёл") : L("Өтпеді", "Не прошёл")}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-parchment p-4 text-sm text-ink/80">
            <p>
              {L("Олимпиада күні оқушы ", "В день олимпиады ученик заходит на ")}
              <Link href="/olimpiad/enter" className="font-semibold text-parent underline">zirotest.com/olimpiad/enter</Link>
              {L(" бетіне кіріп, Оқушы ID мен кодты енгізеді.", " и вводит ID ученика и код.")}
            </p>
            {info.starts_at && (
              <p className="mt-1">
                {L("Уақыты: ", "Время: ")}
                {formatAstana(info.starts_at, lang)} – {formatAstana(info.ends_at, lang).split(", ").pop()}{" "}
                {L("(Астана уақыты)", "(время Астаны)")}
              </p>
            )}
            {t2 && <div className="mt-3 whitespace-pre-line border-t border-ink/10 pt-3">{t2}</div>}
          </div>
        </Card>
      )}

      {info.registration_open ? (
        <Card title={L("Оқушыны тіркеу", "Зарегистрировать ученика")}>
          {registering ? (
            <RegisterStudent
              student={registering}
              onCancel={() => setRegistering(null)}
              onDone={async (code) => {
                setRegistering(null);
                setJustCode(code);
                await load();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          ) : (
            <>
              {unregistered.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {unregistered.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 p-3">
                      <div>
                        <p className="font-semibold text-ink">{studentName(s)}</p>
                        <p className="text-xs text-ink/50">{s.grade ? `${s.grade} ${L("сынып", "класс")}` : ""}</p>
                      </div>
                      <button onClick={() => setRegistering(s)} className={primaryBtn}>{L("Тіркеу", "Записать")}</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink/60">
                  {students.length
                    ? L("Барлық оқушыңыз тіркелген.", "Все ваши ученики зарегистрированы.")
                    : L("2-қадам: оқушының деректерін қосыңыз.", "Шаг 2: добавьте данные ученика.")}
                </p>
              )}

              <div className="mt-4">
                {adding || students.length === 0 ? (
                  <AddStudentForm
                    parentId={userId}
                    onAdded={async () => {
                      setAdding(false);
                      await load();
                    }}
                  />
                ) : (
                  <button onClick={() => setAdding(true)} className={ghostBtn}>+ {L("Жаңа оқушы қосу", "Добавить ученика")}</button>
                )}
              </div>
            </>
          )}
        </Card>
      ) : (
        regs.length === 0 && (
          <Card>
            <p className="text-sm text-ink/70">{L("Тіркеу жабық.", "Регистрация закрыта.")}</p>
          </Card>
        )
      )}

      <div className="text-center">
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-sm text-ink/50 underline hover:text-ink"
        >
          {L("Аккаунттан шығу", "Выйти из аккаунта")}
        </button>
      </div>
    </>
  );
}

function studentName(s: StudentRow) {
  return (s.full_name || `${s.first_name ?? ""} ${s.last_name ?? ""}`).trim();
}

function RegisterStudent({
  student,
  onCancel,
  onDone,
}: {
  student: StudentRow;
  onCancel: () => void;
  onDone: (code: string) => void;
}) {
  const { L, lang } = useL();
  const [testLang, setTestLang] = useState<"kk" | "ru">(student.language === "ru" ? "ru" : "kk");
  const [grade6, setGrade6] = useState(student.grade?.trim() === "6");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!grade6) {
      setError(L("Олимпиада тек 6-сынып оқушыларына арналған.", "Олимпиада только для учеников 6 класса."));
      return;
    }
    if (!consent) {
      setError(L("Келісім белгісін қойыңыз.", "Поставьте отметку согласия."));
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.rpc("olympiad_register", {
      p_student_id: student.id,
      p_lang: testLang,
      p_confirm_grade6: true,
      p_consent_kk: CONSENT_KK,
      p_consent_ru: CONSENT_RU,
    });
    setLoading(false);
    if (err || !data) {
      const m = String(err?.message ?? "");
      setError(
        m.includes("registration_closed")
          ? L("Тіркеу жабылды.", "Регистрация закрыта.")
          : L("Тіркеу мүмкін болмады: ", "Не удалось зарегистрировать: ") + m
      );
      return;
    }
    onDone(data as string);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="font-semibold text-ink">{studentName(student)}</p>

      <label className="text-sm text-ink/70">
        {L("Олимпиаданы қай тілде жазады?", "На каком языке пишет олимпиаду?")}
        <select className={`${inputCls} mt-1 sm:w-60`} value={testLang} onChange={(e) => setTestLang(e.target.value as "kk" | "ru")}>
          <option value="kk">{L("Қазақ тілі", "Казахский")}</option>
          <option value="ru">{L("Орыс тілі", "Русский")}</option>
        </select>
      </label>

      <label className="flex items-start gap-2 text-sm text-ink/80">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={grade6} onChange={(e) => setGrade6(e.target.checked)} />
        <span>
          {L("Балам қазір 6-сыныпта оқиды.", "Мой ребёнок сейчас учится в 6 классе.")}
          {student.grade?.trim() !== "6" && (
            <span className="block text-xs text-ink/50">
              {L(
                `Карточкада ${student.grade || "—"} сынып тұр — белгі қойсаңыз, 6 болып өзгереді.`,
                `В карточке указан ${student.grade || "—"} класс — если отметите, изменится на 6.`
              )}
            </span>
          )}
        </span>
      </label>

      <label className="flex items-start gap-2 text-xs leading-relaxed text-ink/70">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{lang === "kk" ? CONSENT_KK : CONSENT_RU}</span>
      </label>

      {error && <p className="text-sm text-clay">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading ? L("Тіркелуде...", "Регистрируем...") : L("Олимпиадаға тіркеу", "Записать на олимпиаду")}
        </button>
        <button type="button" onClick={onCancel} className={ghostBtn}>{L("Болдырмау", "Отмена")}</button>
      </div>
    </form>
  );
}
