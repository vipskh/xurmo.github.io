// Admin sahifalari uchun umumiy qism: kirish tekshiruvi, sarlavha, xabarlar.
// HTML tuzilmasi Node versiyasidagi _head.ejs bilan bir xil — dizayn o'zgarmaydi.
import { currentUser, logout } from './appwrite.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
	({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const money = (n) => Number(n || 0).toLocaleString('ru-RU');

// Kirmagan bo'lsa — kirish sahifasiga yuboradi
export const requireAuth = async () => {
	const user = await currentUser();
	if (!user) {
		location.replace('login.html');
		throw new Error('kirilmagan');
	}
	return user;
};

export const renderHeader = (nav) => {
	document.body.insertAdjacentHTML('afterbegin', `
<header class="admin-header">
	<div class="wrap header-inner">
		<a class="logo" href="./">Menyu <span>admin</span></a>
		<nav class="admin-nav">
			<a href="./" class="${nav === 'products' ? 'is-active' : ''}">Mahsulotlar</a>
			<a href="categories.html" class="${nav === 'categories' ? 'is-active' : ''}">Kategoriyalar</a>
			<a href="../" target="_blank">Saytni ko‘rish ↗</a>
			<button type="button" class="btn btn-ghost" id="logout-btn">Chiqish</button>
		</nav>
	</div>
</header>`);

	document.getElementById('logout-btn').addEventListener('click', async () => {
		await logout().catch(() => {});
		location.replace('login.html');
	});
};

// Yashil/qizil xabar — alert-ok / alert-error
export const showMessage = (text, kind = 'ok') => {
	const el = document.getElementById('msg');
	if (!el) return;
	el.className = `alert alert-${kind}`;
	el.textContent = text;
	el.hidden = false;
	if (kind === 'ok') setTimeout(() => { el.hidden = true; }, 4000);
};

// data-confirm bo'lgan tugmalar uchun tasdiq so'rash
export const confirmAction = (message) => window.confirm(message);
