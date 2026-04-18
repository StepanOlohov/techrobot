/**
 * TECHROBOT — Модуль поиска
 * Живой поиск по статьям, новостям и роботам с подсветкой совпадений
 */

'use strict';

/* =============================================
   Состояние поиска
   ============================================= */
let allArticles = [];   // Кэш статей
let allNews     = [];   // Кэш новостей
let allRobots   = [];   // Кэш роботов
let dataLoaded  = false; // Флаг загруженности данных

/* =============================================
   Загрузка данных для поиска
   ============================================= */

/**
 * Загружает все данные для поиска
 * @returns {Promise<void>}
 */
async function loadSearchData() {
  if (dataLoaded) return;
  try {
    const [articles, news, robots] = await Promise.all([
      fetch('data/articles.json').then(r => r.json()),
      fetch('data/news.json').then(r => r.json()),
      fetch('data/robots.json').then(r => r.json())
    ]);
    allArticles = articles || [];
    allNews     = news     || [];
    allRobots   = robots   || [];
    dataLoaded  = true;
  } catch (err) {
    console.error('Ошибка загрузки данных поиска:', err);
  }
}

/* =============================================
   Алгоритм поиска
   ============================================= */

/**
 * Ищет совпадения в строке (без учёта регистра)
 * @param {string} text - текст для поиска
 * @param {string} query - поисковый запрос
 * @returns {boolean} - найдено ли совпадение
 */
function matchesQuery(text, query) {
  if (!text || !query) return false;
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Выполняет поиск по всем источникам данных
 * @param {string} query - поисковый запрос (не менее 2 символов)
 * @returns {{ articles: Array, news: Array, robots: Array }}
 */
function performSearch(query) {
  if (!query || query.trim().length < 2) {
    return { articles: [], news: [], robots: [] };
  }

  const q = query.trim();

  // Поиск по статьям (заголовок, превью, теги, категория, автор)
  const articles = allArticles.filter(a =>
    matchesQuery(a.title, q) ||
    matchesQuery(a.preview, q) ||
    matchesQuery(a.categoryLabel, q) ||
    matchesQuery(a.author, q) ||
    (a.tags || []).some(tag => matchesQuery(tag, q))
  );

  // Поиск по новостям (заголовок, превью, теги)
  const news = allNews.filter(n =>
    matchesQuery(n.title, q) ||
    matchesQuery(n.preview, q) ||
    matchesQuery(n.categoryLabel, q) ||
    (n.tags || []).some(tag => matchesQuery(tag, q))
  );

  // Поиск по роботам (имя, производитель, назначение, теги)
  const robots = allRobots.filter(r =>
    matchesQuery(r.name, q) ||
    matchesQuery(r.manufacturer, q) ||
    matchesQuery(r.purpose, q) ||
    matchesQuery(r.typeLabel, q) ||
    matchesQuery(r.description, q) ||
    (r.tags || []).some(tag => matchesQuery(tag, q))
  );

  return { articles, news, robots };
}

/* =============================================
   Рендеринг результатов поиска
   ============================================= */

/**
 * Рендерит результаты поиска в указанный контейнер
 * @param {HTMLElement} container - DOM-элемент для вывода
 * @param {Object} results - результаты поиска
 * @param {string} query - поисковый запрос (для подсветки)
 */
function renderSearchResults(container, results, query) {
  const { articles, news, robots } = results;
  const total = articles.length + news.length + robots.length;

  if (total === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">Ничего не найдено</div>
        <div class="empty-state-text">
          По запросу «${AppUtils.escapeHtml(query)}» ничего не нашлось.<br>
          Попробуйте другие ключевые слова.
        </div>
      </div>
    `;
    return;
  }

  let html = `<div class="search-results-count">
    Найдено результатов: <strong>${total}</strong> по запросу «<em>${AppUtils.escapeHtml(query)}</em>»
  </div>`;

  // --- Статьи ---
  if (articles.length > 0) {
    html += `
      <div class="search-section">
        <h3 class="search-section-title">
          📝 Статьи <span class="search-count-badge">${articles.length}</span>
        </h3>
        <div class="search-results-list">
          ${articles.map(a => renderArticleResult(a, query)).join('')}
        </div>
      </div>
    `;
  }

  // --- Новости ---
  if (news.length > 0) {
    html += `
      <div class="search-section">
        <h3 class="search-section-title">
          📰 Новости <span class="search-count-badge">${news.length}</span>
        </h3>
        <div class="search-results-list">
          ${news.map(n => renderNewsResult(n, query)).join('')}
        </div>
      </div>
    `;
  }

  // --- Роботы ---
  if (robots.length > 0) {
    html += `
      <div class="search-section">
        <h3 class="search-section-title">
          🤖 Роботы <span class="search-count-badge">${robots.length}</span>
        </h3>
        <div class="search-results-list">
          ${robots.map(r => renderRobotResult(r, query)).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

/**
 * Генерирует HTML для одного результата-статьи
 */
function renderArticleResult(article, query) {
  const badgeClass = AppUtils.getCategoryBadgeClass(article.category);
  const title   = AppUtils.highlightText(article.title, query);
  const preview = AppUtils.highlightText(article.preview, query);
  const date    = AppUtils.formatDate(article.date);

  return `
    <a href="article.html?id=${article.id}" class="search-result-item">
      <div class="search-result-icon article-img-${article.category}">
        ${AppUtils.getCategoryIcon(article.category)}
      </div>
      <div class="search-result-body">
        <div class="search-result-meta">
          <span class="badge ${badgeClass}">${article.categoryLabel}</span>
          <span class="search-result-date">${date}</span>
        </div>
        <div class="search-result-title">${title}</div>
        <div class="search-result-preview">${preview}</div>
      </div>
    </a>
  `;
}

/**
 * Генерирует HTML для одного результата-новости
 */
function renderNewsResult(news, query) {
  const badgeClass = AppUtils.getCategoryBadgeClass(news.category);
  const title   = AppUtils.highlightText(news.title, query);
  const preview = AppUtils.highlightText(news.preview, query);
  const date    = AppUtils.formatDate(news.date);

  return `
    <div class="search-result-item">
      <div class="search-result-icon" style="background:var(--bg-card);font-size:1.5rem;display:flex;align-items:center;justify-content:center;">📰</div>
      <div class="search-result-body">
        <div class="search-result-meta">
          <span class="badge ${badgeClass}">${news.categoryLabel}</span>
          <span class="search-result-date">${date}</span>
        </div>
        <div class="search-result-title">${title}</div>
        <div class="search-result-preview">${preview}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.25rem;">Источник: ${AppUtils.escapeHtml(news.source || '')}</div>
      </div>
    </div>
  `;
}

/**
 * Генерирует HTML для одного результата-робота
 */
function renderRobotResult(robot, query) {
  const name    = AppUtils.highlightText(robot.name, query);
  const purpose = AppUtils.highlightText(robot.purpose, query);

  return `
    <a href="robots.html?id=${robot.id}" class="search-result-item">
      <div class="search-result-icon" style="background:var(--secondary-glow);font-size:1.5rem;display:flex;align-items:center;justify-content:center;">🤖</div>
      <div class="search-result-body">
        <div class="search-result-meta">
          <span class="badge badge-robotics">${AppUtils.escapeHtml(robot.typeLabel)}</span>
          <span class="search-result-date">${AppUtils.escapeHtml(robot.manufacturer)}, ${robot.year}</span>
        </div>
        <div class="search-result-title">${name}</div>
        <div class="search-result-preview">${purpose}</div>
        <div style="font-size:0.85rem;font-weight:600;color:var(--primary);margin-top:0.25rem;">${AppUtils.escapeHtml(robot.price)}</div>
      </div>
    </a>
  `;
}

/* =============================================
   Живой поиск (inline dropdown для шапки)
   ============================================= */

/**
 * Инициализирует живой поиск в поисковой строке страницы поиска
 */
async function initLiveSearch() {
  const searchInput = document.getElementById('searchInput');
  const resultsContainer = document.getElementById('searchResults');
  const statsEl = document.getElementById('searchStats');

  if (!searchInput || !resultsContainer) return;

  // Загружаем данные при инициализации
  showLoadingInContainer(resultsContainer);
  await loadSearchData();

  // Проверяем, есть ли параметр q в URL
  const urlQuery = AppUtils.getUrlParam('q');
  if (urlQuery) {
    searchInput.value = urlQuery;
    doSearch(urlQuery, resultsContainer, statsEl);
  } else {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">Введите поисковый запрос</div>
        <div class="empty-state-text">Поиск ведётся по статьям, новостям и каталогу роботов</div>
      </div>
    `;
  }

  // Дебаунс обработчик ввода
  const debouncedSearch = AppUtils.debounce((query) => {
    doSearch(query, resultsContainer, statsEl);
    // Обновляем URL без перезагрузки страницы
    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set('q', query);
    } else {
      url.searchParams.delete('q');
    }
    history.replaceState({}, '', url);
  }, 300);

  searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value.trim());
  });

  // Фокус на поле при загрузке страницы
  searchInput.focus();
}

/**
 * Выполняет поиск и обновляет интерфейс
 */
function doSearch(query, container, statsEl) {
  if (!query || query.length < 2) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">Введите поисковый запрос</div>
        <div class="empty-state-text">Минимум 2 символа для начала поиска</div>
      </div>
    `;
    if (statsEl) statsEl.textContent = '';
    return;
  }

  const results = performSearch(query);
  const total = results.articles.length + results.news.length + results.robots.length;

  if (statsEl) {
    statsEl.textContent = total > 0
      ? `Найдено: ${total} результат${getNumEnding(total, ['', 'а', 'ов'])}`
      : 'Ничего не найдено';
  }

  renderSearchResults(container, results, query);
}

/**
 * Показывает спиннер в контейнере
 */
function showLoadingInContainer(container) {
  container.innerHTML = `
    <div class="loading-block">
      <div class="spinner"></div>
      <p>Загрузка данных...</p>
    </div>
  `;
}

/**
 * Возвращает правильное окончание для числительных
 * @param {number} n - число
 * @param {string[]} endings - массив окончаний ['', 'а', 'ов']
 */
function getNumEnding(n, endings) {
  const abs = Math.abs(n);
  if (abs % 100 >= 11 && abs % 100 <= 19) return endings[2];
  if (abs % 10 === 1) return endings[0];
  if (abs % 10 >= 2 && abs % 10 <= 4) return endings[1];
  return endings[2];
}

/* =============================================
   Инициализация при загрузке DOM
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Инициализируем поиск только на странице search.html
  if (document.getElementById('searchInput')) {
    initLiveSearch();
  }
});

/* =============================================
   Экспорт
   ============================================= */
window.SearchModule = {
  loadSearchData,
  performSearch,
  renderSearchResults
};
