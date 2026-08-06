// Savatcha paneli va buyurtma modali — DOM qismi.
// Holat cart.js da, yuborish telegram.js da.

import * as cart from './cart.js';
import { sendOrder } from './telegram.js';
import { initMap, destroyMap } from './map.js';

const money = (n) => Number(n || 0).toLocaleString('ru-RU');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
	({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const T = {
	uz: {
		cart: 'Savatcha', empty: 'Hozirgi vaqtda sizning savatchangiz bo‘sh',
		total: 'Jami', checkout: 'RASMIYLASHTIRISH', order: 'BUYURTMANI YUBORISH',
		title: 'YETKAZIB BERISH', name: 'Ismingiz', phone: 'Telefon',
		street: 'Ko‘cha', house: 'Uy raqami', flat: 'Kvartira', floor: 'Qavat',
		bell: 'Domofon', note: 'Izoh (ixtiyoriy)', required: 'To‘ldirilishi shart',
		badPhone: 'Telefon raqamini to‘liq kiriting (+998xxxxxxxxx)',
		sending: 'Yuborilmoqda…', failed: 'Yuborib bo‘lmadi. Qaytadan urinib ko‘ring.',
		okTitle: 'Buyurtma qabul qilindi!', okText: 'Tez orada siz bilan bog‘lanamiz.',
		close: 'Yopish', add: 'Qo‘shish', added: 'Qo‘shildi ✓',
		mapHint: 'Xaritada uyingizni belgilang — manzil o‘zi to‘ladi',
	},
	ru: {
		cart: 'Корзина', empty: 'В данный момент ваша корзина пуста',
		total: 'Итого', checkout: 'ОФОРМИТЬ', order: 'ОТПРАВИТЬ ЗАКАЗ',
		title: 'ДОСТАВКА', name: 'Ваше имя', phone: 'Телефон',
		street: 'Улица', house: 'Дом', flat: 'Квартира', floor: 'Этаж',
		bell: 'Домофон', note: 'Комментарий (необязательно)', required: 'Обязательное поле',
		badPhone: 'Введите номер полностью (+998xxxxxxxxx)',
		sending: 'Отправка…', failed: 'Не удалось отправить. Попробуйте ещё раз.',
		okTitle: 'Заказ принят!', okText: 'Мы свяжемся с вами в ближайшее время.',
		close: 'Закрыть', add: 'Добавить', added: 'Добавлено ✓',
		mapHint: 'Отметьте дом на карте — адрес заполнится сам',
	},
	en: {
		cart: 'Cart', empty: 'Your cart is currently empty',
		total: 'Total', checkout: 'CHECKOUT', order: 'PLACE ORDER',
		title: 'DELIVERY', name: 'Your name', phone: 'Phone',
		street: 'Street', house: 'House', flat: 'Flat', floor: 'Floor',
		bell: 'Doorbell', note: 'Note (optional)', required: 'This field is required',
		badPhone: 'Enter the full number (+998xxxxxxxxx)',
		sending: 'Sending…', failed: 'Could not send. Please try again.',
		okTitle: 'Order received!', okText: 'We will contact you shortly.',
		close: 'Close', add: 'Add', added: 'Added ✓',
		mapHint: 'Mark your house on the map — the address fills in',
	},
};

export function initOrderUI(lang = 'uz') {
	const t = T[lang] || T.uz;

	document.body.insertAdjacentHTML('beforeend', `
		<div class="overlay" id="overlay"></div>

		<aside class="cart-drawer" id="cart-drawer" aria-label="${esc(t.cart)}">
			<div class="cart-head">
				<h2>${esc(t.cart)}</h2>
				<button type="button" class="cart-close" id="cart-close" aria-label="${esc(t.close)}">✕</button>
			</div>
			<div class="cart-body" id="cart-body"></div>
			<div class="cart-foot" id="cart-foot" hidden>
				<div class="cart-total"><span>${esc(t.total)}</span><b id="cart-total">0</b></div>
				<button type="button" class="order-submit" id="to-checkout">${esc(t.checkout)}</button>
			</div>
		</aside>

		<div class="order-modal" id="order-modal" role="dialog" aria-modal="true">
			<div class="order-card" id="order-card">
				<button type="button" class="order-close" id="order-close" aria-label="${esc(t.close)}">✕</button>
				<div id="order-content"></div>
			</div>
		</div>
	`);

	const $ = (id) => document.getElementById(id);
	const overlay = $('overlay');
	const drawer = $('cart-drawer');
	const modal = $('order-modal');
	const card = $('order-card');

	// --- Ochish / yopish ---

	const lockScroll = (on) => document.body.classList.toggle('no-scroll', on);

	const openDrawer = () => {
		drawer.classList.add('is-open');
		overlay.classList.add('is-open');
		lockScroll(true);
	};

	const closeDrawer = () => {
		drawer.classList.remove('is-open');
		if (!modal.classList.contains('is-open')) {
			overlay.classList.remove('is-open');
			lockScroll(false);
		}
	};

	const openModal = () => {
		modal.classList.add('is-open');
		overlay.classList.add('is-open');
		lockScroll(true);
	};

	// bounceOutUp tugagach yashiramiz — animatsiya ko'rinib qolishi uchun
	const closeModal = () => {
		card.classList.add('is-closing');
		card.addEventListener('animationend', () => {
			modal.classList.remove('is-open');
			card.classList.remove('is-closing');
			destroyMap();
			if (!drawer.classList.contains('is-open')) {
				overlay.classList.remove('is-open');
				lockScroll(false);
			}
		}, { once: true });
	};

	$('cart-close').addEventListener('click', closeDrawer);
	$('order-close').addEventListener('click', closeModal);

	overlay.addEventListener('click', () => {
		if (modal.classList.contains('is-open')) closeModal();
		else closeDrawer();
	});

	// Modal ochiq bo'lganda qorong'i joyni bosish — bosilgan element
	// .overlay emas, .order-modal ning o'zi bo'ladi (u ustida turadi)
	modal.addEventListener('click', (e) => {
		if (e.target === modal) closeModal();
	});

	document.addEventListener('keydown', (e) => {
		if (e.key !== 'Escape') return;
		if (modal.classList.contains('is-open')) closeModal();
		else if (drawer.classList.contains('is-open')) closeDrawer();
	});

	// --- Savatchani chizish ---

	const body = $('cart-body');
	const foot = $('cart-foot');

	cart.subscribe((items) => {
		const badge = document.getElementById('cart-count');
		if (badge) {
			const n = cart.getCount();
			badge.textContent = n;
			badge.hidden = n === 0;
		}

		if (!items.length) {
			body.innerHTML = `
				<div class="cart-empty">
					<div class="cart-empty-icon">🛒</div>
					<p class="cart-empty-text">${esc(t.empty)}</p>
				</div>`;
			foot.hidden = true;
			return;
		}

		body.innerHTML = items.map((i) => `
			<div class="cart-item" data-key="${esc(i.key)}">
				${i.image
					? `<img class="cart-item-img" src="${esc(i.image)}" alt="" loading="lazy">`
					: '<div class="cart-item-img"></div>'}
				<div class="cart-item-body">
					<p class="cart-item-name">${esc(i.name)}</p>
					${i.sizeLabel ? `<p class="cart-item-size">${esc(i.sizeLabel)}</p>` : ''}
					<div class="cart-item-row">
						<div class="qty">
							<button type="button" data-act="dec">−</button>
							<span>${i.qty}</span>
							<button type="button" data-act="inc">+</button>
						</div>
						<span class="cart-item-price">${money(i.price * i.qty)} so‘m</span>
					</div>
				</div>
			</div>`).join('');

		$('cart-total').textContent = `${money(cart.getTotal())} so‘m`;
		foot.hidden = false;
	});

	body.addEventListener('click', (e) => {
		const btn = e.target.closest('[data-act]');
		if (!btn) return;
		const key = btn.closest('.cart-item').dataset.key;
		const item = cart.getItems().find((i) => i.key === key);
		if (!item) return;
		cart.setQty(key, item.qty + (btn.dataset.act === 'inc' ? 1 : -1));
	});

	// --- Buyurtma formasi ---

	const field = (id, label, extra = '') => `
		<div class="order-field" data-field="${id}">
			<label for="f-${id}">${esc(label)}</label>
			<input type="text" id="f-${id}" ${extra}>
			<p class="order-error">${esc(t.required)}</p>
		</div>`;

	const renderForm = () => {
		$('order-content').innerHTML = `
			<h2 class="order-title">${esc(t.title)}</h2>
			<form id="order-form" novalidate>
				<div class="order-map-wrap">
					<div class="order-map" id="order-map"></div>
					<p class="order-map-hint">${esc(t.mapHint)}</p>
				</div>
				${field('name', t.name, 'autocomplete="name"')}
				${field('phone', t.phone, 'type="tel" inputmode="tel" placeholder="+998" autocomplete="tel"')}
				${field('street', t.street)}
				<div class="order-row2">
					${field('house', t.house)}
					${field('flat', t.flat, 'data-optional')}
				</div>
				<div class="order-row2">
					${field('floor', t.floor, 'data-optional')}
					${field('bell', t.bell, 'data-optional')}
				</div>
				<div class="order-field" data-field="note">
					<label for="f-note">${esc(t.note)}</label>
					<textarea id="f-note"></textarea>
				</div>
				<button type="submit" class="order-submit-btn" id="order-send">${esc(t.order)}</button>
				<p class="order-status" id="order-status"></p>
			</form>`;

		document.getElementById('order-form').addEventListener('submit', onSubmit);

		// Xaritada belgi qo'yilganda ko'cha/uy maydonlari to'ladi.
		// Foydalanuvchi allaqachon qo'lda yozgan bo'lsa — ustiga yozmaymiz.
		picked = null;
		initMap(document.getElementById('order-map'), (lat, lng, address) => {
			picked = { lat, lng, full: address?.full || '' };
			if (!address) return;
			const street = document.getElementById('f-street');
			const house = document.getElementById('f-house');
			if (address.street && !street.value.trim()) street.value = address.street;
			if (address.house && !house.value.trim()) house.value = address.house;
		});
	};

	// Xaritada tanlangan nuqta — buyurtma bilan birga Telegram'ga ketadi
	let picked = null;

	const val = (id) => document.getElementById(`f-${id}`).value.trim();

	const markInvalid = (id, message) => {
		const wrap = document.querySelector(`[data-field="${id}"]`);
		wrap.classList.add('invalid');
		if (message) wrap.querySelector('.order-error').textContent = message;
	};

	async function onSubmit(e) {
		e.preventDefault();

		document.querySelectorAll('.order-field.invalid')
			.forEach((el) => el.classList.remove('invalid'));

		let ok = true;
		['name', 'phone', 'street', 'house'].forEach((id) => {
			if (!val(id)) { markInvalid(id, t.required); ok = false; }
		});

		const phone = val('phone').replace(/[^\d+]/g, '');
		if (val('phone') && !/^\+998\d{9}$/.test(phone)) {
			markInvalid('phone', t.badPhone);
			ok = false;
		}
		if (!ok) return;

		const btn = $('order-send');
		const status = $('order-status');
		btn.disabled = true;
		status.className = 'order-status';
		status.textContent = t.sending;

		try {
			await sendOrder({
				customer: { name: val('name'), phone },
				address: {
					street: val('street'), house: val('house'),
					flat: val('flat'), floor: val('floor'), bell: val('bell'),
					point: picked,
				},
				note: document.getElementById('f-note').value.trim(),
				items: cart.getItems(),
				total: cart.getTotal(),
			});

			cart.clear();
			$('order-content').innerHTML = `
				<div class="order-success">
					<div class="order-success-icon">✅</div>
					<h3>${esc(t.okTitle)}</h3>
					<p>${esc(t.okText)}</p>
					<button type="button" class="order-submit-btn" id="order-done">${esc(t.close)}</button>
				</div>`;
			$('order-done').addEventListener('click', closeModal);
		} catch (err) {
			console.error(err);
			btn.disabled = false;
			status.className = 'order-status is-error';
			status.textContent = t.failed;
		}
	}

	$('to-checkout').addEventListener('click', () => {
		if (!cart.getCount()) return;
		closeDrawer();
		renderForm();
		openModal();
	});

	return { openDrawer, addLabel: t.add, addedLabel: t.added };
}
