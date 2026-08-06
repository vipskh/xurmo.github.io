// Buyurtmani Telegram botga yuborish.
//
// ═══ SOZLASH ═══════════════════════════════════════════════════════
//
// 1. Telegramda @BotFather ga /newbot yozing, bot yarating, TOKEN oling
// 2. Botni buyurtma tushadigan guruhga qo'shing, guruhga "test" deb yozing
// 3. CHAT_ID ni topish uchun:
//        node appwrite/telegram-chatid.mjs <TOKEN>
// 4. Ikkalasini quyiga qo'ying
//
// ═══ MUHIM ════════════════════════════════════════════════════════
//
// PROXY_URL bo'sh bo'lsa — token shu faylda, ya'ni BRAUZERGA ketadi va
// saytga kirgan har kim uni ko'ra oladi. Ko'rgan odam bot nomidan
// soxta buyurtma yuborishi mumkin. Sinov uchun mayli, lekin haqiqiy
// mijozlar uchun ochishdan oldin PROXY_URL ni to'ldiring (pastda).

// Token va chat ID telegram.local.js da — u git'ga kirmaydi.
// Fayl bo'lmasa sayt baribir ishlaydi, faqat buyurtma yuborilmaydi.
let BOT_TOKEN = '';
let CHAT_ID = '';
try {
	const local = await import('./telegram.local.js');
	BOT_TOKEN = local.BOT_TOKEN || '';
	CHAT_ID = local.CHAT_ID || '';
} catch {
	// telegram.local.js yo'q — PROXY_URL ishlatilayotgan bo'lishi mumkin
}

// Appwrite Function — token shu yerda emas, Appwrite muhitida.
// Yuborish: appwrite/7-deploy-telegram.mjs
const PROXY_URL = 'https://fra.cloud.appwrite.io/v1/functions/telegram-order/executions';
const PROJECT_ID = '6a396eba00119eaa8de0';

const money = (n) => Number(n || 0).toLocaleString('ru-RU');

const esc = (s) => String(s ?? '')
	.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Qisqa buyurtma raqami — bir vaqtda kelgan buyurtmalarni ajratish uchun.
// Dastavchik "№ 4821" ni ko'radi va har bir xabar qaysi buyurtmaniki
// ekanini darhol biladi. Soniya asosida, ya'ni ketma-ket buyurtmalar
// har xil raqam oladi.
export const orderNumber = () => String(Math.floor(Date.now() / 1000) % 10000).padStart(4, '0');

export const buildMessage = ({ customer, address, note, items, total }, num) => {
	const time = new Date().toLocaleString('ru-RU', {
		day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
	});

	const lines = [
		`🧾 <b>BUYURTMA № ${num}</b>`,
		`🕐 ${time}`,
		'',
		`👤 ${esc(customer.name)}`,
		`📞 <a href="tel:${esc(customer.phone)}">${esc(customer.phone)}</a>`,
		'',
		'📍 <b>Manzil</b>',
		`${esc(address.street)}, ${esc(address.house)}`,
	];

	const extra = [
		address.flat && `kv. ${address.flat}`,
		address.floor && `${address.floor}-qavat`,
		address.bell && `domofon ${address.bell}`,
	].filter(Boolean);
	if (extra.length) lines.push(esc(extra.join(' · ')));

	// Xaritadan olingan to'liq manzil — mijoz yozganini tekshirish uchun
	if (address.point?.full) lines.push(`<i>${esc(address.point.full)}</i>`);

	if (address.point) {
		const { lat, lng } = address.point;
		lines.push(`🗺 <a href="https://maps.google.com/?q=${lat},${lng}">Xaritada ochish</a>`);
	}

	const count = items.reduce((n, i) => n + i.qty, 0);
	lines.push('', `🍽 <b>Buyurtma</b> (${count} dona)`);

	items.forEach((i) => {
		const name = i.sizeLabel ? `${i.name} (${i.sizeLabel})` : i.name;
		lines.push(`• ${esc(name)}`);
		lines.push(`   ${money(i.price)} × ${i.qty} = <b>${money(i.price * i.qty)} so'm</b>`);
	});

	lines.push('', `💰 <b>JAMI: ${money(total)} so'm</b>`);
	if (note) lines.push('', `💬 ${esc(note)}`);

	return lines.join('\n');
};

// Telegram albom izohining chegarasi. Undan uzun bo'lsa albomga
// sig'maydi va matn alohida xabar bo'lib ketishi kerak.
const CAPTION_LIMIT = 1024;
const ALBUM_LIMIT = 10;   // Telegram bitta albomga ko'pi bilan 10 ta rasm oladi

export const sendOrder = async (order) => {
	const num = orderNumber();
	const text = buildMessage(order, num);

	// Appwrite Function orqali — token brauzerga tushmaydi.
	// Xabar matnini ham funksiyaning o'zi tuzadi: brauzerdan kelgan
	// tayyor matnga ishonib bo'lmaydi (kim xohlasa o'zgartirib yuborardi).
	if (PROXY_URL) {
		const res = await fetch(PROXY_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Appwrite-Project': PROJECT_ID },
			body: JSON.stringify({
				body: JSON.stringify({ order }),
				async: false,
				path: '/',
				method: 'POST',
			}),
		});

		if (!res.ok) throw new Error(`Appwrite ${res.status}`);

		const run = await res.json();
		if (run.responseStatusCode !== 200) {
			throw new Error(`Function ${run.responseStatusCode}: ${run.responseBody || run.errors}`);
		}
		return JSON.parse(run.responseBody || '{}');
	}

	if (!BOT_TOKEN || !CHAT_ID) {
		throw new Error('telegram.js: BOT_TOKEN va CHAT_ID to‘ldirilmagan');
	}

	const call = async (method, payload) => {
		const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chat_id: CHAT_ID, ...payload }),
		});
		if (!res.ok) {
			const detail = await res.text().catch(() => '');
			throw new Error(`Telegram ${method} ${res.status}: ${detail}`);
		}
		return res.json();
	};

	// Rasmni Telegram serverning o'zi yuklab oladi, shuning uchun havola
	// ommaviy bo'lishi shart (Appwrite'da `read("any")` — shunday).
	const photos = order.items.filter((i) => i.image).slice(0, ALBUM_LIMIT);

	// Bir vaqtda bir necha buyurtma kelganda xabarlar aralashib ketmasligi
	// uchun rasm va matn BITTA albom bo'lib ketadi: Telegram uni bo'linmas
	// birlik sifatida ko'rsatadi. Matn izohga sig'masa yoki rasm bo'lmasa —
	// oddiy xabar yuboriladi.
	const asAlbum = photos.length > 0 && text.length <= CAPTION_LIMIT;

	let sent;
	if (asAlbum) {
		const group = await call('sendMediaGroup', {
			media: photos.map((i, n) => ({
				type: 'photo',
				media: i.image,
				// Izoh faqat birinchi rasmda — Telegram albom tagida
				// bittagina matn ko'rsatadi
				...(n === 0 ? { caption: text, parse_mode: 'HTML' } : {}),
			})),
		});
		sent = group;
	} else {
		sent = await call('sendMessage', {
			text,
			parse_mode: 'HTML',
			disable_web_page_preview: true,
		});

		if (photos.length) {
			try {
				await call('sendMediaGroup', {
					media: photos.map((i, n) => ({
						type: 'photo',
						media: i.image,
						...(n === 0 ? { caption: `№ ${num}` } : {}),
					})),
				});
			} catch (err) {
				console.warn('Rasmlar yuborilmadi:', err);
			}
		}
	}

	// Lokatsiya pini — buyurtma xabariga JAVOB qilib biriktiriladi, shunda
	// aralashgan oqimda ham qaysi buyurtmaniki ekani ko'rinib turadi.
	// Xabar allaqachon ketgani uchun bu qadam yiqilsa buyurtma yo'qolmaydi.
	const point = order.address?.point;
	if (point) {
		const first = Array.isArray(sent?.result) ? sent.result[0] : sent?.result;
		try {
			await call('sendLocation', {
				latitude: point.lat,
				longitude: point.lng,
				...(first?.message_id ? { reply_to_message_id: first.message_id } : {}),
			});
		} catch (err) {
			console.warn('Lokatsiya yuborilmadi:', err);
		}
	}

	return sent;
};
