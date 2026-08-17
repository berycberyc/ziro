export type Lang = "kk" | "ru";

export const dict = {
  kk: {
    tagline: "Байқау тесттерге тіркелу порталы",
    heroTitle: "Балаңыздың келесі байқау тестін осында броньдаңыз",
    heroBody:
      "НЗМ, БИЛ және РФММ байқау тесттерін офлайн немесе онлайн тапсырып нәтижені алыңыз.",
    ctaPrimary: "Тіркелу",
    ctaSecondary: "Кіру",
    testsTitle: "Жақын арадағы байқаулар",
    online: "Онлайн",
    offline: "Офлайн",
    seats: "Бос орын",
    book: "Тіркелу",
    footerNote: "© Ziro. Барлық құқықтар қорғалған.",
    testNames: { NISH: "НЗМ", BIL: "БИЛ", RFMSH: "РФММ" },
    fullName: "Аты-жөні",
    phone: "Телефон",
    email: "Email",
    password: "Құпия сөз",
    registerTitle: "Тіркелу",
    registerSubmit: "Тіркелу",
    haveAccount: "Аккаунтыңыз бар ма?",
    loginTitle: "Кіру",
    loginSubmit: "Кіру",
    noAccount: "Аккаунтыңыз жоқ па?",
    authError: "Қате шықты. Деректерді тексеріп, қайта көріңіз.",
    noSessions: "Әзірге жоспарланған байқаулар жоқ.",
    formatNote: "Онлайн немесе офлайн — броньдау кезінде таңдайсыз",

    // Shared
    loading: "Жүктелуде...",
    logout: "Шығу",
    save: "Сақтау",
    saved: "Сақталды",
    add: "Қосу",
    errorGeneric: "Қате шықты, қайта көріңіз.",

    // Parent sidebar
    navProfile: "Профиль",
    navStudents: "Оқушы",
    navTests: "Тесттер",
    navBookings: "Брондарым",

    // Profile page
    profileTitle: "Профиль",
    newPasswordLabel: "Жаңа құпия сөз (өзгертпесеңіз бос қалдырыңыз)",

    // Students page
    studentsTitle: "Оқушы",
    myChildrenTitle: "Балаларым",
    noChildren: "Әзірге бала қосылмаған.",
    addChildTitle: "Жаңа бала қосу",
    gradePlaceholder: "Сынып",
    schoolPlaceholder: "Мектеп",
    iinPlaceholder: "ИИН",
    langKk: "Қазақша",
    langRu: "Орысша",
    photoLabel: "Оқушының фотосуреті",
    photoNote:
      "Фото ақ фонда, тура қарап тұрған түрде түсірілуі керек. Максималды өлшемі — 5МБ.",
    photoTooLarge: "Файл тым үлкен (максимум 5МБ).",
    photoInvalidType: "Тек сурет файлын (JPG, PNG) жүктеуге болады.",

    // Tests page
    testsPageTitle: "Тесттер",
    noAvailableTests: "Әзірге қолжетімді тест жоқ.",
    bookedMessage:
      'Брондалды! Төлем растаудан кейін пропускты "Брондарым" бөлімінен көресіз.',

    // Bookings / pass
    bookingsTitle: "Брондарым",
    noBookings: "Әзірге брондау жоқ.",
    statusPaid: "Төленді",
    statusPending: "Төлем күтілуде",
    testTypeLabel: "Тест түрі",
    dateLabel: "Күні",
    timeLabel: "Уақыты",
    addressLabel: "Мекенжай",
    roomLabel: "Аудитория",
    passArriveNote:
      "Тестке кемінде 15 минут бұрын келуіңізді сұраймыз. Тіркеу тест басталуына 10 минут қалғанда жабылады.",
    passBringNote:
      "Өзіңізбен бірге осы пропускты, туу туралы куәлікті және көк немесе қара сиялы қалам алып келіңіз.",
    resultsReady: "Нәтиже дайын — жақын арада осында көрсетіледі.",
    printSave: "Жүктеп алу (PDF)",
    passWaitingPayment: "Төлем расталғаннан кейін пропуск осында пайда болады.",
    passLabel: "Рұқсат қағазы",
    studentIdLabel: "Оқушы ID",
    sessionLabel: "Сессия",

    // Admin
    adminNoAccess: "Бұл бетке қол жеткізу құқығыңыз жоқ.",

    // Teacher
    teacherNoAccess: "Бұл бетке қол жеткізу құқығыңыз жоқ.",
    navScan: "Пропускты сканерлеу",
    teacherScanTitle: "Пропускты сканерлеу",
    teacherScanPlaceholder: "Бұл бөлім әзірленуде.",
    scanNoSessions: "Тексеру режиміндегі сессия жоқ.",
    scanBooked: "Брондалған",
    scanArrived: "Келді",
    scanRemaining: "Қалды",
    scanWaitingForQr: "QR күтілуде...",
    scanWrongSession: "Бұл рұқсат қағаз басқа сессияға тиесілі.",
    scanUnknownCode: "Мұндай рұқсат қағаз табылмады.",
    scanManualToggle: "Қолмен іздеу",
    scanBackToCamera: "Камераға оралу",
    scanManualPlaceholder: "Аты-жөні немесе код бойынша іздеу",
    scanSeatLabel: "Орын",
    scanMarkButton: "Белгілеу",
    scanAlreadyShort: "Келді",
    scanAlreadyAt: "Белгіленген уақыты:",
  },
  ru: {
    tagline: "Портал регистрации на пробные тесты",
    heroTitle: "Забронируйте следующий тест для вашего ребёнка",
    heroBody:
      "Регистрация на пробные тесты НИШ, БИЛ и РФМШ, оплата и результаты — в одном месте, онлайн или офлайн формат.",
    ctaPrimary: "Зарегистрироваться",
    ctaSecondary: "Войти",
    testsTitle: "Ближайшие тесты",
    online: "Онлайн",
    offline: "Офлайн",
    seats: "Свободно мест",
    book: "Записаться",
    footerNote: "© Ziro. Все права защищены.",
    testNames: { NISH: "НИШ", BIL: "БИЛ", RFMSH: "РФМШ" },
    fullName: "ФИО",
    phone: "Телефон",
    email: "Email",
    password: "Пароль",
    registerTitle: "Регистрация",
    registerSubmit: "Зарегистрироваться",
    haveAccount: "Уже есть аккаунт?",
    loginTitle: "Вход",
    loginSubmit: "Войти",
    noAccount: "Нет аккаунта?",
    authError: "Произошла ошибка. Проверьте данные и попробуйте снова.",
    noSessions: "Пока нет запланированных тестов.",
    formatNote: "Онлайн или офлайн — выбирается при бронировании",

    // Shared
    loading: "Загрузка...",
    logout: "Выйти",
    save: "Сохранить",
    saved: "Сохранено",
    add: "Добавить",
    errorGeneric: "Произошла ошибка, попробуйте снова.",

    // Parent sidebar
    navProfile: "Профиль",
    navStudents: "Ученик",
    navTests: "Тесты",
    navBookings: "Мои брони",

    // Profile page
    profileTitle: "Профиль",
    newPasswordLabel: "Новый пароль (оставьте пустым, если не меняете)",

    // Students page
    studentsTitle: "Ученик",
    myChildrenTitle: "Мои дети",
    noChildren: "Пока нет добавленных детей.",
    addChildTitle: "Добавить ребёнка",
    gradePlaceholder: "Класс",
    schoolPlaceholder: "Школа",
    iinPlaceholder: "ИИН",
    langKk: "Казахский",
    langRu: "Русский",
    photoLabel: "Фото ученика",
    photoNote:
      "Фото должно быть на белом фоне, лицо строго анфас. Максимальный размер — 5МБ.",
    photoTooLarge: "Файл слишком большой (максимум 5МБ).",
    photoInvalidType: "Можно загружать только изображения (JPG, PNG).",

    // Tests page
    testsPageTitle: "Тесты",
    noAvailableTests: "Пока нет доступных тестов.",
    bookedMessage:
      'Забронировано! После подтверждения оплаты пропуск появится в разделе "Мои брони".',

    // Bookings / pass
    bookingsTitle: "Мои брони",
    noBookings: "Пока нет бронирований.",
    statusPaid: "Оплачено",
    statusPending: "Ожидает оплаты",
    testTypeLabel: "Тип теста",
    dateLabel: "Дата",
    timeLabel: "Время",
    addressLabel: "Адрес",
    roomLabel: "Аудитория",
    passArriveNote:
      "Пожалуйста, приходите минимум за 15 минут до начала теста. Регистрация закрывается за 10 минут до начала.",
    passBringNote:
      "Возьмите с собой этот пропуск, свидетельство о рождении и синюю или чёрную ручку.",
    resultsReady: "Результат готов — скоро появится здесь.",
    printSave: "Скачать (PDF)",
    passWaitingPayment: "Пропуск появится здесь после подтверждения оплаты.",
    passLabel: "Пропуск",
    studentIdLabel: "ID ученика",
    sessionLabel: "Сессия",

    // Admin
    adminNoAccess: "У вас нет доступа к этой странице.",

    // Teacher
    teacherNoAccess: "У вас нет доступа к этой странице.",
    navScan: "Сканирование пропуска",
    teacherScanTitle: "Сканирование пропуска",
    teacherScanPlaceholder: "Этот раздел находится в разработке.",
    scanNoSessions: "Нет сессий в режиме проверки.",
    scanBooked: "Забронировано",
    scanArrived: "Пришло",
    scanRemaining: "Осталось",
    scanWaitingForQr: "Ожидание QR...",
    scanWrongSession: "Этот пропуск относится к другой сессии.",
    scanUnknownCode: "Такой пропуск не найден.",
    scanManualToggle: "Ручной поиск",
    scanBackToCamera: "Вернуться к камере",
    scanManualPlaceholder: "Поиск по имени или коду",
    scanSeatLabel: "Место",
    scanMarkButton: "Отметить",
    scanAlreadyShort: "Пришёл",
    scanAlreadyAt: "Отмечен в:",
  },
};
