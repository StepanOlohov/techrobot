/**
 * TECHROBOT — Модуль компонентов (шапка и подвал)
 * Динамически вставляет шапку и подвал на каждую страницу,
 * управляет мобильным меню и состоянием авторизации в навигации.
 */

'use strict';

/* =============================================
   Конфигурация навигации
   ============================================= */
const NAV_ITEMS = [
  { href: 'index.html',       label: 'Главная',   icon: '🏠' },
  { href: 'articles.html',    label: 'Статьи',    icon: '📝' },
  { href: 'news.html',        label: 'Новости',   icon: '📰' },
  { href: 'robots.html',      label: 'Роботы',    icon: '🤖' },
  { href: 'videos.html',      label: 'Видео',     icon: '🎬' },
  { href: 'about.html',       label: 'О нас',     icon: '📌' }
];

/* =============================================
   Генерация HTML шапки
   ============================================= */

/**
 * Создаёт HTML-строку шапки сайта
 * @param {string} currentPage - имя текущего файла страницы (для подсветки активного пункта)
 * @returns {string} - HTML шапки
 */
function buildHeaderHTML(currentPage) {
  // Генерируем пункты навигации
  const navLinks = NAV_ITEMS.map(item => {
    const isActive = item.href === currentPage ? 'active' : '';
    return `<a href="${item.href}" class="nav-link ${isActive}">${item.label}</a>`;
  }).join('');

  // Генерируем пункты мобильного меню
  const mobileLinks = NAV_ITEMS.map(item => {
    const isActive = item.href === currentPage ? 'active' : '';
    return `
      <a href="${item.href}" class="mobile-nav-link ${isActive}">
        <span class="mobile-nav-icon">${item.icon}</span>
        ${item.label}
      </a>
    `;
  }).join('');

  return `
    <header class="header" id="mainHeader">
      <div class="header-inner">
        <!-- Логотип -->
        <a href="index.html" class="header-logo" aria-label="TechRobot — главная">
          <img src="favicon.png" alt="" class="header-logo-icon" aria-hidden="true">
          <span class="header-logo-text">Tech<span>Robot</span></span>
        </a>

        <!-- Основная навигация (скрывается на мобильных) -->
        <nav class="header-nav" aria-label="Основная навигация">
          ${navLinks}
        </nav>

        <!-- Кнопки действий -->
        <div class="header-actions">
          <!-- Кнопка поиска -->
          <a href="search.html" class="header-search-btn" aria-label="Поиск" title="Поиск">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </a>

          <!-- Блок авторизации (заменяется JS) -->
          <div id="headerAuthBlock"></div>

          <!-- Бургер-меню (только мобильные) -->
          <button class="burger-btn" id="burgerBtn" aria-label="Открыть меню" aria-expanded="false">
            <span class="burger-line"></span>
            <span class="burger-line"></span>
            <span class="burger-line"></span>
          </button>
        </div>
      </div>
    </header>

    <!-- Мобильное меню -->
    <nav class="mobile-menu" id="mobileMenu" aria-label="Мобильное меню" aria-hidden="true">
      <div class="mobile-nav">
        ${mobileLinks}
      </div>
      <div id="mobileAuthBlock"></div>
    </nav>
  `;
}

/* =============================================
   Генерация HTML подвала
   ============================================= */

/**
 * Создаёт HTML-строку подвала сайта
 * @returns {string} - HTML подвала
 */
function buildFooterHTML() {
  return `
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <!-- О сайте -->
          <div class="footer-about">
            <div class="footer-about-title">Tech<span>Robot</span></div>
            <p class="footer-about-text">
              Информационный портал о современных технологиях и робототехнике.
              Статьи, новости, каталог роботов и активное сообщество.
            </p>
            <div class="social-links">
              <a href="https://t.me/D3alThug" class="social-link" target="_blank" rel="noopener noreferrer" title="Telegram" aria-label="Telegram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z"/></svg>
              </a>
              <a href="https://vk.com/id353733530" class="social-link" target="_blank" rel="noopener noreferrer" title="ВКонтакте" aria-label="ВКонтакте">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.525-2.049-1.713-1.033-1-1.49-.676-1.49.232v1.566c0 .39-.314.617-.885.617-1.65 0-3.393-.985-4.826-2.768-1.89-2.37-2.4-4.164-2.4-4.525 0-.377.185-.577.61-.577h1.74c.453 0 .622.233.794.69 1.12 2.77 2.82 5.2 3.52 5.2.262 0 .38-.122.38-.79V12.02c-.095-1.37-.818-1.49-.818-1.98 0-.234.193-.484.5-.484h2.74c.388 0 .523.218.523.657v3.519c0 .39.173.52.28.52.26 0 .477-.13 1.12-.78 1.53-1.74 2.64-4.23 2.64-4.23.13-.37.42-.65.88-.65h1.74c.52 0 .64.263.52.65-1.27 2.9-2.15 4.04-2.15 4.04-.19.33-.26.47 0 .83 1.01 1.34 2.04 2.54 2.04 3.16.01.45-.3.66-.8.66z"/></svg>
              </a>
              <a href="https://discord.gg/auST7xbeXW" class="social-link" target="_blank" rel="noopener noreferrer" title="Discord" aria-label="Discord">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.101 18.08.114 18.1.134 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
              </a>
              <a href="mailto:techr0bot@mail.ru" class="social-link" title="Email" aria-label="Email">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12.713l-11.985-9.713h23.97l-11.985 9.713zm0 2.574l-12-9.725v15.438h24v-15.438l-12 9.725z"/></svg>
              </a>
            </div>
          </div>

          <!-- Разделы сайта -->
          <div>
            <div class="footer-nav-title">Разделы</div>
            <ul class="footer-nav-list">
              <li><a href="articles.html">Статьи</a></li>
              <li><a href="news.html">Новости</a></li>
              <li><a href="robots.html">Каталог роботов</a></li>
              <li><a href="videos.html">Видеотека</a></li>
            </ul>
          </div>

          <!-- Категории -->
          <div>
            <div class="footer-nav-title">Категории</div>
            <ul class="footer-nav-list">
              <li><a href="articles.html?category=ai">Искусственный интеллект</a></li>
              <li><a href="articles.html?category=robotics">Робототехника</a></li>
              <li><a href="articles.html?category=iot">Интернет вещей</a></li>
              <li><a href="articles.html?category=vrar">VR / AR</a></li>
              <li><a href="articles.html?category=biotech">Биотехнологии</a></li>
              <li><a href="articles.html?category=drones">Беспилотники</a></li>
            </ul>
          </div>

          <!-- О проекте -->
          <div>
            <div class="footer-nav-title">Информация</div>
            <ul class="footer-nav-list">
              <li><a href="about.html">О нас</a></li>
              <li><a href="about.html#contacts">Контакты</a></li>
              <li><a href="profile.html">Личный кабинет</a></li>
              <li><a href="search.html">Поиск</a></li>
            </ul>
          </div>
        </div>

        <!-- Нижняя панель подвала -->
        <div class="footer-bottom">
          <div class="footer-copyright">
            © 2026 TechRobot. Все права защищены.
          </div>
          <div class="footer-bottom-links">
            <a href="about.html">Политика конфиденциальности</a>
            <a href="about.html">Условия использования</a>
          </div>
        </div>
      </div>
    </footer>
  `;
}

/* =============================================
   Обновление блока авторизации в шапке
   ============================================= */

/**
 * Обновляет кнопку авторизации в шапке согласно текущей сессии
 * Может вызываться повторно после входа/выхода без перезагрузки
 */
function updateHeaderAuth() {
  const authBlock = document.getElementById('headerAuthBlock');
  const mobileAuthBlock = document.getElementById('mobileAuthBlock');
  if (!authBlock) return;

  // Проверяем авторизацию через модуль auth.js
  const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;

  if (user) {
    // Пользователь авторизован — показываем ссылку на профиль
    const initials = user.name ? user.name.charAt(0).toUpperCase() : '?';
    const avatarContent = user.avatar
      ? `<img src="${user.avatar}" alt="${user.name}">`
      : initials;

    authBlock.innerHTML = `
      <a href="profile.html" class="header-user" title="Перейти в профиль">
        <div class="header-user-avatar">${avatarContent}</div>
        <span class="header-user-name">${user.name}</span>
      </a>
    `;

    if (mobileAuthBlock) {
      mobileAuthBlock.innerHTML = `
        <div style="border-top:1px solid var(--border);padding-top:1.5rem;margin-top:0.5rem;">
          <a href="profile.html" class="mobile-nav-link" style="margin-bottom:0.5rem;">
            <span class="mobile-nav-icon">👤</span> ${user.name}
          </a>
          <button onclick="AuthModule.logout()" class="btn btn-ghost" style="width:100%;justify-content:flex-start;gap:0.5rem;">
            <span>🚪</span> Выйти
          </button>
        </div>
      `;
    }
  } else {
    // Пользователь не авторизован — показываем кнопку входа
    authBlock.innerHTML = `
      <button class="header-auth-btn" onclick="openAuthModal('login')" aria-label="Войти в аккаунт">
        👤 Войти
      </button>
    `;

    if (mobileAuthBlock) {
      mobileAuthBlock.innerHTML = `
        <div style="border-top:1px solid var(--border);padding-top:1.5rem;margin-top:0.5rem;display:flex;flex-direction:column;gap:0.5rem;">
          <button onclick="openAuthModal('login')" class="btn btn-primary" style="width:100%;">Войти</button>
          <button onclick="openAuthModal('register')" class="btn btn-secondary" style="width:100%;">Регистрация</button>
        </div>
      `;
    }
  }
}

/* =============================================
   Инициализация мобильного меню
   ============================================= */

/**
 * Инициализирует бургер-меню для мобильных устройств
 */
function initMobileMenu() {
  const burgerBtn  = document.getElementById('burgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (!burgerBtn || !mobileMenu) return;

  burgerBtn.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    burgerBtn.classList.toggle('open', isOpen);
    burgerBtn.setAttribute('aria-expanded', String(isOpen));
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));
    // Блокируем прокрутку страницы при открытом меню
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Закрываем меню при клике на ссылку
  mobileMenu.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      burgerBtn.classList.remove('open');
      burgerBtn.setAttribute('aria-expanded', 'false');
      mobileMenu.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    });
  });
}

/* =============================================
   Инициализация шапки (скролл)
   ============================================= */

/**
 * Добавляет класс при прокрутке для изменения вида шапки
 */
function initHeaderScroll() {
  const header = document.getElementById('mainHeader');
  if (!header) return;

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* =============================================
   Главная функция инициализации компонентов
   ============================================= */

/**
 * Вставляет шапку и подвал на страницу, инициализирует навигацию
 * Вызывается при загрузке каждой страницы
 */
function initComponents() {
  // Определяем текущую страницу по имени файла
  const pathParts = window.location.pathname.split('/');
  const currentPage = pathParts[pathParts.length - 1] || 'index.html';

  // Вставляем шапку
  const headerPlaceholder = document.getElementById('header-placeholder');
  if (headerPlaceholder) {
    headerPlaceholder.outerHTML = buildHeaderHTML(currentPage);
  }

  // Вставляем подвал
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    footerPlaceholder.outerHTML = buildFooterHTML();
  }

  // Дополнительно добавляем отступ сверху, компенсируя фиксированную шапку
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.style.paddingTop = '70px';
  }

  // Обновляем блок авторизации
  updateHeaderAuth();

  // Инициализируем мобильное меню
  initMobileMenu();

  // Инициализируем поведение при скролле
  initHeaderScroll();
}

/* =============================================
   Автоматическая инициализация при загрузке DOM
   ============================================= */
document.addEventListener('DOMContentLoaded', initComponents);

// Делаем updateHeaderAuth доступной глобально (вызывается из auth.js)
window.updateHeaderAuth = updateHeaderAuth;
