// Debt Note — kompyuter versiyasi.
//
// TEZLIK HAQIDA:
// Server Frankfurtda, Toshkentdan har so'rov ~150 ms oladi (masofa —
// buni tezlashtirib bo'lmaydi). Shuning uchun ekran DARHOL yangilanadi,
// serverga esa fonda yuboriladi. Xato bo'lsa o'zgarish orqaga qaytariladi
// va foydalanuvchiga aytiladi.

import * as store from './store.js';
import { t, lang, setLang, applyLang, LANGS } from './i18n.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
	({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Holat ----------

let db = { contacts: [], notes: [], cur: '$' };
let user = null;
let openId = null;
let sortMode = 'recent';
let ranges = { a: 'all', b: 'all' };

const CUR_KEY = 'debtnote-cur';

// Balans hisoblanadi, saqlanmaydi — "balans mos emas" muammosi bo'lmasin
const sums = (c) => {
	let debt = 0, loan = 0;
	for (const e of c.entries) (e.kind === 'debt' ? (debt += e.amount) : (loan += e.amount));
	return { debt, loan, balance: loan - debt };
};

const lastAt = (c) => c.entries.length ? Math.max(...c.entries.map((e) => e.at)) : c.createdAt;
const byId = (id) => db.contacts.find((x) => x.id === id);

// ---------- Format ----------
// Summalar bazada TIYIN/SENTDA (butun son) — kasrli son bilan qo'shishda
// xato bo'lmasin (0.1 + 0.2 !== 0.3).

const fmt = (cents) => {
	const major = Math.abs(cents) / 100;
	return major.toLocaleString('ru-RU', {
		minimumFractionDigits: major % 1 ? 2 : 0,
		maximumFractionDigits: 2,
	});
};

const money = (n) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${fmt(n)} ${db.cur}`;
const plain = (n) => `${fmt(n)} ${db.cur}`;

const pad = (n) => String(n).padStart(2, '0');
const dt = (ts) => {
	const d = new Date(ts);
	return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "12 500" yoki "12500.50" → tiyin
const toNum = (v) => {
	const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
	if (!Number.isFinite(n) || n <= 0) return null;
	return Math.round(n * 100);
};

// ---------- Ekranlar ----------

const SCREENS = ['login', 'debts', 'notes', 'reports', 'settings'];

const show = (name) => {
	SCREENS.forEach((s) => $(`s-${s}`).classList.toggle('is-on', s === name));
	$('topnav').hidden = name === 'login';
	document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-on', t.dataset.tab === name));
	if (name === 'debts') renderList();
	if (name === 'notes') renderNotes();
	if (name === 'reports') renderReports();
};

document.querySelectorAll('.tab').forEach((t) =>
	t.addEventListener('click', () => show(t.dataset.tab)));

// ---------- Kontaktlar ro'yxati ----------

const sortContacts = (list) => {
	const by = {
		recent: (a, b) => lastAt(b) - lastAt(a),
		name: (a, b) => a.name.localeCompare(b.name, 'uz'),
		debt: (a, b) => sums(a).balance - sums(b).balance,
		loan: (a, b) => sums(b).balance - sums(a).balance,
	};
	return [...list].sort(by[sortMode]);
};

// Telefon raqami turlicha yozilishi mumkin: "+998 90 018 05 09",
// "998900180509", "90-018-05-09". Qidiruvda faqat raqamlar solishtiriladi,
// shunda bo'sh joy va chiziqchalar xalaqit bermaydi.
const digits = (s) => String(s).replace(/\D/g, '');

const matches = (c, q) => {
	if (!q) return true;
	if (c.name.toLowerCase().includes(q)) return true;
	if ((c.info || '').toLowerCase().includes(q)) return true;

	const qd = digits(q);
	return qd.length >= 3 && digits(c.info || '').includes(qd);
};

const renderList = () => {
	const q = $('q').value.trim().toLowerCase();
	const list = sortContacts(db.contacts).filter((c) => matches(c, q));

	if (!list.length) {
		$('contact-list').innerHTML = `<p class="empty">${t(db.contacts.length ? 'notFound' : 'noContacts')}</p>`;
		return;
	}

	$('contact-list').innerHTML = list.map((c) => {
		const { balance } = sums(c);
		return `
		<div class="contact${c.id === openId ? ' is-active' : ''}" data-id="${c.id}">
			<div class="ava-wrap">
				<div class="ava">${esc((c.name[0] || '?').toUpperCase())}</div>
				<span class="ava-dot${balance === 0 ? ' paid' : ''}"></span>
			</div>
			<div class="c-main">
				<div class="c-nm">${esc(c.name)}</div>
				<div class="c-time">${esc(c.info) || dt(lastAt(c)).slice(0, 10)}</div>
			</div>
			<div class="c-bal ${balance < 0 ? 'neg' : ''}">${money(balance)}</div>
		</div>`;
	}).join('');
};

$('contact-list').addEventListener('click', (e) => {
	const row = e.target.closest('.contact');
	if (row) openContact(row.dataset.id);
});

$('q').addEventListener('input', renderList);

// ---------- Kontakt tafsiloti ----------

const openContact = (id) => {
	const c = byId(id);
	if (!c) return;
	openId = id;

	$('pane-empty').hidden = true;
	$('detail-inner').hidden = false;
	$('detail-pane').classList.add('is-open');   // telefonda o'ngdan chiqadi

	$('c-name').textContent = c.name;
	$('c-info').textContent = c.info || '';
	$('c-reg').textContent = `${t('registration')}: ${dt(c.createdAt)}`;

	const { debt, loan, balance } = sums(c);
	$('c-balance').textContent = money(balance);
	$('c-balance').className = `d-bal-num ${balance < 0 ? 'neg' : ''}`;
	$('c-sum-debt').textContent = debt ? `−${plain(debt)}` : `0 ${db.cur}`;
	$('c-sum-loan').textContent = loan ? `+${plain(loan)}` : `0 ${db.cur}`;

	$('c-history').innerHTML = [...c.entries].sort((a, b) => b.at - a.at).map((e) => `
		<tr class="${e.kind}">
			<td class="h-amt ${e.kind === 'debt' ? 'neg' : ''}">${e.kind === 'debt' ? '−' : '+'}${plain(e.amount)}</td>
			<td class="h-note">${esc(e.note) || '—'}</td>
			<td class="h-date">${dt(e.at)}${e.pending ? ` · ${t('pendingMark')}` : ''}</td>
			<td><button class="i-btn" data-info="${e.id}">
				<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
			</button></td>
		</tr>`).join('');

	renderList();
};

// Debt / Loan
const setSeg = (segId, kind) =>
	$(segId).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.kind === kind));

['c-seg', 'n-seg'].forEach((id) =>
	$(id).addEventListener('click', (e) => {
		const b = e.target.closest('button');
		if (b) setSeg(id, b.dataset.kind);
	}));

const segKind = (id) => $(id).querySelector('button.on').dataset.kind;

// ---------- Yozuv qo'shish (darhol) ----------

$('c-save').addEventListener('click', async () => {
	const amount = toNum($('c-amount').value);
	if (!amount) { $('c-amount').focus(); return; }

	const c = byId(openId);
	const data = { kind: segKind('c-seg'), amount, note: $('c-note').value.trim() };

	// 1. Ekranni darhol yangilaymiz — server javobini kutmasdan
	const temp = { id: `tmp-${Date.now()}`, ...data, at: Date.now(), pending: true };
	c.entries.push(temp);
	$('c-amount').value = '';
	$('c-note').value = '';
	$('c-amount').focus();
	openContact(openId);

	// 2. Serverga fonda yuboramiz
	try {
		const saved = await store.addEntry(user.$id, c.id, data);
		Object.assign(temp, saved, { pending: false });
	} catch (e) {
		c.entries = c.entries.filter((x) => x !== temp);
		alert(`${t('saveFail')}: ${e.message}`);
	}
	if (openId === c.id) openContact(c.id);
});

const enterSaves = (id) => $(id).addEventListener('keydown', (e) => {
	if (e.key === 'Enter') { e.preventDefault(); $('c-save').click(); }
});
enterSaves('c-amount');
enterSaves('c-note');

// ---------- Yangi kontakt ----------

document.querySelector('[data-new-contact]').addEventListener('click', () => {
	['n-name', 'n-info', 'n-amount', 'n-note'].forEach((id) => ($(id).value = ''));
	setSeg('n-seg', 'debt');
	openSheet('newsheet');
	$('n-name').focus();
});

$('n-save').addEventListener('click', async () => {
	const name = $('n-name').value.trim();
	if (!name) { $('n-name').focus(); return; }
	const amount = toNum($('n-amount').value);
	if (!amount) { $('n-amount').focus(); return; }

	const info = $('n-info').value.trim();
	const entry = { kind: segKind('n-seg'), amount, note: $('n-note').value.trim() };

	// Kontakt yaratilishi serverdan ID talab qiladi — bu yerda kutamiz,
	// lekin bu kamdan-kam amal (yozuv qo'shish esa darhol)
	const btn = $('n-save');
	btn.disabled = true;
	btn.textContent = t('saving');

	try {
		const c = await store.addContact(user.$id, { name, info });
		c.entries.push(await store.addEntry(user.$id, c.id, entry));
		db.contacts.push(c);
		closeSheets();
		openContact(c.id);
	} catch (e) {
		alert(`${t('saveFail')}: ${e.message}`);
	} finally {
		btn.disabled = false;
		btn.textContent = t('save');
	}
});

$('n-amount').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('n-save').click(); });

// ---------- Kontakt amallari ----------

$('c-menu').addEventListener('click', () => openSheet('ctxsheet'));

$('ctx-edit').addEventListener('click', async () => {
	const c = byId(openId);
	const name = prompt(`${t('name')}:`, c.name);
	if (name === null) return;
	const info = prompt(`${t('information')}:`, c.info || '');
	if (info === null) return;
	closeSheets();

	const before = { name: c.name, info: c.info };
	c.name = name.trim() || c.name;
	c.info = info.trim();
	openContact(c.id);

	try {
		await store.updateContact(c.id, { name: c.name, info: c.info });
	} catch (e) {
		Object.assign(c, before);
		openContact(c.id);
		alert(`${t('saveFail')}: ${e.message}`);
	}
});

// Hisobni yopish: yozuv o'chirilmaydi, teskari yozuv qo'shiladi —
// tarix butun qoladi
$('ctx-clear').addEventListener('click', async () => {
	const c = byId(openId);
	const { balance } = sums(c);
	closeSheets();
	if (!balance) return;

	const data = { kind: balance < 0 ? 'loan' : 'debt', amount: Math.abs(balance), note: t('accountClosed') };
	const temp = { id: `tmp-${Date.now()}`, ...data, at: Date.now(), pending: true };
	c.entries.push(temp);
	openContact(c.id);

	try {
		Object.assign(temp, await store.addEntry(user.$id, c.id, data), { pending: false });
	} catch (e) {
		c.entries = c.entries.filter((x) => x !== temp);
		alert(`${t('saveFail')}: ${e.message}`);
	}
	openContact(c.id);
});

$('ctx-del').addEventListener('click', async () => {
	const c = byId(openId);
	if (!confirm(`"${c.name}" ${t('deleteConfirm')}`)) return;
	closeSheets();

	const backup = c;
	db.contacts = db.contacts.filter((x) => x.id !== c.id);
	openId = null;
	$('detail-inner').hidden = true;
	$('pane-empty').hidden = false;
	renderList();

	try {
		await store.deleteContact(c.id, c.entries);
	} catch (e) {
		db.contacts.push(backup);
		renderList();
		alert(`${t('deleteFail')}: ${e.message}`);
	}
});

// ---------- (i) tafsilot ----------

$('c-history').addEventListener('click', (e) => {
	const btn = e.target.closest('[data-info]');
	if (!btn) return;

	const c = byId(openId);
	const en = c.entries.find((x) => x.id === btn.dataset.info);
	if (!en) return;

	$('det-body').innerHTML = `
		<div><span>${t('kind')}</span><span class="${en.kind === 'debt' ? 'neg' : ''}">${t(en.kind)}</span></div>
		<div><span>${t('colAmount')}</span><span>${en.kind === 'debt' ? '−' : '+'}${plain(en.amount)}</span></div>
		<div><span>${t('colDate')}</span><span>${dt(en.at)}</span></div>
		<div><span>${t('information')}</span><span>${esc(en.note) || '—'}</span></div>
		<div><span>${t('contact')}</span><span>${esc(c.name)}</span></div>`;
	openSheet('infosheet');
});

// ---------- Saralash ----------

document.querySelector('[data-sort]').addEventListener('click', () => openSheet('sortsheet'));

$('sortsheet').addEventListener('click', (e) => {
	const b = e.target.closest('[data-s]');
	if (!b) return;
	sortMode = b.dataset.s;
	closeSheets();
	renderList();
});

// ---------- Notes ----------

const renderNotes = () => {
	if (!db.notes.length) {
		$('note-list').innerHTML = `<p class="empty">${t('noNotes')}</p>`;
		return;
	}
	$('note-list').innerHTML = [...db.notes].sort((a, b) => b.at - a.at).map((n) => `
		<div class="note-item">
			<div class="note-text">${esc(n.text)}<div class="note-date">${dt(n.at)}</div></div>
			<button class="i-btn" data-del-note="${n.id}">
				<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>
			</button>
		</div>`).join('');
};

document.querySelector('[data-new-note]').addEventListener('click', () => {
	const text = prompt(t('notePrompt'));
	if (!text?.trim()) return;
	db.notes.push({ id: Date.now().toString(36), text: text.trim(), at: Date.now() });
	store.saveNotes(db.notes);
	renderNotes();
});

$('note-list').addEventListener('click', (e) => {
	const b = e.target.closest('[data-del-note]');
	if (!b) return;
	db.notes = db.notes.filter((n) => n.id !== b.dataset.delNote);
	store.saveNotes(db.notes);
	renderNotes();
});

// ---------- Reports ----------

const RANGE_MS = { today: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 };
const RANGE_KEY = { all: 'allTime', today: 'today', week: 'week', month: 'month', year: 'year' };

const totals = (r) => {
	let debt = 0, loan = 0;
	for (const c of db.contacts) {
		for (const e of c.entries) {
			if (r !== 'all' && e.at < Date.now() - RANGE_MS[r]) continue;
			e.kind === 'debt' ? (debt += e.amount) : (loan += e.amount);
		}
	}
	return { debt, loan };
};

const renderReports = () => {
	const a = totals(ranges.a);
	$('r-total-debts').textContent = a.debt ? `−${plain(a.debt)}` : `0 ${db.cur}`;
	$('r-total-loans').textContent = a.loan ? `+${plain(a.loan)}` : `0 ${db.cur}`;
	$('r-range-a').textContent = t(RANGE_KEY[ranges.a]);

	const b = totals(ranges.b);
	$('r-taken').textContent = b.debt ? `−${plain(b.debt)}` : `0 ${db.cur}`;
	$('r-given').textContent = b.loan ? `+${plain(b.loan)}` : `0 ${db.cur}`;
	const diff = b.loan - b.debt;
	$('r-diff').textContent = money(diff);
	$('r-diff').className = `rep-val ${diff < 0 ? 'neg' : ''}`;
	$('r-range-b').textContent = t(RANGE_KEY[ranges.b]);
};

let rangeTarget = 'a';
document.querySelectorAll('[data-range]').forEach((row) =>
	row.addEventListener('click', () => { rangeTarget = row.dataset.range; openSheet('rangesheet'); }));

$('rangesheet').addEventListener('click', (e) => {
	const b = e.target.closest('[data-r]');
	if (!b) return;
	ranges[rangeTarget] = b.dataset.r;
	closeSheets();
	renderReports();
});

// ---------- Settings ----------

$('set-cur').addEventListener('change', () => {
	db.cur = $('set-cur').value;
	localStorage.setItem(CUR_KEY, db.cur);
	renderList(); renderReports();
	if (openId) openContact(openId);
});

// Til ro'yxatini to'ldiramiz
$('set-lang').innerHTML = Object.entries(LANGS)
	.map(([code, name]) => `<option value="${code}">${name}</option>`).join('');
$('set-lang').value = lang;

$('set-lang').addEventListener('change', () => {
	setLang($('set-lang').value);
	// Dinamik chizilgan joylar ham yangilanishi kerak
	renderList(); renderNotes(); renderReports();
	if (openId) openContact(openId);
	syncLoginText();
	syncModeText();
});

$('set-export').addEventListener('click', () => {
	const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = `debtnote-${new Date().toISOString().slice(0, 10)}.json`;
	a.click();
	URL.revokeObjectURL(a.href);
});

$('set-import').addEventListener('click', () => {
	const inp = document.createElement('input');
	inp.type = 'file';
	inp.accept = 'application/json';
	inp.onchange = async () => {
		try {
			const data = JSON.parse(await inp.files[0].text());
			if (!Array.isArray(data.contacts)) throw new Error('format');
			if (!confirm(`${data.contacts.length} ${t('restoreConfirm')}`)) return;

			for (const c of data.contacts) {
				const fresh = await store.addContact(user.$id, { name: c.name, info: c.info });
				for (const e of c.entries || []) {
					fresh.entries.push(await store.addEntry(user.$id, fresh.id, e));
				}
				db.contacts.push(fresh);
			}
			renderList();
			alert(t('restored'));
		} catch (e) {
			alert(`${t('fileFail')}: ${e.message}`);
		}
	};
	inp.click();
});

$('set-logout').addEventListener('click', async () => {
	await store.logout().catch(() => {});
	user = null;
	openId = null;
	db = { contacts: [], notes: [], cur: db.cur };
	show('login');
});

// ---------- Kalkulyator ----------

let calcExpr = '';
document.querySelectorAll('[data-calc]').forEach((b) =>
	b.addEventListener('click', () => { calcExpr = ''; $('calc-out').textContent = '0'; openSheet('calc'); }));

$('calc').addEventListener('click', (e) => {
	const b = e.target.closest('[data-c]');
	if (!b) return;
	const c = b.dataset.c;

	if (c === 'C') calcExpr = '';
	else if (c === '=') {
		try {
			// Faqat raqam va amal belgilari o'tadi — boshqa hech narsa
			if (!/^[\d+\-*/(). ]+$/.test(calcExpr)) throw new Error('bad');
			const r = Function(`"use strict";return (${calcExpr})`)();
			calcExpr = Number.isFinite(r) ? String(Math.round(r * 100) / 100) : '';
		} catch { calcExpr = ''; }
	}
	else calcExpr += c;

	$('calc-out').textContent = calcExpr || '0';
});

// ---------- Oynalar ----------

const openSheet = (id) => ($(id).hidden = false);
const closeSheets = () => document.querySelectorAll('.sheet').forEach((s) => (s.hidden = true));

document.querySelectorAll('.sheet').forEach((s) =>
	s.addEventListener('click', (e) => { if (e.target === s) closeSheets(); }));
document.querySelectorAll('[data-sheet-close]').forEach((b) => b.addEventListener('click', closeSheets));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheets(); });

// ---------- Kirish ----------

let signupMode = false;

const syncLoginText = () => {
	$('name-row').hidden = !signupMode;
	$('login-sub').textContent = t(signupMode ? 'subSignUp' : 'subSignIn');
	$('l-submit').textContent = t(signupMode ? 'signUp' : 'signIn');
	$('l-switch').textContent = t(signupMode ? 'haveAccount' : 'noAccount');
	$('l-pass').autocomplete = signupMode ? 'new-password' : 'current-password';
};

$('l-switch').addEventListener('click', () => {
	signupMode = !signupMode;
	syncLoginText();
	$('login-err').hidden = true;
});

$('login-form').addEventListener('submit', async (e) => {
	e.preventDefault();

	const btn = $('l-submit');
	const err = $('login-err');
	err.hidden = true;
	btn.disabled = true;
	btn.textContent = t('waiting');

	try {
		const email = $('l-email').value.trim();
		const pass = $('l-pass').value;
		if (signupMode) {
			if (pass.length < 8) throw new Error(t('passShort'));
			await store.register(email, pass, $('l-name').value.trim() || email);
		} else {
			await store.login(email, pass);
		}
		await start();
	} catch (ex) {
		err.textContent = ex.type === 'user_invalid_credentials' ? t('badCreds')
			: ex.type === 'user_already_exists' ? t('emailExists')
			: ex.message;
		err.hidden = false;
	} finally {
		btn.disabled = false;
		btn.textContent = t(signupMode ? 'signUp' : 'signIn');
	}
});

// ---------- Ishga tushirish ----------

// Telefonda tafsilot panelini yopish (kompyuterda tugma ko'rinmaydi)
const closeDetail = () => {
	$('detail-pane').classList.remove('is-open');
	openId = null;
	renderList();
};

$('c-back').addEventListener('click', closeDetail);

// Telefonda "orqaga" tugmasi ham panelni yopsin, saytdan chiqarmasin
window.addEventListener('popstate', () => {
	if ($('detail-pane').classList.contains('is-open')) {
		closeDetail();
		history.pushState(null, '', location.href);
	}
});

// Mehmon rejimida foydalanuvchi yo'q — ruxsat berish uchun soxta ID
// yetarli, chunki ma'lumot serverga umuman bormaydi
const GUEST_USER = { $id: 'guest', email: '' };

const enterGuest = async () => {
	store.setGuest(true);
	user = GUEST_USER;
	await load();
};

$('l-guest').addEventListener('click', enterGuest);

// Mehmondan haqiqiy hisobga o'tish
$('guest-login').addEventListener('click', () => {
	store.setGuest(false);
	user = null;
	openId = null;
	db = { contacts: [], notes: [], cur: db.cur };
	show('login');
});

// Mehmon yoki haqiqiy hisob — qaysi rejimda ekanini ko'rsatuvchi matnlar.
// Til almashtirilganda ham qayta chaqiriladi.
const syncModeText = () => {
	const isGuest = store.guest;
	$('set-who').textContent = isGuest ? t('guestMode') : (user?.email || '');
	$('nav-who').textContent = isGuest ? '' : (user?.email || '');
	$('guest-tag').hidden = !isGuest;
	$('set-logout').hidden = isGuest;
	$('foot-note').textContent = t(isGuest ? 'guestNote' : 'dataNote');
};

const load = async () => {
	db.cur = localStorage.getItem(CUR_KEY) || '$';
	$('set-cur').value = db.cur;
	syncModeText();

	$('contact-list').innerHTML = `<p class="loading">${t('loading')}</p>`;
	show('debts');

	try {
		db.contacts = await store.fetchAll();
		db.notes = store.loadNotes();
	} catch (e) {
		$('contact-list').innerHTML = `<p class="empty">${t('loadFail')}: ${esc(e.message)}</p>`;
		return;
	}

	renderList(); renderNotes(); renderReports();
};

const start = async () => {
	applyLang();
	history.pushState(null, '', location.href);

	user = await store.me();
	if (user) {
		store.setGuest(false);
		await load();
		return;
	}

	// Sessiya yo'q — kirish ekranini ko'rsatmasdan darrov sinov rejimiga
	// o'tamiz. Kirish tepadagi "Kirish" havolasi orqali ochiladi.
	await enterGuest();
};

start();
