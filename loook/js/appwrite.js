// Appwrite bilan ishlash — brauzer tomonida.
// DIQQAT: bu yerda API kalit YO'Q va bo'lmasligi ham kerak. Brauzer faqat
// Project ID bilan ishlaydi; yozish huquqi tizimga kirgan foydalanuvchiga beriladi.

export const CFG = {
	endpoint: 'https://fra.cloud.appwrite.io/v1',
	project: '6a396eba00119eaa8de0',
	db: 'marketplace',
	tblCategories: 'menu_categories',
	tblProducts: 'menu_products',
	bucket: 'product-images',
};

const base = `${CFG.endpoint}/tablesdb/${CFG.db}/tables`;

const request = async (method, url, body, isForm = false) => {
	const headers = { 'X-Appwrite-Project': CFG.project };
	if (!isForm) headers['Content-Type'] = 'application/json';

	const res = await fetch(url, {
		method,
		headers,
		credentials: 'include', // sessiya cookie'si
		body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
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

// --- Rasm manzili ---
// Appwrite fayl ID'sidan to'g'ridan-to'g'ri ko'rish havolasi
export const imageUrl = (fileId) =>
	fileId
		? `${CFG.endpoint}/storage/buckets/${CFG.bucket}/files/${fileId}/view?project=${CFG.project}`
		: null;

// --- Ma'lumot o'qish (kirish talab qilinmaydi — menyu ommaviy) ---

const listRows = async (table, queries = []) => {
	const params = queries.map((q) => `queries[]=${encodeURIComponent(JSON.stringify(q))}`).join('&');
	const { rows } = await request('GET', `${base}/${table}/rows${params ? '?' + params : ''}`);
	return rows;
};

const Q = {
	limit: (n) => ({ method: 'limit', values: [n] }),
	orderAsc: (attr) => ({ method: 'orderAsc', attribute: attr }),
	equal: (attr, v) => ({ method: 'equal', attribute: attr, values: [v] }),
};

export const getCategories = () => listRows(CFG.tblCategories, [Q.orderAsc('sort'), Q.limit(100)]);

export const getProducts = ({ activeOnly = false } = {}) => {
	const q = [Q.orderAsc('sort'), Q.limit(500)];
	if (activeOnly) q.push(Q.equal('is_active', true));
	return listRows(CFG.tblProducts, q);
};

// --- Yozish (faqat tizimga kirgan admin) ---

export const createRow = (table, data) =>
	request('POST', `${base}/${table}/rows`, { rowId: 'unique()', data });

export const updateRow = (table, id, data) =>
	request('PATCH', `${base}/${table}/rows/${id}`, { data });

export const deleteRow = (table, id) =>
	request('DELETE', `${base}/${table}/rows/${id}`);

// --- Rasm yuklash / o'chirish ---

export const uploadImage = async (file) => {
	const form = new FormData();
	form.append('fileId', 'unique()');
	form.append('file', file);
	form.append('permissions[]', 'read("any")');
	form.append('permissions[]', 'update("users")');
	form.append('permissions[]', 'delete("users")');

	const res = await request(
		'POST',
		`${CFG.endpoint}/storage/buckets/${CFG.bucket}/files`,
		form,
		true
	);
	return res.$id;
};

// Namuna rasmlari (`menu-...`) loyihaning bir qismi — ular o'chirilmaydi
export const deleteImage = async (fileId) => {
	if (!fileId || fileId.startsWith('menu-')) return;
	try {
		await request('DELETE', `${CFG.endpoint}/storage/buckets/${CFG.bucket}/files/${fileId}`);
	} catch { /* fayl allaqachon yo'q bo'lsa muhim emas */ }
};

// --- Kirish / chiqish ---

export const login = (email, password) =>
	request('POST', `${CFG.endpoint}/account/sessions/email`, { email, password });

export const logout = () =>
	request('DELETE', `${CFG.endpoint}/account/sessions/current`);

export const currentUser = async () => {
	try {
		return await request('GET', `${CFG.endpoint}/account`);
	} catch {
		return null;
	}
};
