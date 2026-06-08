/**
 * TECHROBOT — Админ-панель: модерация блога
 *
 * Доступ только при currentUser.isAdmin === true.
 * Если нет — показ «Доступ запрещён» + редирект на главную через 3 сек.
 */

'use strict';

const ALLOWED_TAGS  = ['p', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 'a',
                       'ul', 'ol', 'li', 'img', 'code', 'pre', 'blockquote', 'br'];
const ALLOWED_ATTRS = ['href', 'src', 'alt', 'class'];

let queuePosts = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Сначала синхронизируем профиль с сервером — флаг isAdmin может быть свежее
  if (typeof AuthModule !== 'undefined' && AuthModule.syncCurrentUser) {
    await AuthModule.syncCurrentUser();
  }

  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user || !user.isAdmin) {
    renderAccessDenied();
    return;
  }

  await loadQueue();
});

/* =============================================
   Загрузка очереди модерации
   ============================================= */
async function loadQueue() {
  try {
    const res = await fetch('/api/admin/blog/pending', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('tr_token')}` }
    });
    const data = await res.json();

    if (!data.success) {
      renderError(data.message || 'Не удалось загрузить очередь');
      return;
    }

    queuePosts = data.posts || [];
    renderQueue();
  } catch (err) {
    console.error('Ошибка загрузки очереди:', err);
    renderError('Ошибка соединения с сервером');
  }
}

function renderQueue() {
  const container = document.getElementById('adminContent');
  const countEl   = document.getElementById('queueCount');
  if (!container) return;

  if (countEl) countEl.textContent = `${queuePosts.length} ${pluralizeArticles(queuePosts.length)}`;

  if (queuePosts.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:5rem 2rem;">
        <div class="empty-state-icon">✨</div>
        <div class="empty-state-title">Очередь пуста</div>
        <div class="empty-state-text">Новых статей на модерацию нет. Хорошая работа!</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="admin-queue">
      ${queuePosts.map(buildQueueItem).join('')}
    </div>`;

  // Привязываем обработчики
  queuePosts.forEach(p => {
    const item = document.getElementById(`queue-${p.id}`);
    if (!item) return;
    item.querySelector('[data-action="preview"]').addEventListener('click', () => openPreview(p));
    item.querySelector('[data-action="approve"]').addEventListener('click', () => moderate(p.id, 'approve'));
    item.querySelector('[data-action="reject"]').addEventListener('click', () => openRejectModal(p.id));
  });
}

function buildQueueItem(post) {
  const badgeClass = AppUtils.getCategoryBadgeClass(post.category);
  const date       = AppUtils.formatDate(post.created_at);

  return `
    <div class="admin-queue__item" id="queue-${post.id}">
      <div>
        <div class="admin-queue__meta">
          <span class="badge ${badgeClass}">${getCategoryLabel(post.category)}</span>
          <span>👤 ${AppUtils.escapeHtml(post.author_name)}</span>
          <span>📅 ${date}</span>
        </div>
        <h3 class="admin-queue__title">${AppUtils.escapeHtml(post.title)}</h3>
        <p class="admin-queue__excerpt">${AppUtils.escapeHtml(post.excerpt)}</p>
      </div>
      <div class="admin-actions">
        <button class="btn btn-secondary btn-sm" data-action="preview">👁 Просмотреть</button>
        <button class="btn btn-sm btn-approve" data-action="approve">✅ Одобрить</button>
        <button class="btn btn-sm btn-reject" data-action="reject">❌ Отклонить</button>
      </div>
    </div>`;
}

/* =============================================
   Превью полного контента
   ============================================= */
function openPreview(post) {
  // Используем существующий контейнер модалки или создаём
  const existing = document.getElementById('previewModal');
  if (existing) existing.remove();

  const safeContent = (typeof DOMPurify !== 'undefined')
    ? DOMPurify.sanitize(post.content, {
        ALLOWED_TAGS: ALLOWED_TAGS,
        ALLOWED_ATTR: ALLOWED_ATTRS,
        ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:)/i
      })
    : '';

  const html = `
    <div class="modal-overlay" id="previewModal">
      <div class="modal" style="max-width:760px;" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">${AppUtils.escapeHtml(post.title)}</h2>
          <button class="modal-close" id="previewClose" aria-label="Закрыть">×</button>
        </div>
        <div class="preview-modal-content post-content">${safeContent}</div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  const overlay = document.getElementById('previewModal');
  requestAnimationFrame(() => overlay.classList.add('active'));
  document.getElementById('previewClose').addEventListener('click', closePreview);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePreview(); });
}

function closePreview() {
  const overlay = document.getElementById('previewModal');
  if (!overlay) return;
  overlay.classList.remove('active');
  setTimeout(() => overlay.remove(), 300);
}

/* =============================================
   Отклонение с указанием причины
   ============================================= */
function openRejectModal(postId) {
  const existing = document.getElementById('rejectModal');
  if (existing) existing.remove();

  const html = `
    <div class="modal-overlay" id="rejectModal">
      <div class="modal" style="max-width:480px;" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">Причина отклонения</h2>
          <button class="modal-close" id="rejectClose" aria-label="Закрыть">×</button>
        </div>
        <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:1rem;">
          Объясните автору, почему статья отклонена. Текст будет показан в его личном кабинете.
        </p>
        <div class="form-group">
          <label class="form-label" for="rejectReason">Причина (5–500 символов)</label>
          <textarea class="form-textarea" id="rejectReason" rows="4" maxlength="500"
            placeholder="Например: не соответствует тематике, повторение существующей публикации, слабая структура..."></textarea>
          <span style="display:block;text-align:right;font-size:0.78rem;color:var(--text-muted);margin-top:0.3rem;" id="rejectCounter">0 / 500</span>
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
          <button class="btn btn-ghost" id="rejectCancel">Отмена</button>
          <button class="btn btn-reject" id="rejectConfirm">Подтвердить отклонение</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  const overlay = document.getElementById('rejectModal');
  requestAnimationFrame(() => overlay.classList.add('active'));

  const close = () => {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  };

  document.getElementById('rejectClose').addEventListener('click', close);
  document.getElementById('rejectCancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Счётчик символов
  const textarea = document.getElementById('rejectReason');
  const counter  = document.getElementById('rejectCounter');
  textarea.addEventListener('input', () => {
    counter.textContent = `${textarea.value.length} / 500`;
  });
  textarea.focus();

  document.getElementById('rejectConfirm').addEventListener('click', async () => {
    const reason = textarea.value.trim();
    if (reason.length < 5) {
      AppUtils.showToast('Причина: минимум 5 символов', 'error');
      return;
    }
    close();
    await moderate(postId, 'reject', reason);
  });
}

/* =============================================
   Отправка решения модерации
   ============================================= */
async function moderate(postId, action, reason) {
  try {
    const res = await fetch(`/api/admin/blog/${postId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${localStorage.getItem('tr_token')}`
      },
      body: JSON.stringify({ action, reason })
    });
    const data = await res.json();

    if (data.success) {
      AppUtils.showToast(data.message || 'Готово', 'success');
      removeFromQueueWithAnimation(postId);
    } else {
      AppUtils.showToast(data.message || 'Не удалось выполнить действие', 'error');
    }
  } catch (err) {
    console.error('Ошибка модерации:', err);
    AppUtils.showToast('Ошибка соединения с сервером', 'error');
  }
}

function removeFromQueueWithAnimation(postId) {
  const item = document.getElementById(`queue-${postId}`);
  if (!item) return;
  item.classList.add('removing');
  setTimeout(() => {
    queuePosts = queuePosts.filter(p => p.id !== postId);
    renderQueue();
  }, 400);
}

/* =============================================
   Доступ запрещён
   ============================================= */
function renderAccessDenied() {
  const container = document.getElementById('adminContent');
  if (!container) return;
  container.innerHTML = `
    <div class="access-denied">
      <div style="font-size:5rem;margin-bottom:1rem;">🚫</div>
      <h2 style="font-family:var(--font-heading);margin-bottom:0.5rem;">Доступ запрещён</h2>
      <p style="color:var(--text-muted);">У вас нет прав администратора. Через 3 секунды вы будете перенаправлены на главную.</p>
    </div>`;
  setTimeout(() => location.href = 'index.html', 3000);
}

/* =============================================
   Утилиты
   ============================================= */
function renderError(msg) {
  const container = document.getElementById('adminContent');
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state" style="padding:4rem 2rem;">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">${AppUtils.escapeHtml(msg)}</div>
    </div>`;
}

function pluralizeArticles(n) {
  if (n % 100 >= 11 && n % 100 <= 19) return 'статей';
  if (n % 10 === 1) return 'статья';
  if (n % 10 >= 2 && n % 10 <= 4) return 'статьи';
  return 'статей';
}

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
