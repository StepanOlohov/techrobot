/**
 * TECHROBOT — Скрипт каталога блога сообщества
 * Загрузка одобренных пользовательских статей с пагинацией и фильтром.
 */

'use strict';

const BLOG_LIMIT = 12;

let currentCategory = 'all';
let currentPage = 1;

document.addEventListener('DOMContentLoaded', () => {
  // Кнопка «Написать статью» — только для авторизованных
  if (typeof getCurrentUser === 'function' && getCurrentUser()) {
    const btn = document.getElementById('writeBtn');
    if (btn) btn.style.display = 'inline-flex';
  }

  initFilters();
  loadPosts();
});

/* =============================================
   Загрузка постов с сервера
   ============================================= */
async function loadPosts() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  AppUtils.showLoading('blogGrid');

  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: BLOG_LIMIT
    });
    if (currentCategory !== 'all') params.set('category', currentCategory);

    const res = await fetch(`/api/blog?${params.toString()}`);
    const data = await res.json();

    if (!data.success) {
      AppUtils.showError('blogGrid', data.message || 'Не удалось загрузить статьи');
      return;
    }

    renderPosts(data.posts);
    renderPagination(data.pagination);
    updateCount(data.pagination.total);
  } catch (err) {
    console.error('Ошибка загрузки блога:', err);
    AppUtils.showError('blogGrid', 'Не удалось загрузить статьи. Проверьте подключение.');
  }
}

/* =============================================
   Рендер карточек
   ============================================= */
function renderPosts(posts) {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  if (!posts || posts.length === 0) {
    AppUtils.showEmpty('blogGrid', '📝', 'Пока нет статей',
      currentCategory === 'all'
        ? 'Будьте первым, кто опубликует статью!'
        : 'В этой категории пока пусто. Попробуйте другую.');
    return;
  }

  grid.innerHTML = posts.map(buildBlogCard).join('');
  AppUtils.initScrollAnimations();
}

function buildBlogCard(post) {
  const badgeClass = AppUtils.getCategoryBadgeClass(post.category);
  const icon       = AppUtils.getCategoryIcon(post.category);
  const date       = AppUtils.formatDate(post.created_at);
  const authorInitial = (post.author_name || '?').charAt(0).toUpperCase();

  // Обложка: либо реальный URL, либо цветной плейсхолдер
  const coverHtml = post.cover_url
    ? `<img src="${AppUtils.escapeHtml(post.cover_url)}" alt="${AppUtils.escapeHtml(post.title)}"
            class="article-card-img" loading="lazy">`
    : `<div class="article-img-placeholder article-img-${post.category}">
         <span style="font-size:3rem;">${icon}</span>
       </div>`;

  // Аватар автора: либо картинка, либо инициал
  const avatarHtml = post.author_avatar
    ? `<img src="${AppUtils.escapeHtml(post.author_avatar)}" alt=""
            class="blog-author-avatar">`
    : `<div class="blog-author-avatar blog-author-avatar--initial">${authorInitial}</div>`;

  return `
    <article class="article-card blog-card fade-in" aria-label="${AppUtils.escapeHtml(post.title)}">
      <a href="blog-post.html?id=${post.id}" tabindex="-1" aria-hidden="true">
        ${coverHtml}
      </a>
      <div class="article-card-body">
        <div class="article-card-meta">
          <span class="badge ${badgeClass}">${getCategoryLabel(post.category)}</span>
        </div>
        <a href="blog-post.html?id=${post.id}">
          <h3 class="article-card-title">${AppUtils.escapeHtml(post.title)}</h3>
        </a>
        <p class="article-card-preview">${AppUtils.escapeHtml(post.excerpt)}</p>
        <div class="blog-card-author">
          ${avatarHtml}
          <div class="blog-author-info">
            <div class="blog-author-name">${AppUtils.escapeHtml(post.author_name)}</div>
            <div class="blog-author-meta">
              <span>📅 ${date}</span>
              <span>👁 ${AppUtils.formatNumber(post.views)}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

/* =============================================
   Метки категорий (без дублирования articles.json)
   ============================================= */
function getCategoryLabel(cat) {
  const labels = {
    ai:       'Искусственный интеллект',
    robotics: 'Робототехника',
    iot:      'Интернет вещей',
    vrar:     'VR/AR',
    biotech:  'Биотехнологии',
    drones:   'Беспилотники'
  };
  return labels[cat] || cat;
}

/* =============================================
   Пагинация
   ============================================= */
function renderPagination({ page, pages }) {
  const container = document.getElementById('pagination');
  if (!container) return;

  if (pages <= 1) {
    container.innerHTML = '';
    return;
  }

  // Простая пагинация: «‹ Назад» 1 2 3 … N «Вперёд ›»
  const parts = [];

  parts.push(`<button ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">← Назад</button>`);

  // Показываем номера: 1, ..., page-1, page, page+1, ..., last
  const nums = new Set([1, pages, page - 1, page, page + 1]);
  const sorted = [...nums].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);

  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) parts.push(`<span style="padding:0 0.25rem;">…</span>`);
    parts.push(`<button class="${n === page ? 'active' : ''}" data-page="${n}">${n}</button>`);
    prev = n;
  }

  parts.push(`<button ${page === pages ? 'disabled' : ''} data-page="${page + 1}">Вперёд →</button>`);
  container.innerHTML = parts.join('');

  container.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.dataset.page, 10);
      if (target && target !== currentPage) {
        currentPage = target;
        loadPosts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });
}

/* =============================================
   Счётчик в шапке
   ============================================= */
function updateCount(total) {
  const el = document.getElementById('blogCount');
  if (!el) return;
  el.textContent = `${total} ${pluralizeArticles(total)}`;
}

function pluralizeArticles(n) {
  if (n % 100 >= 11 && n % 100 <= 19) return 'статей';
  if (n % 10 === 1) return 'статья';
  if (n % 10 >= 2 && n % 10 <= 4) return 'статьи';
  return 'статей';
}

/* =============================================
   Фильтры
   ============================================= */
function initFilters() {
  document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-category]').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
      currentCategory = btn.dataset.category;
      currentPage = 1;
      loadPosts();
    });
  });
}
