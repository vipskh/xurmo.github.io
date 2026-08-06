// Manzil xaritasi — Leaflet + OpenStreetMap.
//
// Nega Yandex/Google emas: ikkalasi ham API kalit talab qiladi (Google
// yana to'lov kartasini ham). KFC sahifasidagi kalitlar kfc.com.uz
// domeniga qulflangan — boshqa saytdan ishlamaydi. OSM esa kalitsiz
// ishlaydi, shuning uchun bu yerda hech narsa sozlamasdan ishga tushadi.
//
// Kerak bo'lsa keyinchalik Yandex'ga o'tish oson: initMap va reverse
// funksiyalarini almashtirish yetarli, chaqiruvchi kod o'zgarmaydi.

// Toshkent markazi — foydalanuvchi joylashuvi aniqlanmasa shu ko'rsatiladi
const DEFAULT_CENTER = [41.2995, 69.2401];
const DEFAULT_ZOOM = 13;
const PIN_ZOOM = 17;

// Nominatim foydalanish shartlari: sekundiga 1 ta so'rov. Foydalanuvchi
// xaritani surganda har harakatda so'rov ketmasligi uchun kechiktiramiz.
const DEBOUNCE_MS = 700;

let map = null;
let marker = null;
let timer = null;

const reverse = async (lat, lon) => {
	const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&accept-language=uz`;
	const res = await fetch(url, { headers: { Accept: 'application/json' } });
	if (!res.ok) throw new Error(`Nominatim ${res.status}`);
	const data = await res.json();
	const a = data.address || {};
	return {
		street: a.road || a.pedestrian || a.neighbourhood || a.suburb || '',
		house: a.house_number || '',
		full: data.display_name || '',
	};
};

// onPick(lat, lng, address) — belgi qo'yilganda chaqiriladi.
// address `null` bo'lishi mumkin: internet yo'q yoki Nominatim javob bermadi;
// bunday holda foydalanuvchi maydonlarni qo'lda to'ldiradi.
export function initMap(el, onPick) {
	if (typeof L === 'undefined') return null;

	map = L.map(el, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; OpenStreetMap',
	}).addTo(map);

	const place = (lat, lng) => {
		if (marker) marker.setLatLng([lat, lng]);
		else marker = L.marker([lat, lng], { draggable: true }).addTo(map)
			.on('dragend', (e) => {
				const p = e.target.getLatLng();
				place(p.lat, p.lng);
			});

		clearTimeout(timer);
		timer = setTimeout(async () => {
			try {
				onPick(lat, lng, await reverse(lat, lng));
			} catch {
				onPick(lat, lng, null);
			}
		}, DEBOUNCE_MS);
	};

	map.on('click', (e) => place(e.latlng.lat, e.latlng.lng));

	// Brauzer joylashuvni bersa — o'sha yerga yaqinlashtiramiz.
	// Bermasa (rad etilsa yoki HTTPS bo'lmasa) Toshkent markazida qoladi.
	navigator.geolocation?.getCurrentPosition(
		(pos) => {
			const { latitude, longitude } = pos.coords;
			map.setView([latitude, longitude], PIN_ZOOM);
			place(latitude, longitude);
		},
		() => { /* joylashuv berilmadi — standart ko'rinish qoladi */ },
		{ timeout: 5000 }
	);

	// Modal ochilganda konteyner o'lchami hali 0 bo'lishi mumkin —
	// Leaflet o'lchamni qayta hisoblashi kerak
	setTimeout(() => map.invalidateSize(), 100);

	return map;
}

export function destroyMap() {
	clearTimeout(timer);
	map?.remove();
	map = null;
	marker = null;
}
