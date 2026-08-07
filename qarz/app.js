// Debt Note — brauzer versiyasi.
//
// Ma'lumot Appwrite'da (store.js). Har foydalanuvchi faqat o'zinikini
// ko'radi — tekshiruv serverda, qator ruxsatlari orqali.

import * as store from './store.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
	({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Holat ----------

// Server bilan ishlagach ro'yxat shu yerda saqlanadi — har harakatda
// qayta yuklanmasin. Yozuv qo'shilganda ikkalasi ham yangilanadi.
let db = { contacts: [], notes: [], cur: '$' };
let user = null;

const CUR_KEY = 'debtnote-cur';

// Balans hisoblanadi, saqlanmaydi — shunda hech qachon "balans mos emas"
// muammosi chiqmaydi
const sums = (c) => {
	let debt = 0, loan = 0;
	for (const e of c.entries) (e.kind === 'debt' ? (debt += e.amount) : (loan += e.amount));
	return { debt, loan, balance: loan - debt };
};

const lastAt = (c) => c.entries.length ? Math.max(...c.entries.map((e) => e.at)) : c.createdAt;

// ---------- Format ----------
// Summalar bazada TIYIN/SENTDA (butun son) saqlanadi — kasrli son bilan
// qo'shishda xato bo'lmasin (0.1 + 0.2 !== 0.3). Ko'rsatishda 100 ga bo'linadi.

const fmt = (cents) => {
	const major = Math.abs(cents) / 100;
	return major.toLocaleString('ru-RU', {
		minimumFractionDigits: major % 1 ? 2 : 0,
		maximumFractionDigits: 2,
	});
};

const money = (n) => {
	const sign = n < 0 ? '−' : n > 0 ? '+' : '';
	return `${sign}${fmt(n)} ${db.cur}`;
};
const plain = (n) => `${fmt(n)} ${db.cur}`;

const pad = (n) => String(n).padStart(2, '0');
const dt = (ts) => {
	const d = new Date(ts);
	return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const hhmm = (ts) => {
	const d = new Date(ts);
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Foydalanuvchi "12 500" yoki "12500.50" yozishi mumkin → tiyinga o'giriladi
const toNum = (v) => {
	const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
	if (!Number.isFinite(n) || n <= 0) return null;
	return Math.round(n * 100);
};

// ---------- Ekranlar ----------

let current = 'debts';
let openId = null;
let sortMode = 'recent';
let ranges = { a: 'all', b: 'all' };

const SCREENS = ['login', 'debts', 'notes', 'reports', 'settings', 'contact', 'new'];

const show = (name) => {
	current = name;
	SCREENS.forEach((s) => $(`s-${s}`).classList.toggle('is-on', s === name));
	$('tabs').hidden = name === 'contact' || name === 'new' || name === 'login';
	document.querySelectorAll('.tab').forEach((t) =>
		t.classList.toggle('is-on', t.dataset.tab === name));
	window.scrollTo(0, 0);
};

document.querySelectorAll('.tab').forEach((t) =>
	t.addEventListener('click', () => { render(t.dataset.tab); show(t.dataset.tab); }));

document.querySelectorAll('[data-back]').forEach((b) =>
	b.addEventListener('click', () => { renderList(); show('debts'); }));

// ---------- Debts ro'yxati ----------

const sortContacts = (list) => {
	const by = {
		recent: (a, b) => lastAt(b) - lastAt(a),
		name: (a, b) => a.name.localeCompare(b.name, 'uz'),
		debt: (a, b) => sums(a).balance - sums(b).balance,
		loan: (a, b) => sums(b).balance - sums(a).balance,
	};
	return [...list].sort(by[sortMode]);
};

const renderList = () => {
	const q = $('q').value.trim().toLowerCase();
	const list = sortContacts(db.contacts).filter((c) =>
		!q || c.name.toLowerCase().includes(q) || (c.info || '').toLowerCase().includes(q));

	if (!list.length) {
		$('contact-list').innerHTML = `<p class="empty">${db.contacts.length ? 'Topilmadi.' : 'Hozircha kontakt yo‘q. Pastdagi tugma bilan qo‘shing.'}</p>`;
		return;
	}

	$('contact-list').innerHTML = list.map((c) => {
		const { balance } = sums(c);
		return `
		<div class="contact" data-id="${c.id}">
			<div class="ava-wrap">
				<div class="ava">${esc((c.name[0] || '?').toUpperCase())}</div>
				<span class="ava-dot${balance === 0 ? ' paid' : ''}"></span>
			</div>
			<div class="c-main"><div class="c-nm">${esc(c.name)}</div></div>
			<div class="c-right">
				<div class="c-time">${hhmm(lastAt(c))}</div>
				<div class="c-bal ${balance < 0 ? 'neg' : balance > 0 ? 'pos' : ''}">${money(balance)}</div>
			</div>
		</div>`;
	}).join('');
};

$('contact-list').addEventListener('click', (e) => {
	const row = e.target.closest('.contact');
	if (row) { openContact(row.dataset.id); }
});

$('q').addEventListener('input', renderList);
document.querySelector('[data-search-open]').addEventListener('click', () => {
	$('searchbar').hidden = false;
	$('q').focus();
});
document.querySelector('[data-search-close]').addEventListener('click', () => {
	$('q').value = '';
	$('searchbar').hidden = true;
	renderList();
});

// ---------- Kontakt tafsiloti ----------

const openContact = (id) => {
	openId = id;
	const c = db.contacts.find((x) => x.id === id);
	if (!c) return;

	$('c-title').textContent = c.name;
	$('c-name').textContent = c.name;
	$('c-reg').textContent = dt(c.createdAt);
	$('c-info-wrap').hidden = !c.info;
	$('c-info').textContent = c.info || '';

	const { debt, loan, balance } = sums(c);
	$('c-balance').textContent = money(balance);
	$('c-balance').className = balance < 0 ? 'neg' : balance > 0 ? 'pos' : '';
	$('c-sum-debt').textContent = debt ? `−${plain(debt)}` : `0 ${db.cur}`;
	$('c-sum-loan').textContent = loan ? `+${plain(loan)}` : `0 ${db.cur}`;

	$('c-history').innerHTML = [...c.entries].sort((a, b) => b.at - a.at).map((e) => `
		<div class="h-row ${e.kind}">
			<div class="h-left">
				<div class="h-amt ${e.kind === 'debt' ? 'neg' : 'pos'}">${e.kind === 'debt' ? '−' : '+'}${plain(e.amount)}</div>
				${e.note ? `<div class="h-note">${esc(e.note)}</div>` : ''}
			</div>
			<div class="h-right">
				<button class="i-btn" data-info="${e.id}">
					<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
				</button>
				<span class="h-date">${dt(e.at)}</span>
				<span class="h-dot"></span>
			</div>
		</div>`).join('');

	$('c-amount').value = '';
	$('c-note').value = '';
	$('c-note-wrap').hidden = true;
	$('c-info-toggle').textContent = 'Add Information';
	setSeg('c-seg', 'debt');
	show('contact');
};

// Debt / Loan almashtirgich
const setSeg = (segId, kind) => {
	$(segId).querySelectorAll('button').forEach((b) =>
		b.classList.toggle('on', b.dataset.kind === kind));
};
['c-seg', 'n-seg'].forEach((id) =>
	$(id).addEventListener('click', (e) => {
		const b = e.target.closest('button');
		if (b) setSeg(id, b.dataset.kind);
	}));

const segKind = (id) => $(id).querySelector('button.on').dataset.kind;

// Izoh maydonini ochish/yopish
const bindToggle = (btnId, wrapId, openText, closeText) => {
	$(btnId).addEventListener('click', () => {
		const w = $(wrapId);
		w.hidden = !w.hidden;
		$(btnId).textContent = w.hidden ? openText : closeText;
		if (!w.hidden) w.querySelector('input').focus();
	});
};
bindToggle('c-info-toggle', 'c-note-wrap', 'Add Information', 'Hide Information');
bindToggle('n-info-toggle', 'n-info-wrap', 'Add Information', 'Hide Information');
bindToggle('n-note-toggle', 'n-note-wrap', 'Add Information', 'Hide Information');

// Yozuv qo'shish
$('c-save').addEventListener('click', async () => {
	const amount = toNum($('c-amount').value);
	if (!amount) { $('c-amount').focus(); return; }

	const btn = $('c-save');
	btn.disabled = true;
	btn.textContent = 'Saqlanmoqda…';

	try {
		const c = db.contacts.find((x) => x.id === openId);
		const entry = await store.addEntry(user.$id, openId, {
			kind: segKind('c-seg'), amount, note: $('c-note').value.trim(),
		});
		c.entries.push(entry);
		openContact(openId);
	} catch (e) {
		alert(`Saqlab bo'lmadi: ${e.message}`);
	} finally {
		btn.disabled = false;
		btn.textContent = 'Save';
	}
});

$('c-amount').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('c-save').click(); });
$('c-note').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('c-save').click(); });

// ---------- Yangi kontakt ----------

document.querySelector('[data-new-contact]').addEventListener('click', () => {
	$('n-name').value = ''; $('n-info').value = '';
	$('n-amount').value = ''; $('n-note').value = '';
	$('n-info-wrap').hidden = false; $('n-note-wrap').hidden = false;
	$('n-info-toggle').textContent = 'Hide Information';
	$('n-note-toggle').textContent = 'Hide Information';
	setSeg('n-seg', 'debt');
	show('new');
	$('n-name').focus();
});

$('n-save').addEventListener('click', async () => {
	const name = $('n-name').value.trim();
	if (!name) { $('n-name').focus(); return; }

	const amount = toNum($('n-amount').value);
	if (!amount) { $('n-amount').focus(); return; }

	const btn = $('n-save');
	btn.disabled = true;
	btn.textContent = 'Saqlanmoqda…';

	try {
		const c = await store.addContact(user.$id, { name, info: $('n-info').value.trim() });
		c.entries.push(await store.addEntry(user.$id, c.id, {
			kind: segKind('n-seg'), amount, note: $('n-note').value.trim(),
		}));
		db.contacts.push(c);
		openContact(c.id);
	} catch (e) {
		alert(`Saqlab bo'lmadi: ${e.message}`);
	} finally {
		btn.disabled = false;
		btn.textContent = 'Save';
	}
});

// ---------- ⋮ menyu ----------

$('c-menu').addEventListener('click', () => openSheet('ctxsheet'));

$('ctx-edit').addEventListener('click', async () => {
	const c = db.contacts.find((x) => x.id === openId);
	const name = prompt('Ism:', c.name);
	if (name === null) return;
	const info = prompt('Ma\'lumot:', c.info || '');
	if (info === null) return;

	closeSheets();
	try {
		await store.updateContact(c.id, { name: name.trim() || c.name, info: info.trim() });
		c.name = name.trim() || c.name;
		c.info = info.trim();
		openContact(openId);
	} catch (e) {
		alert(`Saqlab bo'lmadi: ${e.message}`);
	}
});

// Hisobni yopish: qatorlar o'chirilmaydi, teskari yozuv qo'shiladi —
// tarix butun qoladi
$('ctx-clear').addEventListener('click', async () => {
	const c = db.contacts.find((x) => x.id === openId);
	const { balance } = sums(c);
	closeSheets();
	if (!balance) return;

	try {
		c.entries.push(await store.addEntry(user.$id, c.id, {
			kind: balance < 0 ? 'loan' : 'debt',
			amount: Math.abs(balance),
			note: 'Hisob yopildi',
		}));
		openContact(openId);
	} catch (e) {
		alert(`Saqlab bo'lmadi: ${e.message}`);
	}
});

$('ctx-del').addEventListener('click', async () => {
	const c = db.contacts.find((x) => x.id === openId);
	if (!confirm(`"${c.name}" butunlay o'chirilsinmi? Barcha yozuvlari ham ketadi.`)) return;

	closeSheets();
	try {
		await store.deleteContact(c.id, c.entries);
		db.contacts = db.contacts.filter((x) => x.id !== openId);
		renderList();
		show('debts');
	} catch (e) {
		alert(`O'chirib bo'lmadi: ${e.message}`);
	}
});

// ---------- (i) tafsilot ----------

$('c-history').addEventListener('click', (e) => {
	const btn = e.target.closest('[data-info]');
	if (!btn) return;

	const c = db.contacts.find((x) => x.id === openId);
	const en = c.entries.find((x) => x.id === btn.dataset.info);
	$('det-body').innerHTML = `
		<div><span>Turi</span><span class="${en.kind === 'debt' ? 'neg' : 'pos'}">${en.kind === 'debt' ? 'Debt' : 'Loan'}</span></div>
		<div><span>Summa</span><span>${en.kind === 'debt' ? '−' : '+'}${plain(en.amount)}</span></div>
		<div><span>Sana</span><span>${dt(en.at)}</span></div>
		<div><span>Izoh</span><span>${esc(en.note) || '—'}</span></div>
		<div><span>Kontakt</span><span>${esc(c.name)}</span></div>`;
	openSheet('infosheet');
});

// ---------- Saralash ----------

document.querySelectorAll('[data-sort]').forEach((b) =>
	b.addEventListener('click', () => openSheet('sortsheet')));

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
		$('note-list').innerHTML = '<p class="empty">Eslatma yo‘q.</p>';
		return;
	}
	$('note-list').innerHTML = [...db.notes].sort((a, b) => b.at - a.at).map((n) => `
		<div class="h-row" style="background:var(--panel)">
			<div class="h-left">
				<div class="h-amt" style="font-size:15px">${esc(n.text)}</div>
				<div class="h-note">${dt(n.at)}</div>
			</div>
			<div class="h-right">
				<button class="i-btn" data-del-note="${n.id}">
					<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>
				</button>
			</div>
		</div>`).join('');
};

document.querySelector('[data-new-note]').addEventListener('click', () => {
	const text = prompt('Eslatma:');
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
const RANGE_LABEL = { all: 'All Time', today: 'Bugun', week: 'Oxirgi 7 kun', month: 'Oxirgi 30 kun', year: 'Oxirgi 1 yil' };

const inRange = (at, r) => r === 'all' || at >= Date.now() - RANGE_MS[r];

const totals = (r) => {
	let debt = 0, loan = 0;
	for (const c of db.contacts) {
		for (const e of c.entries) {
			if (!inRange(e.at, r)) continue;
			e.kind === 'debt' ? (debt += e.amount) : (loan += e.amount);
		}
	}
	return { debt, loan };
};

const renderReports = () => {
	const a = totals(ranges.a);
	$('r-total-debts').textContent = a.debt ? `−${plain(a.debt)}` : `0 ${db.cur}`;
	$('r-total-loans').textContent = a.loan ? `+${plain(a.loan)}` : `0 ${db.cur}`;
	$('r-range-a').textContent = RANGE_LABEL[ranges.a];

	const b = totals(ranges.b);
	$('r-taken').textContent = b.debt ? `−${plain(b.debt)}` : `0 ${db.cur}`;
	$('r-given').textContent = b.loan ? `+${plain(b.loan)}` : `0 ${db.cur}`;
	const diff = b.loan - b.debt;
	$('r-diff').textContent = money(diff);
	$('r-diff').className = `rep-val ${diff < 0 ? 'neg' : diff > 0 ? 'pos' : ''}`;
	$('r-range-b').textContent = RANGE_LABEL[ranges.b];
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
	document.querySelectorAll('#c-cur1, #c-cur2').forEach((s) => (s.textContent = db.cur));
	renderList(); renderReports();
});

$('set-export').addEventListener('click', () => {
	const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = `debtnote-${new Date().toISOString().slice(0, 10)}.json`;
	a.click();
	URL.revokeObjectURL(a.href);
});

// Tiklash serverga yozadi — mavjud ma'lumot ustiga qo'shiladi, o'chirilmaydi
$('set-import').addEventListener('click', () => {
	const inp = document.createElement('input');
	inp.type = 'file';
	inp.accept = 'application/json';
	inp.onchange = async () => {
		try {
			const data = JSON.parse(await inp.files[0].text());
			if (!Array.isArray(data.contacts)) throw new Error('format');
			if (!confirm(`${data.contacts.length} ta kontakt qo'shiladi. Mavjudlari o'chmaydi. Davom etamizmi?`)) return;

			for (const c of data.contacts) {
				const fresh = await store.addContact(user.$id, { name: c.name, info: c.info });
				for (const e of c.entries || []) {
					fresh.entries.push(await store.addEntry(user.$id, fresh.id, e));
				}
				db.contacts.push(fresh);
			}
			renderList();
			alert('Tiklandi.');
		} catch (e) {
			alert(`Fayl o'qilmadi: ${e.message}`);
		}
	};
	inp.click();
});

$('set-logout').addEventListener('click', async () => {
	await store.logout().catch(() => {});
	user = null;
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

	if (c === 'C') { calcExpr = ''; }
	else if (c === '=') {
		try {
			// Faqat raqam va amal belgilari — boshqa hech narsa o'tmaydi
			if (!/^[\d+\-*/(). ]+$/.test(calcExpr)) throw new Error('bad');
			const r = Function(`"use strict";return (${calcExpr})`)();
			calcExpr = Number.isFinite(r) ? String(Math.round(r * 100) / 100) : '';
		} catch { calcExpr = ''; }
	}
	else calcExpr += c;

	$('calc-out').textContent = calcExpr || '0';
});

// ---------- Oynalar ----------

const openSheet = (id) => { $(id).hidden = false; };
const closeSheets = () => document.querySelectorAll('.sheet').forEach((s) => (s.hidden = true));

document.querySelectorAll('.sheet').forEach((s) =>
	s.addEventListener('click', (e) => { if (e.target === s) closeSheets(); }));
document.querySelectorAll('[data-sheet-close]').forEach((b) =>
	b.addEventListener('click', closeSheets));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheets(); });

// ---------- Kirish / ro'yxatdan o'tish ----------

let signupMode = false;

$('l-switch').addEventListener('click', () => {
	signupMode = !signupMode;
	$('name-row').hidden = !signupMode;
	$('login-sub').textContent = signupMode ? 'Yangi hisob yarating' : 'Hisobingizga kiring';
	$('l-submit').textContent = signupMode ? 'Ro‘yxatdan o‘tish' : 'Kirish';
	$('l-switch').textContent = signupMode
		? 'Hisobingiz bormi? Kirish'
		: 'Hisobingiz yo‘qmi? Ro‘yxatdan o‘tish';
	$('l-pass').autocomplete = signupMode ? 'new-password' : 'current-password';
	$('login-err').hidden = true;
});

$('login-form').addEventListener('submit', async (e) => {
	e.preventDefault();

	const email = $('l-email').value.trim();
	const pass = $('l-pass').value;
	const btn = $('l-submit');
	const err = $('login-err');

	err.hidden = true;
	btn.disabled = true;
	btn.textContent = 'Kutilmoqda…';

	try {
		if (signupMode) {
			if (pass.length < 8) throw new Error('Parol kamida 8 belgidan iborat bo‘lsin');
			await store.register(email, pass, $('l-name').value.trim() || email);
		} else {
			await store.login(email, pass);
		}
		await start();
	} catch (ex) {
		err.textContent = ex.type === 'user_invalid_credentials'
			? 'Email yoki parol noto‘g‘ri'
			: ex.type === 'user_already_exists'
				? 'Bu email allaqachon ro‘yxatdan o‘tgan'
				: ex.message;
		err.hidden = false;
	} finally {
		btn.disabled = false;
		btn.textContent = signupMode ? 'Ro‘yxatdan o‘tish' : 'Kirish';
	}
});

// ---------- Ishga tushirish ----------

const render = (name) => {
	if (name === 'debts') renderList();
	if (name === 'notes') renderNotes();
	if (name === 'reports') renderReports();
};

const start = async () => {
	user = await store.me();
	if (!user) { show('login'); return; }

	db.cur = localStorage.getItem(CUR_KEY) || '$';
	$('set-cur').value = db.cur;
	document.querySelectorAll('#c-cur1, #c-cur2').forEach((s) => (s.textContent = db.cur));
	$('set-who').textContent = user.email;

	$('contact-list').innerHTML = '<p class="loading">Yuklanmoqda…</p>';
	show('debts');

	try {
		db.contacts = await store.fetchAll();
		db.notes = store.loadNotes();
	} catch (e) {
		$('contact-list').innerHTML = `<p class="empty">Yuklab bo‘lmadi: ${esc(e.message)}</p>`;
		return;
	}

	renderList(); renderNotes(); renderReports();
};

start();
