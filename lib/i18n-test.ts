import type { SubjectKey } from "@/lib/questions/subjects";

/**
 * Онлайн тест экрандарының сөздігі.
 *
 * Неге бөлек файл: lib/i18n.ts — ата-ана кабинетінің сөздігі, ол сайттың
 * тіл ауыстырғышына байланысты. Тест экранының тілі мүлдем басқа жерден
 * келеді: оқушының карточкасындағы `language` өрісінен (start_test_attempt
 * оны `student_language` деп қайтарады). Екеуін араластырмау үшін бөлек.
 *
 * Мұнда тек оқушы көретін сөздер. Сұрақтың өз мәтіні базадан келеді.
 */

export type TestLang = "kk" | "ru";

const MONTHS: Record<TestLang, string[]> = {
  kk: [
    "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
    "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
  ],
  ru: [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ],
};

/**
 * "18 қазан, 10:00" / "18 октября, 10:00" — әрқашан Астана уақытымен.
 * Айдың атауын өзіміз қоямыз: браузердің қазақша күнтізбесі әр жерде әр
 * түрлі жазады, ал орысшасы қазақ экранында орысша шығып кетер еді.
 */
export function formatStartMoment(ms: number, lang: TestLang): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const monthIndex = Number(get("month")) - 1;
  const month = MONTHS[lang][monthIndex] ?? get("month");

  return `${get("day")} ${month}, ${get("hour")}:${get("minute")}`;
}

/** Пән атаулары — бір тілде, екеуі қатар емес. */
export const TEST_SUBJECT_LABELS: Record<SubjectKey, Record<TestLang, string>> = {
  math: { kk: "Математика", ru: "Математика" },
  sandyq: { kk: "Сандық сипаттамалар", ru: "Количественные характеристики" },
  zharatylystanu: { kk: "Жаратылыстану", ru: "Естествознание" },
  tilder: { kk: "Тілдер", ru: "Языки" },
  bil: { kk: "БИЛ", ru: "БИЛ" },
  rfmsh: { kk: "РФММ", ru: "РФМШ" },
};

export type TestText = {
  loading: string;

  // Қателер
  errNotFound: string;
  errNoSession: string;
  errNoBlocks: string;
  errNoQuestions: string;
  errLoadQuestions: string;
  errStart: string;
  errFinish: string;
  errDeadlinePassed: string;
  errBlockOver: string;

  // Тест басталуын күту
  waitingTitle: string;
  waitingWhen: (moment: string) => string;
  waitingSelfOpens: string;
  waitingHint: string;
  waitingEntryRule: string;

  // Кіру жабылды
  entryClosedTitle: string;
  entryClosedBody: string;
  entryClosedNote: string;

  // Ережелер
  consentTitle: string;
  consentRules: string[];
  consentCheck: string;
  consentContinue: string;

  // Блокты бастау / үзіліс
  breakLabel: string;
  blockMinutes: (minutes: number) => string;
  untilSubject: (subject: string) => string;
  breakHint: string;
  blockCounter: (current: number, total: number) => string;
  startNow: string;
  start: string;

  // Оқушы жоқта уақыты өтіп кеткен блок
  expiredTitle: string;
  expiredBody: string;
  expiredNext: string;
  expiredFinish: string;

  // Аяқталды
  finishedTitle: string;
  finishedBody: string;

  // Сұрақ экраны
  answeredOf: (answered: number, total: number) => string;
  saving: string;
  saved: string;
  retrying: string;
  answerPlaceholder: string;
  columnA: string;
  columnB: string;
  prev: string;
  next: string;
  finishBlock: string;
  sending: string;
  confirmBody: (unanswered: number) => string;
  confirmBack: string;
  confirmFinish: string;
};

export const TEST_TEXT: Record<TestLang, TestText> = {
  kk: {
    loading: "Жүктелуде...",

    errNotFound: "Брондау табылмады немесе онлайн формат емес.",
    errNoSession: "Сессия деректері табылмады. Ұйымдастырушыға хабарласыңыз.",
    errNoBlocks: "Бұл тест түріне пәндер тізімі бапталмаған.",
    errNoQuestions: "Бұл пән бойынша сұрақтар табылмады. Ұйымдастырушыға хабарласыңыз.",
    errLoadQuestions: "Сұрақтарды жүктеу кезінде қате шықты. Бетті жаңартып көріңіз.",
    errStart: "Тестті бастау мүмкін болмады. Интернетті тексеріп, қайталаңыз.",
    errFinish: "Блокты аяқтау кезінде қате шықты. Интернетті тексеріп, бетті жаңартыңыз.",
    errDeadlinePassed: "Тестке берілген жалпы уақыт аяқталды. Жауаптарыңыз сақталды.",
    errBlockOver: "Бұл блоктың уақыты аяқталды. Жауаптарыңыз сақталды.",

    waitingTitle: "Тест әлі басталған жоқ",
    waitingWhen: (moment) => `Тест ${moment}-де басталады (Астана уақыты).`,
    waitingSelfOpens: "Тест өзі ашылады, бетті жаңартудың қажеті жоқ.",
    waitingHint:
      "Басталуға 10 минут қалғанда осы бетте кері санақ шығады. Бетті ашық қалдыруға болады.",
    waitingEntryRule:
      "Кіру тест басталғаннан кейін 30 минут бойы ашық. Одан кейін кіру мүмкін емес.",

    entryClosedTitle: "Кіру жабылды",
    entryClosedBody:
      "Тестке кіру басталғаннан кейін 30 минут бойы ашық болды, ол уақыт өтіп кетті.",
    entryClosedNote: "Бұл ереже барлық қатысушыға бірдей қолданылады.",

    consentTitle: "Тест ережелері",
    consentRules: [
      "Әр пәнге белгіленген уақыт беріледі. Уақыт біткенде блок автоматты жабылады.",
      "Уақыт сервер бойынша есептеледі — бетті жаңартсаңыз да жалғаса береді.",
      "Блок ішінде сұрақтар арасында еркін жүруге, жауапты өзгертуге болады.",
      "Блокты аяқтағаннан кейін оған қайта оралу мүмкін емес.",
    ],
    consentCheck: "Мен осы ережелермен таныстым.",
    consentContinue: "Жалғастыру",

    breakLabel: "Үзіліс",
    blockMinutes: (minutes) => `Уақыт: ${minutes} минут.`,
    untilSubject: (subject) => `${subject} пәніне дейін:`,
    breakHint: "Дайын болсаңыз — қазір бастаңыз. Баспасаңыз, уақыт біткенде блок өзі басталады.",
    blockCounter: (current, total) => `Блок ${current} / ${total}`,
    startNow: "Қазір бастау",
    start: "Бастау",

    expiredTitle: "Бұл блоктың уақыты бітті",
    expiredBody:
      "Сіз бетте болмаған кезде осы блоктың уақыты аяқталды. Берген жауаптарыңыз сақталды.",
    expiredNext: "Келесі блокқа өту",
    expiredFinish: "Тестті аяқтау",

    finishedTitle: "Тест аяқталды",
    finishedBody:
      "Жауаптарыңыз қабылданды. Нәтиже барлық қатысушы тапсырғаннан кейін жеке кабинетте жарияланады.",

    answeredOf: (answered, total) => `${answered} / ${total} жауап берілді`,
    saving: "Сақталуда...",
    saved: "Сақталды ✓",
    retrying: "Байланыс жоқ — қайта жіберілуде...",
    answerPlaceholder: "Жауап",
    columnA: "А бағаны",
    columnB: "В бағаны",
    prev: "← Алдыңғы",
    next: "Келесі →",
    finishBlock: "Блокты аяқтау",
    sending: "Жіберілуде...",
    confirmBody: (unanswered) =>
      `${unanswered} сұраққа жауап берілмеген. Блокты аяқтасаңыз, оған қайта оралу мүмкін емес.`,
    confirmBack: "Оралу",
    confirmFinish: "Аяқтау",
  },

  ru: {
    loading: "Загрузка...",

    errNotFound: "Бронь не найдена или это не онлайн-формат.",
    errNoSession: "Данные сессии не найдены. Свяжитесь с организатором.",
    errNoBlocks: "Для этого типа теста не настроен список предметов.",
    errNoQuestions: "Вопросы по этому предмету не найдены. Свяжитесь с организатором.",
    errLoadQuestions: "Не удалось загрузить вопросы. Попробуйте обновить страницу.",
    errStart: "Не удалось начать тест. Проверьте интернет и попробуйте снова.",
    errFinish: "Не удалось завершить блок. Проверьте интернет и обновите страницу.",
    errDeadlinePassed: "Общее время на тест закончилось. Ваши ответы сохранены.",
    errBlockOver: "Время этого блока закончилось. Ваши ответы сохранены.",

    waitingTitle: "Тест ещё не начался",
    waitingWhen: (moment) => `Тест начнётся ${moment} (время Астаны).`,
    waitingSelfOpens: "Тест откроется сам, обновлять страницу не нужно.",
    waitingHint:
      "За 10 минут до начала здесь появится обратный отсчёт. Страницу можно оставить открытой.",
    waitingEntryRule:
      "Вход открыт 30 минут после начала теста. После этого войти уже нельзя.",

    entryClosedTitle: "Вход закрыт",
    entryClosedBody: "Вход в тест был открыт 30 минут после начала — это время уже прошло.",
    entryClosedNote: "Это правило одинаково для всех участников.",

    consentTitle: "Правила теста",
    consentRules: [
      "На каждый предмет даётся своё время. Когда оно заканчивается, блок закрывается сам.",
      "Время считается по серверу — даже если обновить страницу, отсчёт продолжится.",
      "Внутри блока можно свободно переходить между вопросами и менять ответы.",
      "После завершения блока вернуться к нему уже нельзя.",
    ],
    consentCheck: "Я ознакомился с правилами.",
    consentContinue: "Продолжить",

    breakLabel: "Перерыв",
    blockMinutes: (minutes) => `Время: ${minutes} минут.`,
    untilSubject: (subject) => `До предмета «${subject}»:`,
    breakHint:
      "Если готовы — начните сейчас. Если не нажать, блок начнётся сам, когда время выйдет.",
    blockCounter: (current, total) => `Блок ${current} из ${total}`,
    startNow: "Начать сейчас",
    start: "Начать",

    expiredTitle: "Время этого блока истекло",
    expiredBody:
      "Пока вас не было на странице, время этого блока закончилось. Ваши ответы сохранены.",
    expiredNext: "Перейти к следующему блоку",
    expiredFinish: "Завершить тест",

    finishedTitle: "Тест завершён",
    finishedBody:
      "Ваши ответы приняты. Результат появится в личном кабинете после того, как сдадут все участники.",

    answeredOf: (answered, total) => `Отвечено ${answered} из ${total}`,
    saving: "Сохранение...",
    saved: "Сохранено ✓",
    retrying: "Нет связи — отправляем снова...",
    answerPlaceholder: "Ответ",
    columnA: "Столбец A",
    columnB: "Столбец B",
    prev: "← Предыдущий",
    next: "Следующий →",
    finishBlock: "Завершить блок",
    sending: "Отправка...",
    confirmBody: (unanswered) =>
      `Без ответа осталось вопросов: ${unanswered}. После завершения блока вернуться к нему нельзя.`,
    confirmBack: "Вернуться",
    confirmFinish: "Завершить",
  },
};
