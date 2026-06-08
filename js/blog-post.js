/**
 * TECHROBOT — Скрипт страницы одной статьи блога
 *
 * Логика доступа:
 *  - approved: видна всем, счётчик views инкрементится на сервере
 *  - pending:  видна только автору и админу
 *  - rejected: видна только автору (с причиной отклонения) и админу
 *
 * Безопасность: HTML-контент санитизируется через DOMPurify перед вставкой.
 */

'use strict';

const ALLOWED_TAGS = ['p', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 'a',
                      'ul', 'ol', 'li', 'img', 'code', 'pre', 'blockquote', 'br'];
const ALLOWED_ATTRS = ['href', 'src', 'alt', 'class'];

document.addEventListener('DOMContentLoaded', loadPost);

async function loadPost() {
  const id = parseInt(AppUtils.getUrlParam('id'), 10);
  if (!id) {
    renderError('Не указан ID статьи');
    return;
  }

  try {
    // Передаём токен (если есть) — иначе сервер вернёт 404 для pending/rejected
    const headers = {};
    const token = localStorage.getItem('tr_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/blog/${id}`, { headers });
    const data = await res.json();

    if (!data.success) {
      renderError(data.message || 'Статья не найдена');
      return;
    }

    renderPost(data.post);
  } catch (err) {
    console.error('Ошибка загрузки статьи:', err);
    renderError('Не удалось загрузить статью');
  }
}

/* =============================================
   Рендер
   ============================================= */
function renderPost(post) {
  const container = document.getElementById('postContainer');
  if (!container) return;

  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const isAuthor    = currentUser && currentUser.id === post.user_id;
  const isAdmin     = currentUser && currentUser.isAdmin;

  const badgeClass    = AppUtils.getCategoryBadgeClass(post.category);
  const icon          = AppUtils.getCategoryIcon(post.category);
  const date          = AppUtils.formatDate(post.created_at);
  const authorInitial = (post.author_name || '?').charAt(0).toUpperCase();

  // Обложка
  const coverHtml = post.cover_url
    ? `<img src="${AppUtils.escapeHtml(post.cover_url)}" alt="${AppUtils.escapeHtml(post.title)}" class="post-cover">`
    : `<div class="post-cover-placeholder article-img-${post.category}">${icon}</div>`;

  // Баннер статуса (виден только автору)
  let banner = '';
  if (isAuthor && post.status === 'pending') {
    banner = `
      <div class="status-banner status-banner--pending">
        <span class="status-banner__icon">⏳</span>
        <div>
          <div class="status-banner__title">На модерации</div>
          <div class="status-banner__text">Ваша статья отправлена администратору. После одобрения она станет видна всем.</div>
        </div>
      </div>`;
  } else if (isAuthor && post.status === 'rejected') {
    banner = `
      <div class="status-banner status-banner--rejected">
        <span class="status-banner__icon">❌</span>
        <div>
          <div class="status-banner__title">Статья отклонена</div>
          <div class="status-banner__text">
            <strong>Причина:</strong> ${AppUtils.escapeHtml(post.rejection_reason || 'не указана')}.
            Вы можете отредактировать статью и отправить повторно.
          </div>
        </div>
      </div>`;
  }

  // Аватар автора
  const avatarHtml = post.author_avatar
    ? `<img src="${AppUtils.escapeHtml(post.author_avatar)}" alt="" class="blog-author-avatar">`
    : `<div class="blog-author-avatar blog-author-avatar--initial">${authorInitial}</div>`;

  // Кнопки управления (для автора или админа)
  let actions = '';
  if (isAuthor || isAdmin) {
    const editBtn = (isAuthor && post.status !== 'approved')
      ? `<a href="blog-editor.html?id=${post.id}" class="btn btn-secondary">✏️ Редактировать</a>`
      : '';
    actions = `
      <div class="post-actions">
        ${editBtn}
        <button class="btn btn-ghost" id="deleteBtn" style="color:#ff2d78;border-color:rgba(255,45,120,0.3);">
          🗑 Удалить
        </button>
      </div>`;
  }

  container.innerHTML = `
    <div class="post-wrapper">
      ${banner}
      ${coverHtml}
      <div>
        <span class="badge ${badgeClass}">${getCategoryLabel(post.category)}</span>
      </div>
      <h1 class="post-title">${AppUtils.escapeHtml(post.title)}</h1>
      <div class="post-meta-bar">
        <div class="post-author-block">
          ${avatarHtml}
          <span>${AppUtils.escapeHtml(post.author_name)}</span>
        </div>
        <span>📅 ${date}</span>
        ${post.status === 'approved' ? `<span>👁 ${AppUtils.formatNumber(post.views)} просмотров</span>` : ''}
      </div>
      <div class="post-content" id="postContent"></div>
      ${actions}
    </div>
  `;

  // Вставляем санитизированный HTML через DOMPurify (двойная защита)
  const contentEl = document.getElementById('postContent');
  if (contentEl) {
    const clean = (typeof DOMPurify !== 'undefined')
      ? DOMPurify.sanitize(post.content, {
          ALLOWED_TAGS: ALLOWED_TAGS,
          ALLOWED_ATTR: ALLOWED_ATTRS,
          ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:)/i
        })
      : post.content; // fallback — сервер уже санитизировал
    contentEl.innerHTML = clean;
  }

  // Заголовок в хлебных крошках и <title>
  const crumb = document.getElementById('crumbTitle');
  if (crumb) crumb.textContent = post.title;
  document.title = `${post.title} — TechRobot`;

  // Обработчик удаления
  const delBtn = document.getElementById('deleteBtn');
  if (delBtn) delBtn.addEventListener('click', () => deletePost(post.id));
}

/* =============================================
   Удаление
   ============================================= */
async function deletePost(id) {
  if (!confirm('Удалить статью? Это действие необратимо.')) return;

  try {
    const res = await fetch(`/api/blog/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('tr_token')}` }
    });
    const data = await res.json();

    if (data.success) {
      AppUtils.showToast('Статья удалена', 'success');
      setTimeout(() => location.href = 'blog.html', 800);
    } else {
      AppUtils.showToast(data.message || 'Не удалось удалить', 'error');
    }
  } catch (err) {
    AppUtils.showToast('Ошибка соединения с сервером', 'error');
  }
}

/* =============================================
   Ошибка
   ============================================= */
function renderError(msg) {
  const container = document.getElementById('postContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state" style="padding:5rem 2rem;">
      <div class="empty-state-icon">🔍</div>
      <div class="empty-state-title">${AppUtils.escapeHtml(msg)}</div>
      <a href="blog.html" class="btn btn-primary btn-sm" style="margin-top:1rem;">К блогу</a>
    </div>
  `;
}

/* =============================================
   Метки категорий
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
