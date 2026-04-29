/**
 * TECHROBOT — Скрипт страницы статей
 * Загрузка, фильтрация, сортировка и поиск статей
 */

'use strict';

let allArticles = [];          // Все загруженные статьи
let filteredArticles = [];     // Отфильтрованные статьи
let currentCategory = 'all';  // Текущий фильтр категории
let currentSort = 'date-desc'; // Текущая сортировка

document.addEventListener('DOMContentLoaded', async () => {
  await loadArticles();

  // Инициализируем фильтры
  initFilters();
  initSearch();
  initSort();

  // Проверяем URL-параметр категории
  const urlCategory = AppUtils.getUrlParam('category');
  if (urlCategory) {
    setActiveFilter(urlCategory);
  }
});

/* =============================================
   Загрузка данных
   ============================================= */
async function loadArticles() {
  AppUtils.showLoading('articlesGrid');
  try {
    allArticles = await AppUtils.fetchData('data/articles.json');
    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
    filteredArticles = [...allArticles];
    renderArticles();
  } catch (err) {
    AppUtils.showError('articlesGrid', 'Не удалось загрузить статьи. Попробуйте обновить страницу.');
  }
}

/* =============================================
   Рендеринг статей
   ============================================= */
function renderArticles() {
  const container = document.getElementById('articlesGrid');
  const countEl = document.getElementById('articlesCount');
  if (!container) return;

  if (filteredArticles.length === 0) {
    AppUtils.showEmpty('articlesGrid', '📝', 'Статей не найдено', 'Попробуйте изменить фильтры или поисковый запрос');
    if (countEl) countEl.textContent = '0 статей';
    return;
  }

  if (countEl) {
    countEl.textContent = `${filteredArticles.length} ${getArticleEnding(filteredArticles.length)}`;
  }

  container.innerHTML = filteredArticles.map(article => buildArticleCard(article)).join('');
  AppUtils.initScrollAnimations();
}

function getArticleEnding(n) {
  if (n % 100 >= 11 && n % 100 <= 19) return 'статей';
  if (n % 10 === 1) return 'статья';
  if (n % 10 >= 2 && n % 10 <= 4) return 'статьи';
  return 'статей';
}

function buildArticleCard(article) {
  const badgeClass = AppUtils.getCategoryBadgeClass(article.category);
  const icon = AppUtils.getCategoryIcon(article.category);
  const date = AppUtils.formatDate(article.date);
  const isFav = typeof isFavorite === 'function' ? isFavorite(article.id) : false;

  const imgHtml = article.image
    ? `<img src="${AppUtils.escapeHtml(article.image)}" alt="${AppUtils.escapeHtml(article.title)}" class="article-card-img" loading="lazy" onerror="this.outerHTML='<div class=\\'article-img-placeholder article-img-${article.category}\\'><span style=\\'font-size:3rem;\\'>${icon}</span></div>'">`
    : `<div class="article-img-placeholder article-img-${article.category}"><span style="font-size:3rem;">${icon}</span></div>`;

  return `
    <article class="article-card fade-in" aria-label="${AppUtils.escapeHtml(article.title)}">
      <a href="article.html?id=${article.id}" tabindex="-1" aria-hidden="true">
        ${imgHtml}
      </a>
      <div class="article-card-body">
        <div class="article-card-meta">
          <span class="badge ${badgeClass}">${AppUtils.escapeHtml(article.categoryLabel)}</span>
          <span style="font-size:0.78rem;color:var(--text-muted);">⏱ ${article.readTime} мин</span>
        </div>
        <a href="article.html?id=${article.id}">
          <h3 class="article-card-title">${AppUtils.escapeHtml(article.title)}</h3>
        </a>
        <p class="article-card-preview">${AppUtils.escapeHtml(article.preview)}</p>
        <div class="article-card-footer">
          <div class="article-card-info">
            <span>📅 ${date}</span>
            <span>👁 ${AppUtils.formatNumber(article.views)}</span>
          </div>
          <button class="favorite-btn ${isFav ? 'active' : ''}"
            onclick="handleFavClick(event, ${article.id}, this)"
            title="В избранное" aria-label="Добавить в избранное">
            ${isFav ? '❤️' : '🤍'}
          </button>
        </div>
      </div>
    </article>
  `;
}

/* =============================================
   Фильтрация по категориям
   ============================================= */
function initFilters() {
  document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;
      setActiveFilter(category);
    });
  });
}

function setActiveFilter(category) {
  currentCategory = category;

  // Обновляем активный класс кнопок
  document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  applyFilters();
}

/* =============================================
   Поиск
   ============================================= */
function initSearch() {
  const searchInput = document.getElementById('articlesSearch');
  if (!searchInput) return;

  const debouncedSearch = AppUtils.debounce(() => applyFilters(), 300);
  searchInput.addEventListener('input', debouncedSearch);
}

/* =============================================
   Сортировка
   ============================================= */
function initSort() {
  const sortSelect = document.getElementById('articlesSort');
  if (!sortSelect) return;

  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    applyFilters();
  });
}

/* =============================================
   Применение всех фильтров
   ============================================= */
function applyFilters() {
  const searchQuery = (document.getElementById('articlesSearch') || {}).value || '';
  const query = searchQuery.toLowerCase().trim();

  // Шаг 1: фильтрация по категории
  let result = currentCategory === 'all'
    ? [...allArticles]
    : allArticles.filter(a => a.category === currentCategory);

  // Шаг 2: фильтрация по поисковому запросу
  if (query.length >= 2) {
    result = result.filter(a =>
      a.title.toLowerCase().includes(query) ||
      a.preview.toLowerCase().includes(query) ||
      (a.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }

  // Шаг 3: сортировка
  result = sortArticles(result, currentSort);

  filteredArticles = result;
  renderArticles();
}

function sortArticles(articles, sortKey) {
  const arr = [...articles];
  switch (sortKey) {
    case 'date-desc': return arr.sort((a, b) => new Date(b.date) - new Date(a.date));
    case 'date-asc':  return arr.sort((a, b) => new Date(a.date) - new Date(b.date));
    case 'views':     return arr.sort((a, b) => (b.views || 0) - (a.views || 0));
    case 'readtime':  return arr.sort((a, b) => (a.readTime || 0) - (b.readTime || 0));
    default:          return arr;
  }
}

/* =============================================
   Кнопка избранного
   ============================================= */
function handleFavClick(event, articleId, btn) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof toggleFavorite !== 'function') {
    AppUtils.showToast('Войдите в аккаунт', 'info');
    return;
  }
  const added = toggleFavorite(articleId);
  if (added !== false) {
    btn.classList.toggle('active', added);
    btn.innerHTML = added ? '❤️' : '🤍';
    AppUtils.showToast(added ? 'Добавлено в избранное' : 'Убрано из избранного', added ? 'success' : 'info');
  }
}

window.handleFavClick = handleFavClick;
