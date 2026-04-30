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
          <div class="header-logo-icon" aria-hidden="true">⚡</div>
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
              <a href="https://github.com/StepanOlohov" class="social-link" target="_blank" rel="noopener noreferrer" title="GitHub" aria-label="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
              </a>
              <a href="mailto:tiriiir886@gmail.com" class="social-link" title="Email" aria-label="Email">
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
