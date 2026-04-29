/**
 * TECHROBOT — Скрипт главной страницы
 * Загружает и отображает: последние статьи, новости, счётчики, категории
 */

'use strict';

/* =============================================
   Инициализация главной страницы
   ============================================= */
document.addEventListener('DOMContentLoaded', async () => {
  // Запускаем загрузку всех данных параллельно
  await Promise.all([
    loadFeaturedArticles(),
    loadLatestNews(),
    animateCounters()
  ]);
});

/* =============================================
   Загрузка избранных статей
   ============================================= */
async function loadFeaturedArticles() {
  const container = document.getElementById('featuredArticles');
  if (!container) return;

  try {
    const articles = await AppUtils.fetchData('data/articles.json');
    // Сортируем по дате (новые сверху)
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));
    // Берём первые 3 статьи (featured или просто первые)
    const featured = articles
      .filter(a => a.featured)
      .slice(0, 3);
    const display = featured.length >= 3 ? featured : articles.slice(0, 3);

    container.innerHTML = display.map(article => buildArticleCard(article)).join('');
    // Инициализируем анимации после рендера
    AppUtils.initScrollAnimations();
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Не удалось загрузить статьи</div></div>`;
  }
}

/**
 * Генерирует HTML карточки статьи для главной страницы
 */
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
            onclick="handleFavorite(event, ${article.id}, this)"
            title="${isFav ? 'Убрать из избранного' : 'Добавить в избранное'}"
            aria-label="${isFav ? 'Убрать из избранного' : 'Добавить в избранное'}">
            ${isFav ? '❤️' : '🤍'}
          </button>
        </div>
      </div>
    </article>
  `;
}

/* =============================================
   Загрузка последних новостей
   ============================================= */
async function loadLatestNews() {
  const container = document.getElementById('latestNews');
  if (!container) return;

  try {
    const news = await AppUtils.fetchData('data/news.json');
    // Сортируем по дате (новые сверху), берём первые 5
    news.sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = news.slice(0, 5);
    container.innerHTML = latest.map(item => buildNewsItem(item)).join('');
    AppUtils.initScrollAnimations();
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Не удалось загрузить новости</div></div>`;
  }
}

/**
 * Генерирует HTML элемента новости для главной страницы
 */
function buildNewsItem(item) {
  const { day, month } = AppUtils.formatDateShort(item.date);
  const badgeClass = AppUtils.getCategoryBadgeClass(item.category);

  return `
    <div class="news-item fade-in">
      <div class="news-date-block">
        <span class="news-day">${day}</span>
        <span class="news-month">${month}</span>
      </div>
      <div class="news-content">
        <div class="news-item-meta" style="margin-bottom:0.35rem;">
          <span class="badge ${badgeClass}" style="font-size:0.72rem;">${AppUtils.escapeHtml(item.categoryLabel)}</span>
        </div>
        <h4 class="news-item-title">${AppUtils.escapeHtml(item.title)}</h4>
        <p class="news-item-preview">${AppUtils.escapeHtml(item.preview)}</p>
      </div>
    </div>
  `;
}

/* =============================================
   Анимация счётчиков
   ============================================= */

/**
 * Анимирует числовые счётчики в секции статистики (hero)
 */
function animateCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (counters.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-counter'), 10);
        const duration = 1500; // мс
        const step = target / (duration / 16);
        let current = 0;

        const timer = setInterval(() => {
          current += step;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          // Форматируем с суффиксом
          const suffix = el.getAttribute('data-suffix') || '';
          el.textContent = Math.floor(current) + suffix;
        }, 16);

        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
}

/* =============================================
   Обработчик кнопки "В избранное"
   ============================================= */

/**
 * Обрабатывает клик по кнопке добавления в избранное
 * @param {Event} event - событие клика
 * @param {number} articleId - ID статьи
 * @param {HTMLElement} btn - кнопка
 */
function handleFavorite(event, articleId, btn) {
  event.preventDefault();
  event.stopPropagation();

  // Проверяем авторизацию ДО вызова toggleFavorite —
  // иначе невозможно отличить "не залогинен" от "убрано из избранного".
  if (typeof getCurrentUser !== 'function' || !getCurrentUser()) {
    AppUtils.showToast('Войдите в аккаунт', 'info');
    return;
  }

  const added = toggleFavorite(articleId);
  btn.classList.toggle('active', added);
  btn.innerHTML = added ? '❤️' : '🤍';
  btn.title = added ? 'Убрать из избранного' : 'Добавить в избранное';
  AppUtils.showToast(
    added ? 'Добавлено в избранное' : 'Убрано из избранного',
    added ? 'success' : 'info'
  );
}

// Делаем handleFavorite глобальной (вызывается из onclick)
window.handleFavorite = handleFavorite;
