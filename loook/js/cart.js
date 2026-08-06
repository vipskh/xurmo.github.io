// Savatcha holati — brauzer localStorage'ida saqlanadi, sahifa
// yangilansa yo'qolmaydi. order-ui.js shu yerdan o'qiydi/yozadi.

const KEY = 'menu_cart_v1';
const listeners = new Set();

const load = () => {
	try {
		const list = JSON.parse(localStorage.getItem(KEY) || '[]');
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
};

let items = load();

const save = () => {
	try {
		localStorage.setItem(KEY, JSON.stringify(items));
	} catch {
		// xotira to'lgan yoki localStorage o'chirilgan — savatcha shu
		// sessiyada xotirada ishlashda davom etadi
	}
	listeners.forEach((fn) => fn(items));
};

// Har bir o'zgarishda chaqiriladi; ulanganda darhol joriy holatni ham beradi
export const subscribe = (fn) => {
	listeners.add(fn);
	fn(items);
	return () => listeners.delete(fn);
};

export const getItems = () => items;
export const getCount = () => items.reduce((sum, i) => sum + i.qty, 0);
export const getTotal = () => items.reduce((sum, i) => sum + i.price * i.qty, 0);

// Mahsulot + tanlangan o'lcham birgalikda alohida qator hisoblanadi:
// "Katta" va "Kichik" savatchada ikkita qator bo'lib turadi.
export const addItem = ({ id, name, price, image, sizeLabel }) => {
	const key = sizeLabel ? `${id}::${sizeLabel}` : String(id);
	const existing = items.find((i) => i.key === key);
	if (existing) {
		existing.qty += 1;
		items = [...items];
	} else {
		items = [...items, { key, id, name, price: Number(price) || 0, image, sizeLabel, qty: 1 }];
	}
	save();
};

export const setQty = (key, qty) => {
	items = qty <= 0
		? items.filter((i) => i.key !== key)
		: items.map((i) => (i.key === key ? { ...i, qty } : i));
	save();
};

export const clear = () => {
	items = [];
	save();
};
