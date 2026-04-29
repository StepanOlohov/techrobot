/**
 * TECHROBOT — Скрипт страницы отдельной статьи
 * Загрузка, отображение статьи, похожие статьи, избранное, история
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const articleId = parseInt(AppUtils.getUrlParam('id'), 10);
  if (!articleId) {
    showArticleError('Статья не найдена');
    return;
  }

  try {
    const articles = await AppUtils.fetchData('data/articles.json');
    const article = articles.find(a => a.id === articleId);

    if (!article) {
      showArticleError('Статья не найдена');
      return;
    }

    // Добавляем в историю просмотров
    if (typeof AuthModule !== 'undefined') {
      AuthModule.addToHistory(articleId);
    }

    renderArticle(article);
    renderRelated(article, articles);
    initFavoriteBtn(article.id);
  } catch (err) {
    showArticleError('Не удалось загрузить статью');
  }
});

/* =============================================
   Рендеринг статьи
   ============================================= */
function renderArticle(article) {
  // Заголовок вкладки браузера
  document.title = `${article.title} — TechRobot`;

  // Хлебные крошки
  const breadcrumb = document.getElementById('articleBreadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = `
      <a href="index.html">Главная</a>
      <span class="breadcrumb-sep">›</span>
      <a href="articles.html">Статьи</a>
      <span class="breadcrumb-sep">›</span>
      <a href="articles.html?category=${article.category}">${AppUtils.escapeHtml(article.categoryLabel)}</a>
      <span class="breadcrumb-sep">›</span>
      <span>${AppUtils.escapeHtml(article.title)}</span>
    `;
  }

  // Большое изображение шапки статьи (с fallback на emoji-плейсхолдер)
  const imgContainer = document.getElementById('articleHeroImg');
  if (imgContainer) {
    const fallback = `<div class="article-img-placeholder article-img-${article.category}" style="aspect-ratio:21/9;border-radius:var(--radius-xl);"><span style="font-size:6rem;">${AppUtils.getCategoryIcon(article.category)}</span></div>`;

    if (article.image) {
      imgContainer.innerHTML = `<img src="${AppUtils.escapeHtml(article.image)}" alt="${AppUtils.escapeHtml(article.title)}" style="width:100%;aspect-ratio:21/9;object-fit:cover;border-radius:var(--radius-xl);">`;
      // Если картинка не загрузилась — заменяем на emoji-плейсхолдер
      const imgEl = imgContainer.querySelector('img');
      if (imgEl) imgEl.addEventListener('error', () => { imgContainer.innerHTML = fallback; });
    } else {
      imgContainer.innerHTML = fallback;
    }
  }

  // Категория
  setEl('articleCategory', `<span class="badge ${AppUtils.getCategoryBadgeClass(article.category)}">${AppUtils.escapeHtml(article.categoryLabel)}</span>`);

  // Заголовок
  setTextEl('articleTitle', article.title);

  // Мета-информация
  const metaEl = document.getElementById('articleMeta');
  if (metaEl) {
    metaEl.innerHTML = `
      <span>📅 ${AppUtils.formatDate(article.date)}</span>
      <span>⏱ ${article.readTime} мин. чтения</span>
    `;
  }

  // Содержание статьи
  const contentEl = document.getElementById('articleContent');
  if (contentEl) {
    // Контент хранится как HTML-строка в JSON
    // ВНИМАНИЕ: В продакшене необходима санитизация (DOMPurify)
    contentEl.innerHTML = article.content || '';
    // Стилизуем вложенные теги
    styleArticleContent(contentEl);
  }

  // Теги
  const tagsEl = document.getElementById('articleTags');
  if (tagsEl && article.tags) {
    tagsEl.innerHTML = article.tags.map(tag =>
      `<a href="search.html?q=${encodeURIComponent(tag)}" class="tag">#${AppUtils.escapeHtml(tag)}</a>`
    ).join('');
  }
}

/**
 * Применяет дополнительные стили к содержимому статьи
 */
function styleArticleContent(container) {
  // Стилизуем h2
  container.querySelectorAll('h2').forEach(h => {
    h.style.cssText = 'font-size:1.5rem;font-weight:800;color:var(--text-primary);margin:2rem 0 1rem;padding-top:1.5rem;border-top:1px solid var(--border);';
  });
  // Стилизуем параграфы
  container.querySelectorAll('p').forEach(p => {
    p.style.cssText = 'line-height:1.8;color:var(--text-secondary);margin-bottom:1.2rem;font-size:1rem;';
  });
  // Стилизуем списки
  container.querySelectorAll('ul, ol').forEach(list => {
    list.style.cssText = 'padding-left:1.5rem;margin-bottom:1.2rem;';
    list.querySelectorAll('li').forEach(li => {
      li.style.cssText = 'color:var(--text-secondary);margin-bottom:0.4rem;line-height:1.6;';
    });
  });
}

/* =============================================
   Рендеринг похожих статей
   ============================================= */
function renderRelated(current, allArticles) {
  const container = document.getElementById('relatedArticles');
  if (!container) return;

  // Похожие — статьи той же категории, кроме текущей
  const related = allArticles
    .filter(a => a.id !== current.id && a.category === current.category)
    .slice(0, 3);

  if (related.length === 0) {
    container.closest('section') && (container.closest('section').style.display = 'none');
    return;
  }

  container.innerHTML = related.map(a => {
    const badgeClass = AppUtils.getCategoryBadgeClass(a.category);
    const icon = AppUtils.getCategoryIcon(a.category);
    const imgHtml = a.image
      ? `<img src="${AppUtils.escapeHtml(a.image)}" alt="${AppUtils.escapeHtml(a.title)}" class="article-card-img" loading="lazy" onerror="this.outerHTML='<div class=\\'article-img-placeholder article-img-${a.category}\\'><span style=\\'font-size:2.5rem;\\'>${icon}</span></div>'">`
      : `<div class="article-img-placeholder article-img-${a.category}"><span style="font-size:2.5rem;">${icon}</span></div>`;
    return `
      <a href="article.html?id=${a.id}" class="article-card" style="text-decoration:none;">
        ${imgHtml}
        <div class="article-card-body">
          <div class="article-card-meta">
            <span class="badge ${badgeClass}">${AppUtils.escapeHtml(a.categoryLabel)}</span>
          </div>
          <h4 class="article-card-title">${AppUtils.escapeHtml(a.title)}</h4>
          <p class="article-card-preview">${AppUtils.escapeHtml(a.preview)}</p>
        </div>
      </a>
    `;
  }).join('');
}

/* =============================================
   Кнопка "В избранное"
   ============================================= */
function initFavoriteBtn(articleId) {
  const btn = document.getElementById('favBtn');
  if (!btn) return;

  const updateBtn = () => {
    const isFav = typeof isFavorite === 'function' ? isFavorite(articleId) : false;
    btn.innerHTML = isFav
      ? '<span>❤️</span> В избранном'
      : '<span>🤍</span> В избранное';
    btn.classList.toggle('active', isFav);
  };

  updateBtn();

  btn.addEventListener('click', () => {
    if (typeof toggleFavorite !== 'function') {
      AppUtils.showToast('Войдите в аккаунт, чтобы добавить в избранное', 'info');
      if (typeof openAuthModal === 'function') openAuthModal('login');
      return;
    }
    const added = toggleFavorite(articleId);
    updateBtn();
    AppUtils.showToast(
      added ? 'Добавлено в избранное' : 'Убрано из избранного',
      added ? 'success' : 'info'
    );
  });
}

/* =============================================
   Вспомогательные функции
   ============================================= */
function setEl(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setTextEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showArticleError(message) {
  const main = document.getElementById('articleMain');
  if (main) {
    main.innerHTML = `
      <div class="container section">
        <div class="empty-state">
          <div class="empty-state-icon">😔</div>
          <div class="empty-state-title">${message}</div>
          <a href="articles.html" class="btn btn-primary">← Вернуться к статьям</a>
        </div>
      </div>
    `;
  }
}
