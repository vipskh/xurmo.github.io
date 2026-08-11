// Qarz daftar — ma'lumot qatlami (Appwrite, jamoa rejimi).
//
// Bu yerda API kalit YO'Q va bo'lmasligi kerak. Brauzer faqat Project ID
// bilan ishlaydi.
//
// TUZILMA:
//   Har restoran = bitta jamoa (Team). Ega — "owner" roli, kassirlar —
//   "kassir" roli. Yozuvlar jamoaga tegishli, shuning uchun ega ham,
//   kassir ham bir xil ma'lumotni ko'radi.
//
// XAVFSIZLIK:
//   Yozuvlar (entries) faqat O'QISH ruxsati bilan yaratiladi — qo'shilgandan
//   keyin hech kim o'zgartira yoki o'chira olmaydi. Kassir to'lovni yozib,
//   keyin uni yashira olmaydi. Xato bo'lsa teskari yozuv qo'shiladi.
//   Kontaktlarni faqat ega o'chiradi/tahrirlaydi.

const CFG = {
	endpoint: 'https://fra.cloud.appwrite.io/v1',
	project: '6a396eba00119eaa8de0',
	db: 'marketplace',
	contacts: 'menu_debt_contacts',
	entries: 'menu_debt_entries',
	settings: 'menu_debt_settings',
};

const base = `${CFG.endpoint}/tablesdb/${CFG.db}/tables`;

const request = async (method, url, body) => {
	const res = await fetch(url, {
		method,
		headers: { 'X-Appwrite-Project': CFG.project, 'Content-Type': 'application/json' },
		credentials: 'include',
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	const json = text ? JSON.parse(text) : null;
	if (!res.ok) {
		const err = new Error(json?.message || `${res.status}`);
		err.status = res.status;
		err.type = json?.type;
		throw err;
	}
	return json;
};

const Q = (queries) => queries.map((q) => `queries[]=${encodeURIComponent(JSON.stringify(q))}`).join('&');

const listAll = async (table, queries = []) => {
	// Appwrite bir so'rovda 100 tadan ko'p qaytarmaydi
	const out = [];
	let cursor = null;
	for (let i = 0; i < 100; i++) {
		const q = [...queries, { method: 'limit', values: [100] }];
		if (cursor) q.push({ method: 'cursorAfter', values: [cursor] });
		const { rows } = await request('GET', `${base}/${table}/rows?${Q(q)}`);
		out.push(...rows);
		if (rows.length < 100) break;
		cursor = rows[rows.length - 1].$id;
	}
	return out;
};

// --- Joriy holat ---

export let me = null;         // { $id, name, email }
export let team = null;       // { $id, name }
export let isOwner = false;

// --- Kirish ---

export const account = async () => {
	try {
		return await request('GET', `${CFG.endpoint}/account`);
	} catch {
		return null;
	}
};

export const login = async (email, password) => {
	const s = await request('POST', `${CFG.endpoint}/account/sessions/email`, { email, password });
	await rememberForLock(password);      // qulfni ochish uchun
	return s;
};

// --- Qulf ekrani uchun parol tekshiruvi ---
//
// Serverga murojaat qilinmaydi. Ikkita yo'l sinab ko'rildi va ikkalasi
// ham yaramadi:
//   1) qayta kirish — sessiya ochiq turganda Appwrite ruxsat bermaydi
//   2) parolni o'ziga almashtirish — 2-3 urinishdan keyin Appwrite
//      cheklab qo'yadi (429) va TO'G'RI parol ham o'tmay qoladi
//
// Qulf — mahalliy himoya (ekran qarovsiz qolmasin), server chegarasi
// emas. Shuning uchun kirish paytida paroldan PBKDF2 xeshi olinadi va
// shu yerda saqlanadi; ochishda faqat shu xesh solishtiriladi.
// Parolning o'zi hech qayerda saqlanmaydi.

const LOCK_KEY = 'debtnote-lock';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

const derive = async (password, salt) => {
	const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
		key, 256
	);
	return hex(bits);
};

const rememberForLock = async (password) => {
	const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
	localStorage.setItem(LOCK_KEY, JSON.stringify({ salt, hash: await derive(password, salt) }));
};

const forgetLock = () => localStorage.removeItem(LOCK_KEY);

// `null` — xesh yo'q (masalan brauzer ma'lumoti tozalangan).
// Bunday holda chaqiruvchi to'liq kirishni so'raydi.
export const verifyPassword = async (password) => {
	const raw = localStorage.getItem(LOCK_KEY);
	if (!raw) return null;
	try {
		const { salt, hash } = JSON.parse(raw);
		return (await derive(password, salt)) === hash;
	} catch {
		return null;
	}
};

export const logout = () => {
	me = null; team = null; isOwner = false;
	forgetLock();
	return request('DELETE', `${CFG.endpoint}/account/sessions/current`);
};

export const register = async (email, password, name) => {
	await request('POST', `${CFG.endpoint}/account`, { userId: 'unique()', email, password, name });
	return login(email, password);
};

// Kirgandan keyin: foydalanuvchi qaysi jamoada va qanday rolda?
// Jamoa bo'lmasa — yangi ega, o'ziga jamoa yaratamiz.
export const init = async () => {
	me = await account();
	if (!me) return null;

	const { teams } = await request('GET', `${CFG.endpoint}/teams?${Q([{ method: 'limit', values: [10] }])}`);

	if (!teams?.length) {
		team = await request('POST', `${CFG.endpoint}/teams`, {
			teamId: 'unique()',
			name: me.name || me.email,
			roles: ['owner'],
		});
		isOwner = true;
	} else {
		team = teams[0];
		const { memberships } = await request('GET', `${CFG.endpoint}/teams/${team.$id}/memberships?${Q([{ method: 'limit', values: [100] }])}`);
		const mine = memberships.find((m) => m.userId === me.$id);
		isOwner = Boolean(mine?.roles?.includes('owner'));
	}

	return { me, team, isOwner };
};

// --- Ruxsatlar ---

// Kontaktlar: jamoa ko'radi, faqat ega o'zgartiradi/o'chiradi
const contactPerms = () => [
	`read("team:${team.$id}")`,
	`update("team:${team.$id}/owner")`,
	`delete("team:${team.$id}/owner")`,
];

// Yozuvlar: faqat o'qish. Yaratilgandan keyin o'zgarmaydi — pul yozuvi
// uchun eng muhim qoida.
const entryPerms = () => [`read("team:${team.$id}")`];

// --- O'qish ---

export const fetchAll = async () => {
	const [contacts, entries] = await Promise.all([
		listAll(CFG.contacts),
		listAll(CFG.entries),
	]);

	const byContact = new Map();
	for (const e of entries) {
		if (!byContact.has(e.contact_id)) byContact.set(e.contact_id, []);
		byContact.get(e.contact_id).push(toEntry(e));
	}

	return contacts.map((c) => ({
		id: c.$id,
		name: c.name,
		info: c.info || '',
		createdAt: Date.parse(c.$createdAt),
		entries: byContact.get(c.$id) || [],
	}));
};

const toEntry = (e) => ({
	id: e.$id,
	kind: e.kind,
	amount: e.amount,
	note: e.note || '',
	at: Date.parse(e.$createdAt),
	by: e.by || '',
	byName: e.by_name || '',
});

// --- Yozish ---

export const addContact = async (_userId, { name, info }) => {
	// Kontaktga "faqat ega tahrirlaydi" ruxsati qo'yiladi. Appwrite'da
	// foydalanuvchi o'zida bo'lmagan rolni bera olmaydi — kassir bunday
	// ruxsat yoza olmaydi, shuning uchun u server funksiyasi orqali
	// yaratadi. Ega esa to'g'ridan-to'g'ri yozaveradi (tezroq).
	if (!isOwner) {
		const out = await callFn({ action: 'contact', name, info });
		return { id: out.id, name, info: info || '', createdAt: Date.parse(out.createdAt), entries: [] };
	}

	const row = await request('POST', `${base}/${CFG.contacts}/rows`, {
		rowId: 'unique()',
		data: { name, info: info || '', team_id: team.$id },
		permissions: contactPerms(),
	});
	return { id: row.$id, name: row.name, info: row.info || '', createdAt: Date.parse(row.$createdAt), entries: [] };
};

// Tahrirlash va o'chirish — FAQAT EGA. Serverda ham shunday: qator
// ruxsatlari `update`/`delete` ni team owner'ga bog'lagan. Bu yerdagi
// tekshiruv shunchaki tushunarli xabar berish uchun.
export const updateContact = (id, { name, info }) => {
	if (!isOwner) throw new Error('faqat ega tahrirlaydi');
	return request('PATCH', `${base}/${CFG.contacts}/rows/${id}`, { data: { name, info: info || '' } });
};

export const deleteContact = async (id, entries) => {
	if (!isOwner) throw new Error('faqat ega o‘chiradi');
	// Yozuvlar o'chirilmaydi (ruxsat yo'q) — ular tarix sifatida qoladi,
	// lekin kontaktsiz bo'lgani uchun hech qayerda ko'rinmaydi.
	await request('DELETE', `${base}/${CFG.contacts}/rows/${id}`);
};

export const addEntry = async (_userId, contactId, { kind, amount, note }) => {
	const row = await request('POST', `${base}/${CFG.entries}/rows`, {
		rowId: 'unique()',
		data: {
			contact_id: contactId, kind, amount, note: note || '',
			by: me.$id, by_name: me.name || me.email, team_id: team.$id,
		},
		permissions: entryPerms(),
	});
	return toEntry(row);
};

// --- Sozlamalar (qulf daqiqasi) ---

let settingsRow = null;

export const loadSettings = async () => {
	const rows = await listAll(CFG.settings, [
		{ method: 'equal', attribute: 'team_id', values: [team.$id] },
	]);
	settingsRow = rows[0] || null;
	return { lockMinutes: settingsRow?.lock_minutes ?? 10 };
};

export const saveSettings = async ({ lockMinutes }) => {
	const data = { team_id: team.$id, lock_minutes: lockMinutes };

	if (settingsRow) {
		settingsRow = await request('PATCH', `${base}/${CFG.settings}/rows/${settingsRow.$id}`, {
			data: { lock_minutes: lockMinutes },
		});
	} else {
		settingsRow = await request('POST', `${base}/${CFG.settings}/rows`, {
			rowId: 'unique()',
			data,
			// Sozlamani hamma o'qiydi, faqat ega o'zgartiradi
			permissions: [
				`read("team:${team.$id}")`,
				`update("team:${team.$id}/owner")`,
				`delete("team:${team.$id}/owner")`,
			],
		});
	}
	return { lockMinutes: settingsRow.lock_minutes };
};

// --- Jamoa a'zolari (kassirlar) ---

export const members = async () => {
	const { memberships } = await request('GET',
		`${CFG.endpoint}/teams/${team.$id}/memberships?${Q([{ method: 'limit', values: [100] }])}`);
	return memberships.map((m) => ({
		id: m.userId,
		membershipId: m.$id,
		name: m.userName || m.userEmail,
		email: m.userEmail,
		owner: m.roles.includes('owner'),
	}));
};

export const removeMember = (membershipId) =>
	request('DELETE', `${CFG.endpoint}/teams/${team.$id}/memberships/${membershipId}`);

// Kassir hisobini yaratish/parolini almashtirish.
//
// Server funksiyasi orqali: hisob yaratish API kalit talab qiladi, u esa
// brauzerda bo'lishi mumkin emas. Funksiya chaqiruvchi shu jamoaning
// egasi ekanini tekshiradi — begona odam boshqa restoranga kassir
// qo'sha olmaydi.
const callFn = async (payload) => {
	const run = await request('POST', `${CFG.endpoint}/functions/kassir/executions`, {
		body: JSON.stringify({ ...payload, teamId: team.$id }),
		async: false, path: '/', method: 'POST',
	});
	const out = JSON.parse(run.responseBody || '{}');
	if (run.responseStatusCode !== 200) throw new Error(out.error || `xato ${run.responseStatusCode}`);
	return out;
};

export const addCashier = ({ login, password, name }) =>
	callFn({ action: 'create', login, password, name });

export const setCashierPassword = (userId, password) =>
	callFn({ action: 'password', userId, password });

// Kassir "aziz" deb kiradi, tizimda esa email saqlanadi
export const LOGIN_DOMAIN = 'kassir.local';
export const loginToEmail = (v) =>
	v.includes('@') ? v : `${v.toLowerCase().trim()}@${LOGIN_DOMAIN}`;

// --- Real vaqt ---
//
// Kassir kompyuterda yozuv qo'shsa, egasining telefonida ~0.5 soniyada
// paydo bo'ladi — sahifani yangilash shart emas.

export const subscribe = (onEntry) => {
	const channel = `databases.${CFG.db}.tables.${CFG.entries}.rows`;
	const qs = new URLSearchParams({ project: CFG.project });
	qs.append('channels[]', channel);

	let ws = null;
	let retry = 0;
	let closed = false;

	const connect = () => {
		if (closed) return;
		ws = new WebSocket(`wss://fra.cloud.appwrite.io/v1/realtime?${qs}`);

		ws.addEventListener('message', (ev) => {
			const msg = JSON.parse(ev.data);
			if (msg.type !== 'event') return;

			const created = msg.data.events.some((e) => e.endsWith('.create'));
			const row = msg.data.payload;
			if (!created || row.team_id !== team.$id) return;

			// O'zi yozgan yozuv allaqachon ekranda — takrorlamaymiz
			if (row.by === me.$id) return;

			onEntry(toEntry(row), row.contact_id);
		});

		ws.addEventListener('open', () => { retry = 0; });

		// Uzilsa qayta ulanadi — internet bir zum uzilgani ish to'xtatmasin
		ws.addEventListener('close', () => {
			if (closed) return;
			retry = Math.min(retry + 1, 6);
			setTimeout(connect, 1000 * 2 ** retry);
		});
	};

	connect();
	return () => { closed = true; ws?.close(); };
};
