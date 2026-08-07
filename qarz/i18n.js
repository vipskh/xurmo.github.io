// Tarjimalar. Standart til — o'zbekcha.
//
// HTML da: data-t="kalit" (matn), data-t-ph="kalit" (placeholder).
// JS da:   t('kalit')

export const LANGS = { uz: "O'zbekcha", ru: 'Русский', en: 'English' };

const DICT = {
	uz: {
		// Menyu
		debts: 'Qarzlar', notes: 'Eslatmalar', reports: 'Hisobotlar', settings: 'Sozlamalar',

		// Kirish
		signIn: 'Kirish', signUp: 'Ro‘yxatdan o‘tish',
		subSignIn: 'Hisobingizga kiring', subSignUp: 'Yangi hisob yarating',
		yourName: 'Ismingiz', email: 'Email', password: 'Parol',
		noAccount: 'Hisobingiz yo‘qmi? Ro‘yxatdan o‘tish',
		haveAccount: 'Hisobingiz bormi? Kirish',
		waiting: 'Kutilmoqda…',
		badCreds: 'Email yoki parol noto‘g‘ri',
		emailExists: 'Bu email allaqachon ro‘yxatdan o‘tgan',
		passShort: 'Parol kamida 8 belgidan iborat bo‘lsin',

		// Ro'yxat
		searchPh: 'Qidirish…', newBtn: '+ Yangi',
		noContacts: 'Kontakt yo‘q.', notFound: 'Topilmadi.',
		selectContact: 'Chapdan kontakt tanlang', loading: 'Yuklanmoqda…',
		loadFail: 'Yuklab bo‘lmadi',

		// Tafsilot
		balance: 'Balans', registration: 'Ro‘yxatdan o‘tgan',
		debt: 'Qarz', loan: 'To‘lov',
		informationPh: 'Ma‘lumot', save: 'Saqlash', saving: 'Saqlanmoqda…',
		enterHint1: 'Summani yozib', enterHint2: 'bosing',
		totalDebt: 'Jami qarz', totalPay: 'Jami to‘lov',
		colAmount: 'Summa', colInfo: 'Ma‘lumot', colDate: 'Sana',
		pendingMark: 'saqlanmoqda',
		saveFail: 'Saqlanmadi',

		// Yangi kontakt
		newContact: 'Yangi kontakt', name: 'Ism', information: 'Ma‘lumot',
		kind: 'Turi', amount: 'Summa', cancel: 'Bekor qilish',

		// Amallar
		edit: 'Tahrirlash', closeAccount: 'Hisobni yopish (0 qilish)',
		deleteContact: 'Kontaktni o‘chirish', close: 'Yopish',
		accountClosed: 'Hisob yopildi',
		deleteConfirm: 'butunlay o‘chirilsinmi? Barcha yozuvlari ham ketadi.',
		deleteFail: 'O‘chirilmadi',

		// Tafsilot oynasi
		entryDetails: 'Yozuv tafsiloti', contact: 'Kontakt',

		// Saralash
		sort: 'Saralash', byRecent: 'Oxirgi harakat bo‘yicha',
		byName: 'Ism bo‘yicha (A→Z)', byDebt: 'Eng ko‘p qarzdor', byLoan: 'Eng ko‘p bergan',

		// Hisobotlar
		totalDebts: 'Umumiy qarz', totalLoans: 'Umumiy to‘lov',
		dateRange: 'Sana oralig‘i', takenDebts: 'Olingan qarz',
		givenLoans: 'Berilgan to‘lov', differences: 'Farq',
		allTime: 'Butun vaqt', today: 'Bugun', week: 'Oxirgi 7 kun',
		month: 'Oxirgi 30 kun', year: 'Oxirgi 1 yil',

		// Sozlamalar
		currency: 'Valyuta', language: 'Til',
		backup: 'Zaxira nusxa — faylga saqlash', restore: 'Zaxiradan tiklash',
		account: 'Hisob', logout: 'Chiqish',
		dataNote: 'Ma‘lumot serverda saqlanadi — istalgan qurilmadan kirsangiz o‘sha yerda turadi.',
		restoreConfirm: 'ta kontakt qo‘shiladi. Mavjudlari o‘chmaydi.',
		restored: 'Tiklandi.', fileFail: 'Fayl o‘qilmadi',

		// Eslatmalar
		newNote: '+ Yangi eslatma', noNotes: 'Eslatma yo‘q.', notePrompt: 'Eslatma:',

		// Mehmon rejimi
		guestMode: 'Sinov rejimi', tryFree: 'Kirishsiz sinab ko‘rish',
		guestNote: 'Sinov rejimi: ma‘lumot faqat shu brauzerda saqlanadi. Kirsangiz serverga o‘tadi va istalgan qurilmadan ko‘rinadi.',
	},

	ru: {
		debts: 'Долги', notes: 'Заметки', reports: 'Отчёты', settings: 'Настройки',

		signIn: 'Войти', signUp: 'Регистрация',
		subSignIn: 'Войдите в аккаунт', subSignUp: 'Создайте аккаунт',
		yourName: 'Ваше имя', email: 'Email', password: 'Пароль',
		noAccount: 'Нет аккаунта? Зарегистрироваться',
		haveAccount: 'Есть аккаунт? Войти',
		waiting: 'Подождите…',
		badCreds: 'Неверный email или пароль',
		emailExists: 'Этот email уже зарегистрирован',
		passShort: 'Пароль не менее 8 символов',

		searchPh: 'Поиск…', newBtn: '+ Новый',
		noContacts: 'Контактов нет.', notFound: 'Не найдено.',
		selectContact: 'Выберите контакт слева', loading: 'Загрузка…',
		loadFail: 'Не удалось загрузить',

		balance: 'Баланс', registration: 'Добавлен',
		debt: 'Долг', loan: 'Оплата',
		informationPh: 'Информация', save: 'Сохранить', saving: 'Сохранение…',
		enterHint1: 'Введите сумму и нажмите', enterHint2: '',
		totalDebt: 'Всего долг', totalPay: 'Всего оплат',
		colAmount: 'Сумма', colInfo: 'Информация', colDate: 'Дата',
		pendingMark: 'сохраняется',
		saveFail: 'Не сохранено',

		newContact: 'Новый контакт', name: 'Имя', information: 'Информация',
		kind: 'Тип', amount: 'Сумма', cancel: 'Отмена',

		edit: 'Изменить', closeAccount: 'Закрыть счёт (обнулить)',
		deleteContact: 'Удалить контакт', close: 'Закрыть',
		accountClosed: 'Счёт закрыт',
		deleteConfirm: 'удалить полностью? Все записи тоже исчезнут.',
		deleteFail: 'Не удалено',

		entryDetails: 'Детали записи', contact: 'Контакт',

		sort: 'Сортировка', byRecent: 'По последней операции',
		byName: 'По имени (А→Я)', byDebt: 'Самый большой долг', byLoan: 'Больше всех оплатил',

		totalDebts: 'Всего долгов', totalLoans: 'Всего оплат',
		dateRange: 'Период', takenDebts: 'Взято в долг',
		givenLoans: 'Оплачено', differences: 'Разница',
		allTime: 'Всё время', today: 'Сегодня', week: 'Последние 7 дней',
		month: 'Последние 30 дней', year: 'Последний год',

		currency: 'Валюта', language: 'Язык',
		backup: 'Резервная копия — сохранить в файл', restore: 'Восстановить из копии',
		account: 'Аккаунт', logout: 'Выйти',
		dataNote: 'Данные хранятся на сервере — доступны с любого устройства.',
		restoreConfirm: 'контактов будет добавлено. Существующие не удалятся.',
		restored: 'Восстановлено.', fileFail: 'Файл не прочитан',

		newNote: '+ Новая заметка', noNotes: 'Заметок нет.', notePrompt: 'Заметка:',

		guestMode: 'Демо-режим', tryFree: 'Попробовать без входа',
		guestNote: 'Демо-режим: данные хранятся только в этом браузере. После входа они переедут на сервер.',
	},

	en: {
		debts: 'Debts', notes: 'Notes', reports: 'Reports', settings: 'Settings',

		signIn: 'Sign in', signUp: 'Sign up',
		subSignIn: 'Sign in to your account', subSignUp: 'Create a new account',
		yourName: 'Your name', email: 'Email', password: 'Password',
		noAccount: 'No account? Sign up',
		haveAccount: 'Have an account? Sign in',
		waiting: 'Please wait…',
		badCreds: 'Wrong email or password',
		emailExists: 'This email is already registered',
		passShort: 'Password must be at least 8 characters',

		searchPh: 'Search…', newBtn: '+ New',
		noContacts: 'No contacts.', notFound: 'Nothing found.',
		selectContact: 'Select a contact on the left', loading: 'Loading…',
		loadFail: 'Could not load',

		balance: 'Balance', registration: 'Registered',
		debt: 'Debt', loan: 'Loan',
		informationPh: 'Information', save: 'Save', saving: 'Saving…',
		enterHint1: 'Type an amount and press', enterHint2: '',
		totalDebt: 'Total debt', totalPay: 'Total paid',
		colAmount: 'Amount', colInfo: 'Information', colDate: 'Date',
		pendingMark: 'saving',
		saveFail: 'Not saved',

		newContact: 'New contact', name: 'Name', information: 'Information',
		kind: 'Type', amount: 'Amount', cancel: 'Cancel',

		edit: 'Edit', closeAccount: 'Close account (set to 0)',
		deleteContact: 'Delete contact', close: 'Close',
		accountClosed: 'Account closed',
		deleteConfirm: 'delete completely? All entries will be gone too.',
		deleteFail: 'Not deleted',

		entryDetails: 'Entry details', contact: 'Contact',

		sort: 'Sort', byRecent: 'By last activity',
		byName: 'By name (A→Z)', byDebt: 'Largest debt', byLoan: 'Paid the most',

		totalDebts: 'Total Debts', totalLoans: 'Total Loans',
		dateRange: 'Date Range', takenDebts: 'Taken Debts',
		givenLoans: 'Given Loans', differences: 'Differences',
		allTime: 'All Time', today: 'Today', week: 'Last 7 days',
		month: 'Last 30 days', year: 'Last year',

		currency: 'Currency', language: 'Language',
		backup: 'Backup — save to file', restore: 'Restore from backup',
		account: 'Account', logout: 'Sign out',
		dataNote: 'Data is stored on the server — available from any device.',
		restoreConfirm: 'contacts will be added. Existing ones stay.',
		restored: 'Restored.', fileFail: 'Could not read file',

		newNote: '+ New note', noNotes: 'No notes.', notePrompt: 'Note:',

		guestMode: 'Demo mode', tryFree: 'Try without signing in',
		guestNote: 'Demo mode: data stays in this browser only. Sign in to move it to the server.',
	},
};

const KEY = 'debtnote-lang';

export let lang = localStorage.getItem(KEY) in DICT ? localStorage.getItem(KEY) : 'uz';

export const t = (key) => DICT[lang][key] ?? DICT.uz[key] ?? key;

export const setLang = (next) => {
	if (!DICT[next]) return;
	lang = next;
	localStorage.setItem(KEY, next);
	applyLang();
};

// Sahifadagi barcha belgilangan matnlarni almashtiradi
export const applyLang = () => {
	document.documentElement.lang = lang;
	document.querySelectorAll('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t)));
	document.querySelectorAll('[data-t-ph]').forEach((el) => (el.placeholder = t(el.dataset.tPh)));
};
