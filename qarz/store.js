// Qarz daftar — ma'lumot qatlami (Appwrite).
//
// Bu yerda API kalit YO'Q va bo'lmasligi kerak. Brauzer faqat Project ID
// bilan ishlaydi; yozish huquqi tizimga kirgan foydalanuvchiga beriladi.
//
// Ma'lumot ajratilishi: har bir qator yaratilganda unga FAQAT yaratuvchining
// o'zi ruxsat oladi. Boshqa foydalanuvchi ID'ni bilib turib ham o'qiy
// olmaydi — tekshiruv serverda, brauzerda emas.

const CFG = {
	endpoint: 'https://fra.cloud.appwrite.io/v1',
	project: '6a396eba00119eaa8de0',
	db: 'marketplace',
	contacts: 'menu_debt_contacts',
	entries: 'menu_debt_entries',
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
	// Appwrite bir so'rovda 100 tadan ko'p qaytarmaydi — hammasini yig'amiz
	const out = [];
	let cursor = null;
	for (let i = 0; i < 50; i++) {
		const q = [...queries, { method: 'limit', values: [100] }];
		if (cursor) q.push({ method: 'cursorAfter', values: [cursor] });
		const { rows } = await request('GET', `${base}/${table}/rows?${Q(q)}`);
		out.push(...rows);
		if (rows.length < 100) break;
		cursor = rows[rows.length - 1].$id;
	}
	return out;
};

// --- Mehmon rejimi ---
//
// Kirishsiz sinab ko'rish uchun. Ma'lumot faqat shu brauzerda qoladi —
// serverga umuman tegmaydi. Shunday qilinishining sababi: sahifa ochiq,
// kirishsiz hamma bitta serverdagi hisobga tushsa bir-birining yozuvini
// ko'rar va o'chira olardi.

const GUEST_KEY = 'debtnote-guest';

export let guest = false;
export const setGuest = (v) => { guest = v; };

const gLoad = () => {
	try { return JSON.parse(localStorage.getItem(GUEST_KEY)) || []; } catch { return []; }
};
const gSave = (contacts) => localStorage.setItem(GUEST_KEY, JSON.stringify(contacts));
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// --- Kirish ---

export const me = async () => {
	try {
		return await request('GET', `${CFG.endpoint}/account`);
	} catch {
		return null;
	}
};

export const login = (email, password) =>
	request('POST', `${CFG.endpoint}/account/sessions/email`, { email, password });

export const logout = () =>
	request('DELETE', `${CFG.endpoint}/account/sessions/current`);

export const register = async (email, password, name) => {
	await request('POST', `${CFG.endpoint}/account`, { userId: 'unique()', email, password, name });
	return login(email, password);
};

// --- Ruxsatlar ---
// Qator faqat egasiniki. Admin ham ko'ra olmaydi (API kalitsiz).

const ownerOnly = (userId) => [
	`read("user:${userId}")`,
	`update("user:${userId}")`,
	`delete("user:${userId}")`,
];

// --- O'qish ---

export const fetchAll = async () => {
	if (guest) return gLoad();

	const [contacts, entries] = await Promise.all([
		listAll(CFG.contacts),
		listAll(CFG.entries),
	]);

	const byContact = new Map();
	for (const e of entries) {
		if (!byContact.has(e.contact_id)) byContact.set(e.contact_id, []);
		byContact.get(e.contact_id).push({
			id: e.$id,
			kind: e.kind,
			amount: e.amount,
			note: e.note || '',
			at: Date.parse(e.$createdAt),
		});
	}

	return contacts.map((c) => ({
		id: c.$id,
		name: c.name,
		info: c.info || '',
		createdAt: Date.parse(c.$createdAt),
		entries: byContact.get(c.$id) || [],
	}));
};

// --- Yozish ---

export const addContact = async (userId, { name, info }) => {
	if (guest) {
		const c = { id: gid(), name, info: info || '', createdAt: Date.now(), entries: [] };
		const all = gLoad();
		all.push(c);
		gSave(all);
		return c;
	}

	const row = await request('POST', `${base}/${CFG.contacts}/rows`, {
		rowId: 'unique()',
		data: { name, info: info || '' },
		permissions: ownerOnly(userId),
	});
	return { id: row.$id, name: row.name, info: row.info || '', createdAt: Date.parse(row.$createdAt), entries: [] };
};

export const updateContact = async (id, { name, info }) => {
	if (guest) {
		const all = gLoad();
		const c = all.find((x) => x.id === id);
		if (c) { c.name = name; c.info = info || ''; gSave(all); }
		return c;
	}
	return request('PATCH', `${base}/${CFG.contacts}/rows/${id}`, { data: { name, info: info || '' } });
};

export const deleteContact = async (id, entries) => {
	if (guest) {
		gSave(gLoad().filter((c) => c.id !== id));
		return;
	}
	// Avval yozuvlar, keyin kontakt — aks holda egasiz yozuvlar qoladi
	await Promise.all(entries.map((e) =>
		request('DELETE', `${base}/${CFG.entries}/rows/${e.id}`).catch(() => {})));
	return request('DELETE', `${base}/${CFG.contacts}/rows/${id}`);
};

export const addEntry = async (userId, contactId, { kind, amount, note }) => {
	if (guest) {
		const e = { id: gid(), kind, amount, note: note || '', at: Date.now() };
		const all = gLoad();
		const c = all.find((x) => x.id === contactId);
		if (c) { c.entries.push(e); gSave(all); }
		return e;
	}

	const row = await request('POST', `${base}/${CFG.entries}/rows`, {
		rowId: 'unique()',
		data: { contact_id: contactId, kind, amount, note: note || '' },
		permissions: ownerOnly(userId),
	});
	return { id: row.$id, kind: row.kind, amount: row.amount, note: row.note || '', at: Date.parse(row.$createdAt) };
};

// --- Eslatmalar ---
// Alohida jadval ochilmadi: eslatma — oddiy matn, kontaktsiz. Bepul
// tarifda jadval soni cheklangani uchun brauzerda saqlanadi.

const NOTES_KEY = 'debtnote-notes';

export const loadNotes = () => {
	try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || []; } catch { return []; }
};

export const saveNotes = (notes) => localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
