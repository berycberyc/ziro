"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/LangContext";
import type { Lang } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getUpcomingSessions, getSessionDetail, type SessionSummary } from "@/lib/sessions";
import { groupSessions, humanDate } from "@/components/HomeSessions";
import { OFFLINE_CLOSED } from "@/components/BookingForm";
import { supabase } from "@/lib/supabase";

/**
 * Жарнамадан келген ата-анаға арналған бет (/baikau).
 *
 * Басты бет бірден «Кабинет ашу» сұрайды — жарнамадан келген адам әлі
 * не екенін, қашан және қанша тұратынын түсінбей кетіп қалатын. Мұнда
 * алдымен соның бәрі, нағыз өткен тесттің кестесі, сосын бір түйме.
 *
 * Бәрі базадан: келесі ашық сессия (күні, бағасы, брондау соңы) және
 * соңғы жарияланған нәтижелер (published_results — ашық, аты-жөнсіз).
 */

const T = {
  kk: {
    login: "Кіру",
    eyebrow: "Байқау тесті",
    title: "НЗМ · БИЛ · РФМШ байқау тесті",
    online: "онлайн, үйден",
    onlineOffline: "онлайн немесе офлайн",
    lead: "Балаңыз нағыз емтихан форматында жазады. Нәтижеде — әр пән бойынша балл, барлық қатысушылар арасындағы орны және қай тақырыптар әлсіз екені.",
    price: "Бағасы",
    priceCompare: "НЗМ-нің өз байқау тесті — 13 000–18 000 ₸",
    cta: "Орын брондау",
    closes: (d: string) => `Брондаудың соңғы күні — ${d}`,
    daysLeft: (n: number) => (n === 0 ? "бүгін — соңғы күн" : `${n} күн қалды`),
    statTests: "тест өтті",
    statPeople: "қатысушы",
    statPrice: "бір тест",
    resultsLabel: "Нағыз нәтиже",
    resultsTitle: (d: string) => `${d} өткен тесттің үздік 10 оқушысы`,
    resultsDesc: "Аты-жөн жоқ — тек оқушы ID. Әр ата-ана өз баласын ID арқылы табады және оның барлық қатысушылар арасындағы орнын көреді.",
    place: "Орын",
    total: "Жалпы",
    participants: (n: number) => `барлығы ${n} қатысушы`,
    allResults: "Толық кестені көру →",
    getLabel: "Не аласыз",
    get: [
      ["Әр пән бойынша балл", "Математика, сандық сипаттамалар, жаратылыстану, тілдер — әрқайсысы бөлек, шекті балмен салыстырып."],
      ["Орны", "Барлық қатысушылар арасындағы нақты орны — балаңыз қай деңгейде тұрғанын көресіз."],
      ["Әлсіз тақырыптар", "Қай тақырыпта қате көп — емтиханға дейін нені қайталау керегі анық болады."],
      ["Нағыз формат", "Сұрақ саны мен уақыты — нағыз емтихандағыдай. Емтихан күні балаңыз абдырамайды."],
    ],
    stepsLabel: "Қалай тіркеледі",
    steps: [
      ["Кабинет ашу", "Аты-жөн, телефон, email. Поштаңызға хат келеді — ішіндегі сілтемені басыңыз (Спам папкасын да қараңыз)."],
      ["Оқушыны қосу және брондау", "Кабинетте баланы қосып, тест түрін таңдайсыз."],
      ["Kaspi арқылы төлеу", "«Брондаулар» бөлімінде Kaspi QR-коды шығады. Чекті сол жерге жүктейсіз."],
      ["Тест күні", "«Брондаулар» бөлімінде «Тестті бастау» түймесі пайда болады. Кіру басталғаннан кейін 30 минут ашық."],
    ],
    faqLabel: "Жиі сұрақтар",
    faq: [
      ["Онлайн тест қалай өтеді?", (start: string) => `Тест күні сағат ${start}-де басталады. Балаңыз үйден, интернет арқылы жазады. Тест кезінде басқа бетке не қолданбаға шықпаңыз — тест сол сәтте аяқталады.`],
      ["Кімге арналған?", () => "НЗМ, БИЛ, РФМШ-ға түсуге дайындалып жүрген оқушыларға. Тест түрін брондау кезінде таңдайсыз."],
      ["Нәтиже қайда шығады?", () => "Тексерілген соң ата-ана кабинетіне шығады: әр пән бойынша балл, орны және тақырыптар талдауы."],
      ["Төлем қалай?", () => "Kaspi QR арқылы. Чекті жүктеген соң брондау расталады."],
    ],
    finalTitle: "Орын брондауды кейінге қалдырмаңыз",
    noSession: "Келесі тест күні жақында жарияланады.",
  },
  ru: {
    login: "Войти",
    eyebrow: "Пробный тест",
    title: "Пробный тест НИШ · БИЛ · РФМШ",
    online: "онлайн, из дома",
    onlineOffline: "онлайн или офлайн",
    lead: "Ребёнок пишет тест в формате настоящего экзамена. В результате — баллы по каждому предмету, место среди всех участников и слабые темы.",
    price: "Стоимость",
    priceCompare: "Пробный тест самого НИШ — 13 000–18 000 ₸",
    cta: "Забронировать место",
    closes: (d: string) => `Запись до ${d}`,
    daysLeft: (n: number) => {
      if (n === 0) return "сегодня последний день";
      const w = n % 10 === 1 && n % 100 !== 11 ? "день" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "дня" : "дней";
      return `осталось ${n} ${w}`;
    },
    statTests: "теста проведено",
    statPeople: "участников",
    statPrice: "один тест",
    resultsLabel: "Настоящие результаты",
    resultsTitle: (d: string) => `Топ-10 учеников теста ${d}`,
    resultsDesc: "Без имён — только ID ученика. Каждый родитель находит своего ребёнка по ID и видит его место среди всех участников.",
    place: "Место",
    total: "Итого",
    participants: (n: number) => `всего ${n} участников`,
    allResults: "Смотреть всю таблицу →",
    getLabel: "Что вы получите",
    get: [
      ["Баллы по каждому предмету", "Математика, количественные характеристики, естествознание, языки — отдельно, в сравнении с пороговым баллом."],
      ["Место", "Точное место среди всех участников — вы видите, на каком уровне ребёнок."],
      ["Слабые темы", "Где больше всего ошибок — понятно, что повторить до экзамена."],
      ["Настоящий формат", "Число вопросов и время — как на экзамене. В день экзамена ребёнок не растеряется."],
    ],
    stepsLabel: "Как записаться",
    steps: [
      ["Открыть кабинет", "Имя, телефон, email. На почту придёт письмо — нажмите ссылку в нём (проверьте и папку «Спам»)."],
      ["Добавить ученика и забронировать", "В кабинете добавляете ребёнка и выбираете тип теста."],
      ["Оплата через Kaspi", "В разделе «Брони» появится Kaspi QR. Чек загружаете туда же."],
      ["День теста", "В разделе «Брони» появится кнопка «Начать тест». Вход открыт 30 минут после начала."],
    ],
    faqLabel: "Частые вопросы",
    faq: [
      ["Как проходит онлайн-тест?", (start: string) => `В день теста начало в ${start}. Ребёнок пишет из дома через интернет. Во время теста нельзя переходить на другую вкладку или приложение — тест сразу завершится.`],
      ["Для кого?", () => "Для учеников, которые готовятся к поступлению в НИШ, БИЛ, РФМШ. Тип теста выбираете при бронировании."],
      ["Где будет результат?", () => "После проверки — в кабинете родителя: баллы по предметам, место и разбор по темам."],
      ["Как оплатить?", () => "Через Kaspi QR. После загрузки чека бронь подтверждается."],
    ],
    finalTitle: "Не откладывайте бронирование",
    noSession: "Дата следующего теста скоро будет объявлена.",
  },
};

type ResultRow = { zipgrade_id: string; place: number; total_score: number; breakdown: any };

type Table = { code: "NIS" | "BIL"; count: number; rows: ResultRow[] };

const TABLE_TITLES: Record<Table["code"], Record<Lang, string>> = {
  NIS: { kk: "НЗМ", ru: "НИШ" },
  BIL: { kk: "БИЛ", ru: "БИЛ" },
};

function daysUntil(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const end = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((end - today) / 86400000));
}

function trackLead() {
  (window as any).fbq?.("track", "Lead");
}

export default function BaikauPage() {
  const { lang, setLang } = useLang();
  const t = T[lang];

  const [next, setNext] = useState<SessionSummary | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [past, setPast] = useState<SessionSummary | null>(null);
  const [testsHeld, setTestsHeld] = useState(0);
  const [people, setPeople] = useState(0);
  const [tables, setTables] = useState<Table[]>([]);
  const [activeTable, setActiveTable] = useState<Table["code"]>("NIS");
  const [loaded, setLoaded] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [startTime, setStartTime] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));

    async function load() {
      const sessions = await getUpcomingSessions();
      const { open, upcoming, past: pastSessions } = groupSessions(sessions);
      const nextSession = open[0] ?? upcoming[0] ?? null;
      setNext(nextSession);
      setLoaded(true);

      const withResults = pastSessions.filter((s) => s.hasResults);
      setTestsHeld(withResults.length);
      const latest = withResults[0] ?? null;
      setPast(latest);

      // Қалғанының бәрі бір-біріне тәуелсіз — қатар сұраймыз, бет тез ашылсын.
      const topTen = (sessionId: string, code: Table["code"]) =>
        supabase
          .from("published_results")
          .select("zipgrade_id, place, total_score, breakdown", { count: "exact" })
          .eq("test_session_id", sessionId)
          .eq("test_type_code", code)
          .order("place")
          .limit(10)
          .then(({ data, count }) => ({ code, count: count ?? 0, rows: (data ?? []) as ResultRow[] }));

      await Promise.all([
        nextSession &&
          getSessionDetail(nextSession.sessionId).then((detail) => {
            const prices = detail?.testTypes.map((x) => x.price) ?? [];
            setPrice(prices.length ? Math.min(...prices) : nextSession.price);
          }),
        nextSession &&
          supabase
            .from("test_sessions")
            .select("start_time")
            .eq("id", nextSession.sessionId)
            .single()
            .then(({ data }) => setStartTime(data?.start_time?.slice(0, 5) ?? "")),
        supabase
          .from("published_results")
          .select("zipgrade_id", { count: "exact", head: true })
          .then(({ count }) => setPeople(count ?? 0)),
        latest &&
          Promise.all([topTen(latest.sessionId, "NIS"), topTen(latest.sessionId, "BIL")]).then((all) => {
            // Аз қатысушы болса кесте әсер етпейді — көрсетпейміз.
            const shown = all.filter((x) => x.count >= 10);
            setTables(shown);
            if (shown[0]) setActiveTable(shown[0].code);
          }),
      ]);
    }
    load();
  }, []);

  const bookHref = loggedIn ? "/dashboard/tests" : "/register";
  const formatText = OFFLINE_CLOSED ? t.online : t.onlineOffline;
  const table = tables.find((x) => x.code === activeTable);
  const left = next?.registrationClosesAt ? daysUntil(next.registrationClosesAt) : null;

  const Cta = ({ big }: { big?: boolean }) => (
    <Link
      href={bookHref}
      onClick={trackLead}
      className={`focus-ring inline-flex items-center justify-center rounded-xl bg-gold font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.35)] transition-transform hover:-translate-y-0.5 ${
        big ? "w-full px-8 py-4 text-lg sm:w-auto" : "px-6 py-3 text-base"
      }`}
    >
      {t.cta}
    </Link>
  );

  return (
    <main className="min-h-screen bg-parchment">
      {/* header */}
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-parchment/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Ziro" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-display text-xl font-bold tracking-tight text-ink">
              zi<span className="text-gold-deep">ro</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher lang={lang} onChange={setLang} />
            <Link href="/login" className="text-sm font-semibold text-ink/70 hover:text-ink">
              {t.login}
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="bg-gradient-to-b from-ink to-ink-soft text-parchment">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-16">
          <p className="mb-4 flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest text-gold">
            <span className="h-px w-5 bg-gold" />
            {t.eyebrow}
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-5xl">{t.title}</h1>

          {next ? (
            <p className="mt-4 text-xl font-bold text-gold sm:text-2xl">
              {humanDate(next.sessionDate, lang)} · {formatText}
            </p>
          ) : (
            loaded && <p className="mt-4 text-lg text-gold">{t.noSession}</p>
          )}

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#C7CEDB] sm:text-lg">{t.lead}</p>

          {/* баға */}
          <div className="mt-8 flex flex-col gap-5 rounded-2xl border border-gold/30 bg-white/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-[#B9C1D0]">{t.price}</p>
              <p className="font-display text-4xl font-bold text-parchment">
                {(price ?? 5000).toLocaleString("ru-RU")} ₸
              </p>
              <p className="mt-1 text-sm text-[#B9C1D0]">{t.priceCompare}</p>
            </div>
            {next && (
              <div className="flex flex-col gap-2 sm:items-end">
                <Cta big />
                {next.registrationClosesAt && left !== null && (
                  <p className="text-center text-sm text-[#C7CEDB] sm:text-right">
                    {t.closes(humanDate(next.registrationClosesAt, lang))} ·{" "}
                    <span className="font-bold text-gold">{t.daysLeft(left)}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* сандар */}
      {people > 0 && (
        <div className="border-b border-ink/[0.06] bg-white">
          <div className="mx-auto grid max-w-5xl grid-cols-3 px-2 py-6 text-center">
            {[
              [String(testsHeld), t.statTests],
              [String(people), t.statPeople],
              [`${(price ?? 5000).toLocaleString("ru-RU")} ₸`, t.statPrice],
            ].map(([num, label], i) => (
              <div key={i} className={i > 0 ? "border-l border-ink/10" : ""}>
                <p className="font-display text-2xl font-bold text-ink sm:text-3xl">{num}</p>
                <p className="mt-1 text-xs text-ink/55 sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* видео */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid items-center gap-8 sm:grid-cols-[minmax(0,320px)_1fr]">
          <video
            src="/landing/berik.mp4"
            poster="/landing/berik-poster.jpg"
            controls
            playsInline
            preload="none"
            className="mx-auto w-full max-w-[320px] rounded-2xl bg-ink shadow-lg"
          />
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-gold-deep">{t.getLabel}</p>
            <ul className="flex flex-col gap-5">
              {t.get.map(([title, desc]) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold" />
                  <div>
                    <p className="font-display text-base font-semibold text-ink">{title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink/60">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* нағыз нәтижелер */}
      {past && tables.length > 0 && table && (
        <section className="border-y border-ink/[0.06] bg-white">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-gold-deep">{t.resultsLabel}</p>
            <h2 className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
              {t.resultsTitle(humanDate(past.sessionDate, lang, true))}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">{t.resultsDesc}</p>

            {tables.length > 1 && (
              <div className="mt-5 flex gap-2">
                {tables.map((x) => (
                  <button
                    key={x.code}
                    onClick={() => setActiveTable(x.code)}
                    className={`focus-ring rounded-full px-5 py-2 text-sm font-semibold ${
                      activeTable === x.code ? "bg-ink text-parchment" : "bg-ink/[0.06] text-ink/70"
                    }`}
                  >
                    {TABLE_TITLES[x.code][lang]}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 overflow-x-auto rounded-2xl border border-ink/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink/[0.04] font-mono text-[11px] text-ink/55">
                  <tr>
                    <th className="px-2 py-2 sm:px-3">{t.place}</th>
                    <th className="hidden px-3 py-2 sm:table-cell">ID</th>
                    {table.code === "NIS" ? (
                      <>
                        <th className="px-1.5 py-2 text-right sm:px-2">{lang === "kk" ? "Мат" : "Мат"}<br />/400</th>
                        <th className="px-1.5 py-2 text-right sm:px-2">{lang === "kk" ? "Сандық" : "Колич."}<br />/300</th>
                        <th className="px-1.5 py-2 text-right sm:px-2">{lang === "kk" ? "Жарат." : "Естеств."}<br />/200</th>
                        <th className="px-1.5 py-2 text-right sm:px-2">{lang === "kk" ? "Тілдер" : "Языки"}<br />/600</th>
                      </>
                    ) : (
                      <>
                        <th className="px-1.5 py-2 text-right sm:px-2">{lang === "kk" ? "Мат-логика" : "Мат-логика"}</th>
                        <th className="px-1.5 py-2 text-right sm:px-2">{lang === "kk" ? "Оқу" : "Чтение"}</th>
                      </>
                    )}
                    <th className="px-2 py-2 text-right font-bold text-ink sm:px-3">
                      {t.total}
                      <br />/{table.code === "NIS" ? 1500 : 240}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r) => {
                    const b = r.breakdown ?? {};
                    const s = (k: string) => Math.round(Number(b.subjects?.[k]?.score ?? 0));
                    return (
                      <tr key={r.zipgrade_id} className="border-t border-ink/5">
                        <td className="px-2 py-1.5 font-mono font-semibold text-ink sm:px-3">{r.place}</td>
                        <td className="hidden px-3 py-1.5 font-mono text-ink/55 sm:table-cell">{r.zipgrade_id}</td>
                        {table.code === "NIS" ? (
                          <>
                            <td className="px-1.5 py-1.5 text-right font-mono sm:px-2">{s("math")}</td>
                            <td className="px-1.5 py-1.5 text-right font-mono sm:px-2">{s("sandyq")}</td>
                            <td className="px-1.5 py-1.5 text-right font-mono sm:px-2">{s("zharatylystanu")}</td>
                            <td className="px-1.5 py-1.5 text-right font-mono sm:px-2">
                              {s("tilder_kk") + s("tilder_ru") + s("tilder_en")}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-1.5 py-1.5 text-right font-mono sm:px-2">{b.parts?.bil_math?.score ?? 0}</td>
                            <td className="px-1.5 py-1.5 text-right font-mono sm:px-2">{b.parts?.bil_reading?.score ?? 0}</td>
                          </>
                        )}
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-ink sm:px-3">
                          {Math.round(Number(r.total_score))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-ink/50">{t.participants(table.count)}</span>
              <Link href={`/result/${past.sessionId}`} className="font-semibold text-parent hover:underline">
                {t.allResults}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* қадамдар */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="mb-6 font-mono text-xs uppercase tracking-widest text-gold-deep">{t.stepsLabel}</p>
        <div className="grid gap-4 sm:grid-cols-4">
          {t.steps.map(([title, desc], i) => (
            <div key={title} className="rounded-2xl border border-ink/10 bg-white p-5">
              <p className="mb-2 font-mono text-sm font-semibold text-gold-deep">{String(i + 1).padStart(2, "0")}</p>
              <p className="mb-1.5 font-display text-base font-semibold text-ink">{title}</p>
              <p className="text-sm leading-relaxed text-ink/60">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* сұрақтар */}
      <section className="mx-auto max-w-3xl px-4 pb-12 sm:px-6">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-gold-deep">{t.faqLabel}</p>
        <div className="flex flex-col gap-2">
          {(t.faq as [string, (start: string) => string][]).map(([q, a]) => (
            <details key={q} className="group rounded-xl border border-ink/10 bg-white px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold text-ink">
                <span className="mr-2 inline-block text-gold-deep transition-transform group-open:rotate-90">›</span>
                {q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">{a(startTime || "08:00")}</p>
            </details>
          ))}
        </div>
      </section>

      {/* соңғы шақыру */}
      {next && (
        <section className="bg-ink px-4 py-14 text-center text-parchment sm:px-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{t.finalTitle}</h2>
          <p className="mt-3 text-lg text-gold">
            {humanDate(next.sessionDate, lang)} · {formatText} · {(price ?? 5000).toLocaleString("ru-RU")} ₸
          </p>
          {next.registrationClosesAt && left !== null && (
            <p className="mt-1 text-sm text-[#B9C1D0]">
              {t.closes(humanDate(next.registrationClosesAt, lang))} · {t.daysLeft(left)}
            </p>
          )}
          <div className="mt-6">
            <Cta big />
          </div>
        </section>
      )}
    </main>
  );
}
