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
let isOwner = false;
let lockMinutes = 10;
let unsubscribe = null;
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
	if (name === 'notes') { renderToday(); fillCashiers(); }
	if (name === 'reports') renderReports();
	if (name === 'settings' && isOwner) renderMembers();

	// Kassir faqat o'z ishini ko'radi — sarlavhada shu aytiladi
	if (!isOwner) {
		$('act-title').textContent = t('myActivity');
		$('rep-title').textContent = t('myReports');
	}
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

// Ro'yxatda ko'rinadigan nom: ismga telefon raqamining oxirgi 4 raqami
// qo'shiladi — "sardor0509". Bir xil ismli kontaktlarni ajratish uchun
// (bitta daftarda 5 ta Sardor bo'lishi mumkin). Saqlangan ism o'zgarmaydi,
// bu faqat ko'rinish; telefon tahrirlansa nom ham yangilanadi.
const displayName = (c) => {
	const d = digits(c.info || '');
	return d.length >= 4 ? `${c.name}${d.slice(-4)}` : c.name;
};

const matches = (c, q) => {
	if (!q) return true;
	if (displayName(c).toLowerCase().includes(q)) return true;   // "sardor0509"
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
				<div class="c-nm">${esc(displayName(c))}</div>
				<div class="c-time">${esc(c.info) || dt(lastAt(c)).slice(0, 10)}</div>
			</div>
			<div class="c-bal ${balance < 0 ? 'neg' : balance === 0 ? 'zero' : ''}">${money(balance)}</div>
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
	$('c-balance').className = `d-bal-num ${balance < 0 ? 'neg' : balance === 0 ? 'zero' : ''}`;
	$('c-sum-debt').textContent = debt ? `−${plain(debt)}` : `0 ${db.cur}`;
	$('c-sum-loan').textContent = loan ? `+${plain(loan)}` : `0 ${db.cur}`;

	$('c-history').innerHTML = [...c.entries].sort((a, b) => b.at - a.at).map((e) => `
		<tr class="${e.kind}">
			<td class="h-amt ${e.kind === 'debt' ? 'neg' : ''}">${e.kind === 'debt' ? '−' : '+'}${plain(e.amount)}</td>
			<td class="h-note">${esc(e.note) || '—'}</td>
			<td class="h-by">${esc(e.byName) || '—'}</td>
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
	const temp = {
		id: `tmp-${Date.now()}`, ...data, at: Date.now(), pending: true,
		by: user.$id, byName: user.name || user.email,
	};
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
	const temp = {
		id: `tmp-${Date.now()}`, ...data, at: Date.now(), pending: true,
		by: user.$id, byName: user.name || user.email,
	};
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

// Tanlangan kunda kim qarz oldi, kim to'ladi — barcha kontaktlar bo'yicha.
// Egasi telefonda shu ro'yxatni kuzatadi.

let dayOffset = 0;          // 0 = bugun, 1 = kecha…
let cashierFilter = '';     // bo'sh = hammasi

const dayBounds = (offset) => {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - offset);
	return [d.getTime(), d.getTime() + 864e5];
};

const renderToday = () => {
	const [from, to] = dayBounds(dayOffset);

	// Kassir faqat O'ZI yozganlarini ko'radi — boshqa kassirning ishi
	// unga tegishli emas. Ega hammasini ko'radi va filtrlaydi.
	//
	// DIQQAT: bu faqat SHU ro'yxatga taalluqli. Qarzdorning balansi va
	// tarixi hammaga to'liq ko'rinadi — aks holda kassir noto'g'ri
	// summa so'rab qolardi.
	const only = isOwner ? cashierFilter : user.$id;

	// Qaysi yozuv qarzni butunlay yopganini topamiz: yozuvlarni vaqt
	// bo'yicha yurib, balans nolga tushgan lahzani belgilaymiz.
	// Shunda «bugun kim qarzdan qutildi» ko'rinadi.
	const closers = new Set();
	for (const c of db.contacts) {
		let bal = 0;
		for (const e of [...c.entries].sort((a, b) => a.at - b.at)) {
			const before = bal;
			bal += e.kind === 'debt' ? -e.amount : e.amount;
			if (before !== 0 && bal === 0) closers.add(e.id);
		}
	}

	const rows = [];
	for (const c of db.contacts) {
		for (const e of c.entries) {
			if (e.at < from || e.at >= to) continue;
			if (only && e.by !== only) continue;
			rows.push({ ...e, contact: c, closed: closers.has(e.id) });
		}
	}
	rows.sort((a, b) => b.at - a.at);

	const label = dayOffset === 0 ? t('today')
		: dayOffset === 1 ? t('yesterday')
		: new Date(from).toLocaleDateString('ru-RU');
	$('day-label').textContent = label;
	$('day-next').disabled = dayOffset === 0;

	const debt = rows.filter((r) => r.kind === 'debt').reduce((s, r) => s + r.amount, 0);
	const loan = rows.filter((r) => r.kind === 'loan').reduce((s, r) => s + r.amount, 0);
	const closedList = rows.filter((r) => r.closed);

	$('day-debt').textContent = debt ? `−${plain(debt)}` : `0 ${db.cur}`;
	$('day-loan').textContent = loan ? `+${plain(loan)}` : `0 ${db.cur}`;
	$('day-count').textContent = rows.length;
	$('day-closed').textContent = closedList.length;

	// Qarzdan qutilganlar ro'yxati — ismlari bilan
	$('closed-names').textContent = closedList.length
		? closedList.map((r) => r.contact.name).join(', ')
		: '';
	$('closed-box').hidden = !closedList.length;

	if (!rows.length) {
		$('note-list').innerHTML = `<p class="empty">${t('noActivity')}</p>`;
		return;
	}

	$('note-list').innerHTML = rows.map((r) => `
		<div class="act-row ${r.kind}${r.closed ? ' is-closed' : ''}" data-open-contact="${r.contact.id}">
			<div class="act-amt ${r.kind === 'debt' ? 'neg' : ''}">${r.kind === 'debt' ? '−' : '+'}${plain(r.amount)}</div>
			<div class="act-main">
				<div class="act-name">
					${esc(r.contact.name)}
					${r.closed ? `<span class="badge-closed">${t('closedBadge')}</span>` : ''}
				</div>
				${r.note ? `<div class="act-note">${esc(r.note)}</div>` : ''}
			</div>
			<div class="act-right">
				<div class="act-time">${hm(r.at)}</div>
				<div class="act-by">${esc(r.byName) || '—'}</div>
			</div>
		</div>`).join('');
};

const hm = (ts) => {
	const d = new Date(ts);
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

$('note-list').addEventListener('click', (e) => {
	const row = e.target.closest('[data-open-contact]');
	if (!row) return;
	show('debts');
	openContact(row.dataset.openContact);
});

$('day-prev').addEventListener('click', () => { dayOffset++; renderToday(); });
$('day-next').addEventListener('click', () => { if (dayOffset > 0) { dayOffset--; renderToday(); } });

// Kassir bo'yicha filtr — egasi kimning ishini ko'rmoqchi bo'lsa
$('day-cashier').addEventListener('change', () => {
	cashierFilter = $('day-cashier').value;
	renderToday();
});

// Kassir bo'yicha filtr faqat egaga. Kassirga tanlash kerak emas —
// u baribir faqat o'zinikini ko'radi.
const fillCashiers = async () => {
	$('day-cashier').hidden = !isOwner;
	if (!isOwner) return;

	try {
		const list = await store.members();
		// Ega kassir emas — alohida ajratiladi
		const owners = list.filter((m) => m.owner);
		const cashiers = list.filter((m) => !m.owner);

		$('day-cashier').innerHTML =
			`<option value="">${t('allCashiers')}</option>` +
			owners.map((m) => `<option value="${m.id}">${t('owner')} — ${esc(m.name)}</option>`).join('') +
			(cashiers.length
				? `<optgroup label="${t('cashiers')}">` +
					cashiers.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('') +
					'</optgroup>'
				: '');
	} catch { /* ro'yxat olinmasa filtr bo'sh qoladi */ }
};

// ---------- Reports ----------

const RANGE_MS = { today: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 };
const RANGE_KEY = { all: 'allTime', today: 'today', week: 'week', month: 'month', year: 'year' };

// Kassir hisobotda faqat o'z ishini ko'radi — boshqa kassirning
// yig'gani unga ko'rinmaydi. Ega hammasini ko'radi.
const totals = (r) => {
	let debt = 0, loan = 0;
	for (const c of db.contacts) {
		for (const e of c.entries) {
			if (r !== 'all' && e.at < Date.now() - RANGE_MS[r]) continue;
			if (!isOwner && e.by !== user.$id) continue;
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

// Chiqish — bitta joyda, ikkala tugma ham shuni chaqiradi
const signOut = async () => {
	clearTimeout(lockTimer);
	unsubscribe?.();
	unsubscribe = null;

	await store.logout().catch(() => {});

	user = null; isOwner = false; openId = null;
	db = { contacts: [], notes: [], cur: db.cur };

	// Qulf va ochiq oynalar qolib ketmasin — aks holda kirish shakli
	// ustida ko'rinmas qatlam qolib, yozib bo'lmaydi
	$('lock').hidden = true;
	$('lock-pass').value = '';
	closeSheets();

	$('detail-inner').hidden = true;
	$('pane-empty').hidden = false;
	$('detail-pane').classList.remove('is-open');

	show('login');
	$('l-pass').value = '';
	$('l-email').focus();
};

$('set-logout').addEventListener('click', signOut);

// Qulflash daqiqasi — faqat ega o'zgartiradi, telefonidan ham
$('set-lock').addEventListener('change', async () => {
	const n = Number($('set-lock').value);
	try {
		({ lockMinutes } = await store.saveSettings({ lockMinutes: n }));
		startLockTimer();
	} catch (e) {
		alert(`${t('saveFail')}: ${e.message}`);
		$('set-lock').value = String(lockMinutes);
	}
});

// Kassirlar ro'yxati
const renderMembers = async () => {
	try {
		const list = await store.members();
		// Ega tepada, keyin kassirlar — ega kassirlar qatoriga qo'shilmaydi
		const sorted = [...list].sort((a, b) => (b.owner ? 1 : 0) - (a.owner ? 1 : 0));

		$('member-list').innerHTML = sorted.map((m) => `
			<div class="set-row">
				<span>
					${esc(m.name)}
					${m.owner ? `<span class="badge-owner">${t('owner')}</span>`
						: `<span class="muted-val">· ${esc(m.email.replace(`@${store.LOGIN_DOMAIN}`, ''))}</span>`}
				</span>
				${m.owner || !isOwner ? '' : `<span class="row-acts">
					<button class="i-btn" data-pw="${m.id}" title="${t('newPassword')}">
						<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>
					</button>
					<button class="i-btn" data-rm="${m.membershipId}" title="${t('remove')}">
						<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>
					</button>
				</span>`}
			</div>`).join('');
	} catch (e) {
		$('member-list').innerHTML = `<div class="set-row muted-val">${esc(e.message)}</div>`;
	}
};

$('member-list').addEventListener('click', async (e) => {
	const rm = e.target.closest('[data-rm]');
	const pw = e.target.closest('[data-pw]');

	if (rm) {
		if (!confirm(t('removeConfirm'))) return;
		try { await store.removeMember(rm.dataset.rm); renderMembers(); }
		catch (ex) { alert(ex.message); }
		return;
	}

	if (pw) {
		const p = prompt(t('newPasswordPrompt'));
		if (!p) return;
		try { await store.setCashierPassword(pw.dataset.pw, p); alert(t('passwordChanged')); }
		catch (ex) { alert(ex.message); }
	}
});

// Yangi kassir qo'shish
$('add-cashier').addEventListener('click', () => {
	$('k-login').value = ''; $('k-name').value = ''; $('k-pass').value = '';
	$('k-err').hidden = true;
	openSheet('cashiersheet');
	$('k-name').focus();
});

$('k-save').addEventListener('click', async () => {
	const login = $('k-login').value.trim();
	const password = $('k-pass').value;
	const name = $('k-name').value.trim();

	const err = $('k-err');
	err.hidden = true;

	const btn = $('k-save');
	btn.disabled = true;
	btn.textContent = t('saving');

	try {
		await store.addCashier({ login, password, name });
		closeSheets();
		renderMembers();
		alert(`${t('cashierAdded')}\n\n${t('login')}: ${login}\n${t('password')}: ${password}`);
	} catch (ex) {
		err.textContent = ex.message;
		err.hidden = false;
	} finally {
		btn.disabled = false;
		btn.textContent = t('save');
	}
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
		// Kassir "aziz" deb kiradi, ega esa o'z emaili bilan
		const raw = $('l-email').value.trim();
		const pass = $('l-pass').value;

		if (signupMode) {
			if (pass.length < 8) throw new Error(t('passShort'));
			if (!raw.includes('@')) throw new Error(t('needEmail'));
			await store.register(raw, pass, $('l-name').value.trim() || raw);
		} else {
			await store.login(store.loginToEmail(raw), pass);
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

// ---------- Harakatsizlikda qulflash ----------
//
// Kassa kompyuteri ochiq qolib ketmasin: belgilangan vaqt tegilmasa
// ekran qulflanadi va parol so'raydi. Ish TO'XTAMAYDI — parol kiritilsa
// o'sha joyidan davom etadi. Boshqa kassir kelsa "Boshqa hisob" bosadi.
//
// Daqiqani egasi Sozlamalardan (telefonidan ham) o'zgartiradi.

let lockTimer = null;

const doLock = () => {
	// Kirish ekranida qulflashning ma'nosi yo'q — u yerda allaqachon
	// parol so'ralyapti. Aks holda qulf oynasi kirish shaklining USTIGA
	// chiqib, maydonlarga yozib bo'lmay qolardi (ikkalasi ham oq).
	if (!user) return;
	if ($('lock').hidden === false) return;

	$('lock-who').textContent = user.name || user.email || '';
	$('lock-pass').value = '';
	$('lock-err').hidden = true;
	$('lock').hidden = false;
	$('lock-pass').focus();
};

const startLockTimer = () => {
	clearTimeout(lockTimer);
	if (!user || !lockMinutes) return;         // chiqilgan yoki 0 = qulflanmaydi
	lockTimer = setTimeout(doLock, lockMinutes * 60000);
};

for (const ev of ['click', 'keydown', 'touchstart', 'wheel']) {
	document.addEventListener(ev, () => {
		if ($('lock').hidden) startLockTimer();
	}, { passive: true });
}

$('lock-form').addEventListener('submit', async (e) => {
	e.preventDefault();

	const btn = $('lock-open');
	const err = $('lock-err');
	btn.disabled = true;
	err.hidden = true;

	try {
		if (await store.verifyPassword($('lock-pass').value)) {
			$('lock').hidden = true;
			$('lock-pass').value = '';
			startLockTimer();
		} else {
			err.textContent = t('badPass');
			err.hidden = false;
			$('lock-pass').select();
		}
	} catch (ex) {
		// Tarmoq uzilgan bo'lsa — sababini aytamiz, "parol noto'g'ri"
		// deb chalg'itmaymiz
		err.textContent = ex.message;
		err.hidden = false;
	} finally {
		btn.disabled = false;
	}
});

// Boshqa kassir kelganda — butunlay chiqib, yangisi kiradi.
// signOut pastda e'lon qilingan, lekin bosilganda allaqachon mavjud.
$('lock-switch').addEventListener('click', () => signOut());

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

// Kim kirgani va qaysi rolda ekani ko'rsatiladi
const syncModeText = () => {
	const who = user?.name || user?.email || '';
	$('set-who').textContent = who;
	$('nav-who').textContent = isOwner ? who : `${who} · ${t('cashier')}`;

	// Kassirga tegishli bo'lmagan bo'limlar yashiriladi
	$('owner-only').hidden = !isOwner;
	$('foot-note').textContent = t('dataNote');
};

const load = async () => {
	db.cur = localStorage.getItem(CUR_KEY) || '$';
	$('set-cur').value = db.cur;
	syncModeText();

	$('contact-list').innerHTML = `<p class="loading">${t('loading')}</p>`;
	show('debts');

	try {
		db.contacts = await store.fetchAll();
		({ lockMinutes } = await store.loadSettings());
		$('set-lock').value = String(lockMinutes);
	} catch (e) {
		$('contact-list').innerHTML = `<p class="empty">${t('loadFail')}: ${esc(e.message)}</p>`;
		return;
	}

	renderList(); renderToday(); renderReports();
	startLockTimer();

	// Boshqa kassir yozuv qo'shsa — darrov ekranda paydo bo'ladi
	unsubscribe?.();
	unsubscribe = store.subscribe((entry, contactId) => {
		const c = byId(contactId);
		if (!c || c.entries.some((e) => e.id === entry.id)) return;
		c.entries.push(entry);
		renderList();
		renderToday();
		if (openId === contactId) openContact(contactId);
	});
};

const start = async () => {
	applyLang();
	history.pushState(null, '', location.href);

	const session = await store.init().catch(() => null);
	if (!session) { show('login'); return; }

	user = session.me;
	isOwner = session.isOwner;
	await load();
};

start();
