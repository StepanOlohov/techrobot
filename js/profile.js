/**
 * TECHROBOT — Скрипт личного кабинета
 * Управление профилем, избранным и историей просмотров
 */

'use strict';

let allArticles = [];

document.addEventListener('DOMContentLoaded', async () => {
  let user = getCurrentUser();

  if (!user) {
    // Не авторизован — показываем экран входа
    renderLoginPrompt();
    return;
  }

  // Синхронизируем с сервером — подтягиваем свежие избранное/историю/профиль
  // с других устройств (если токен протух — syncCurrentUser вернёт null)
  const fresh = await AuthModule.syncCurrentUser();
  if (fresh) {
    user = fresh;
  } else if (!getToken()) {
    renderLoginPrompt();
    return;
  }

  // Загружаем данные
  try {
    allArticles = await AppUtils.fetchData('data/articles.json');
  } catch {}

  renderProfileHeader(user);
  initTabs();
  renderFavorites(user);
});

/* =============================================
   Экран для неавторизованных
   ============================================= */
function renderLoginPrompt() {
  const main = document.getElementById('profileMain');
  if (main) {
    main.innerHTML = `
      <div class="empty-state" style="padding:8rem 2rem;">
        <div class="empty-state-icon">🔒</div>
        <div class="empty-state-title">Нужна авторизация</div>
        <div class="empty-state-text">Войдите в аккаунт или зарегистрируйтесь, чтобы открыть личный кабинет</div>
        <div style="display:flex;gap:1rem;margin-top:1rem;">
          <button class="btn btn-primary" onclick="openAuthModal('login')">Войти</button>
          <button class="btn btn-secondary" onclick="openAuthModal('register')">Регистрация</button>
        </div>
      </div>
    `;
  }
}

/* =============================================
   Шапка профиля
   ============================================= */
function renderProfileHeader(user) {
  const container = document.getElementById('profileHeader');
  if (!container) return;

  const initials = user.name ? user.name.charAt(0).toUpperCase() : '?';
  const regDate = AppUtils.formatDate(user.registeredAt ? user.registeredAt.split('T')[0] : '');
  const favCount = (user.favorites || []).length;
  const histCount = (user.history || []).length;

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">
        ${user.avatar ? `<img src="${AppUtils.escapeHtml(user.avatar)}" alt="${AppUtils.escapeHtml(user.name)}">` : initials}
      </div>
      <div style="flex:1;">
        <h1 class="profile-name">${AppUtils.escapeHtml(user.name)}</h1>
        <p class="profile-email">📧 ${AppUtils.escapeHtml(user.email)}</p>
        ${user.bio ? `<p style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:1rem;">${AppUtils.escapeHtml(user.bio)}</p>` : ''}
        <div class="profile-stats">
          <div class="profile-stat">
            <span class="profile-stat-number">${favCount}</span>
            <span class="profile-stat-label">Избранных</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-number">${histCount}</span>
            <span class="profile-stat-label">Просмотрено</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-number">${regDate || '—'}</span>
            <span class="profile-stat-label">Дата регистрации</span>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.5rem;align-self:flex-start;">
        <button class="btn btn-secondary btn-sm" onclick="openEditModal()">✏️ Редактировать</button>
        <button class="btn btn-ghost btn-sm" onclick="AuthModule.logout()">🚪 Выйти</button>
      </div>
    </div>
  `;
}

/* =============================================
   Вкладки
   ============================================= */
function initTabs() {
  const tabs = document.querySelectorAll('.profile-tab');
  const panels = document.querySelectorAll('.profile-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      panels.forEach(p => {
        p.classList.toggle('hidden', p.dataset.panel !== target);
      });

      // Ленивый рендеринг панелей
      const user = getCurrentUser();
      if (!user) return;

      if (target === 'favorites')  renderFavorites(user);
      if (target === 'history')    renderHistory(user);
      if (target === 'blog')       renderMyBlogPosts();
      if (target === 'settings')   renderSettings(user);
    });
  });

  // Поддержка ?tab=blog в URL (редирект после отправки статьи)
  const urlTab = AppUtils.getUrlParam('tab');
  if (urlTab) {
    const btn = document.querySelector(`.profile-tab[data-tab="${urlTab}"]`);
    if (btn) btn.click();
  }
}

/* =============================================
   Панель "Избранное"
   ============================================= */
function renderFavorites(user) {
  const container = document.getElementById('favoritesPanel');
  if (!container) return;

  const favIds = user.favorites || [];
  if (favIds.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🤍</div>
        <div class="empty-state-title">Нет избранных статей</div>
        <div class="empty-state-text">Добавляйте статьи в избранное, нажав ❤️ на карточке</div>
        <a href="articles.html" class="btn btn-primary btn-sm">Перейти к статьям</a>
      </div>
    `;
    return;
  }

  const favArticles = allArticles.filter(a => favIds.includes(a.id));
  if (favArticles.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🤍</div><div class="empty-state-title">Избранные статьи не найдены</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="grid-3">
      ${favArticles.map(a => buildMiniArticleCard(a)).join('')}
    </div>
  `;
}

/* =============================================
   Панель "История просмотров"
   ============================================= */
function renderHistory(user) {
  const container = document.getElementById('historyPanel');
  if (!container) return;

  const histIds = user.history || [];
  if (histIds.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📖</div>
        <div class="empty-state-title">История пуста</div>
        <div class="empty-state-text">Читайте статьи — они будут появляться здесь</div>
        <a href="articles.html" class="btn btn-primary btn-sm">К статьям</a>
      </div>
    `;
    return;
  }

  // Упорядочиваем по порядку истории
  const histArticles = histIds
    .map(id => allArticles.find(a => a.id === id))
    .filter(Boolean);

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.75rem;">
      ${histArticles.map((a, i) => buildHistoryItem(a, i + 1)).join('')}
    </div>
    <div style="margin-top:1.5rem;">
      <button class="btn btn-ghost btn-sm" onclick="clearHistory()">🗑️ Очистить историю</button>
    </div>
  `;
}

function buildHistoryItem(article, num) {
  const badgeClass = AppUtils.getCategoryBadgeClass(article.category);
  return `
    <a href="article.html?id=${article.id}" style="display:flex;align-items:center;gap:1rem;padding:1rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);text-decoration:none;transition:all 0.25s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
      <span style="color:var(--text-muted);font-size:0.85rem;min-width:24px;">${num}</span>
      <span style="font-size:1.5rem;">${AppUtils.getCategoryIcon(article.category)}</span>
      <div style="flex:1;">
        <span class="badge ${badgeClass}" style="font-size:0.72rem;margin-bottom:0.25rem;display:inline-flex;">${AppUtils.escapeHtml(article.categoryLabel)}</span>
        <div style="font-weight:600;color:var(--text-primary);font-size:0.95rem;">${AppUtils.escapeHtml(article.title)}</div>
      </div>
      <span style="font-size:0.8rem;color:var(--text-muted);">⏱ ${article.readTime} мин</span>
    </a>
  `;
}

async function clearHistory() {
  if (!confirm('Очистить всю историю просмотров?')) return;
  const result = await AuthModule.clearHistory();
  if (result.success) {
    const user = getCurrentUser();
    if (user) renderHistory({ ...user, history: [] });
    AppUtils.showToast('История очищена', 'info');
  } else {
    AppUtils.showToast(result.message || 'Ошибка очистки', 'error');
  }
}

window.clearHistory = clearHistory;

/* =============================================
   Панель настроек
   ============================================= */
function renderSettings(user) {
  const container = document.getElementById('settingsPanel');
  if (!container) return;

  container.innerHTML = `
    <div style="max-width:480px;">
      <h3 style="margin-bottom:1.5rem;font-size:1.1rem;">Редактирование профиля</h3>
      <form id="settingsForm">
        <div class="form-group">
          <label class="form-label" for="settingsName">Отображаемое имя</label>
          <input type="text" id="settingsName" class="form-input" value="${AppUtils.escapeHtml(user.name)}" placeholder="Ваше имя">
        </div>
        <div class="form-group">
          <label class="form-label" for="settingsBio">О себе</label>
          <textarea id="settingsBio" class="form-textarea" placeholder="Расскажите о себе...">${AppUtils.escapeHtml(user.bio || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="settingsAvatar">URL аватара (необязательно)</label>
          <input type="url" id="settingsAvatar" class="form-input" value="${AppUtils.escapeHtml(user.avatar || '')}" placeholder="https://...">
          <small style="color:var(--text-muted);font-size:0.8rem;">Вставьте прямую ссылку на изображение</small>
        </div>
        <button type="submit" class="btn btn-primary">Сохранить изменения</button>
      </form>

      <div class="divider" style="margin:2rem 0;"></div>
      <h3 style="margin-bottom:1rem;font-size:1.1rem;">Опасная зона</h3>
      <button class="btn btn-ghost" onclick="AuthModule.logout()" style="border-color:#ff4d6d;color:#ff4d6d;">
        🚪 Выйти из аккаунта
      </button>
    </div>
  `;

  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name   = document.getElementById('settingsName').value;
    const bio    = document.getElementById('settingsBio').value;
    const avatar = document.getElementById('settingsAvatar').value;

    const result = await AuthModule.updateProfile({ name, bio, avatar });
    if (result.success) {
      AppUtils.showToast(result.message, 'success');
      // Перерисовываем шапку профиля
      renderProfileHeader(getCurrentUser());
      if (typeof updateHeaderAuth === 'function') updateHeaderAuth();
    } else {
      AppUtils.showToast(result.message, 'error');
    }
  });
}

/* =============================================
   Модальное окно редактирования профиля
   ============================================= */
function openEditModal() {
  const user = getCurrentUser();
  if (!user) return;

  // Переключаемся на вкладку настроек
  const settingsTab = document.querySelector('.profile-tab[data-tab="settings"]');
  if (settingsTab) settingsTab.click();
}

window.openEditModal = openEditModal;

/* =============================================
   Вспомогательная карточка статьи
   ============================================= */
function buildMiniArticleCard(article) {
  const badgeClass = AppUtils.getCategoryBadgeClass(article.category);
  const icon = AppUtils.getCategoryIcon(article.category);
  const isFav = typeof isFavorite === 'function' ? isFavorite(article.id) : false;

  const imgHtml = article.image
    ? `<img src="${AppUtils.escapeHtml(article.image)}" alt="${AppUtils.escapeHtml(article.title)}" class="article-card-img" loading="lazy" onerror="this.outerHTML='<div class=\\'article-img-placeholder article-img-${article.category}\\'><span style=\\'font-size:2.5rem;\\'>${icon}</span></div>'">`
    : `<div class="article-img-placeholder article-img-${article.category}"><span style="font-size:2.5rem;">${icon}</span></div>`;

  return `
    <article class="article-card">
      <a href="article.html?id=${article.id}">
        ${imgHtml}
      </a>
      <div class="article-card-body">
        <div class="article-card-meta">
          <span class="badge ${badgeClass}">${AppUtils.escapeHtml(article.categoryLabel)}</span>
        </div>
        <a href="article.html?id=${article.id}">
          <h3 class="article-card-title">${AppUtils.escapeHtml(article.title)}</h3>
        </a>
        <div class="article-card-footer">
          <span style="font-size:0.8rem;color:var(--text-muted);">⏱ ${article.readTime} мин</span>
          <button class="favorite-btn active"
            onclick="handleProfileFav(event, ${article.id}, this)"
            title="Убрать из избранного">❤️</button>
        </div>
      </div>
    </article>
  `;
}

function handleProfileFav(event, articleId, btn) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof toggleFavorite !== 'function') return;
  const added = toggleFavorite(articleId);
  if (!added) {
    // Убираем карточку из списка
    btn.closest('.article-card').remove();
    AppUtils.showToast('Убрано из избранного', 'info');
  }
}

/* =============================================
   Панель "Мои статьи" (блог)
   ============================================= */
async function renderMyBlogPosts() {
  const container = document.getElementById('blogPanel');
  if (!container) return;

  container.innerHTML = `<div class="loading-block"><div class="spinner"></div></div>`;

  try {
    const res = await fetch('/api/blog/my', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('tr_token')}` }
    });
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">${AppUtils.escapeHtml(data.message || 'Не удалось загрузить статьи')}</div>
        </div>`;
      return;
    }

    renderBlogPanel(container, data.posts || []);
  } catch (err) {
    console.error('Ошибка загрузки моих статей:', err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Ошибка соединения с сервером</div>
      </div>`;
  }
}

function renderBlogPanel(container, posts) {
  const writeBtnHtml = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:1.25rem;">
      <a href="blog-editor.html" class="btn btn-primary btn-sm">✍️ Написать новую статью</a>
    </div>`;

  if (posts.length === 0) {
    container.innerHTML = `
      ${writeBtnHtml}
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-title">Пока нет статей</div>
        <div class="empty-state-text">Поделитесь своими знаниями — напишите первую статью для блога TechRobot.</div>
      </div>`;
    return;
  }

  const items = posts.map(buildMyBlogItem).join('');
  container.innerHTML = `
    ${writeBtnHtml}
    <div style="display:flex;flex-direction:column;gap:0.75rem;">${items}</div>`;

  // Обработчики удаления
  posts.forEach(p => {
    const delBtn = document.getElementById(`myBlogDel-${p.id}`);
    if (delBtn) delBtn.addEventListener('click', () => deleteMyBlogPost(p.id));
  });
}

function buildMyBlogItem(post) {
  const date = AppUtils.formatDate(post.created_at);
  const badge = {
    pending:  { cls: 'badge--pending',  text: '🟡 На модерации' },
    approved: { cls: 'badge--approved', text: '🟢 Опубликована' },
    rejected: { cls: 'badge--rejected', text: '🔴 Отклонена' }
  }[post.status] || { cls: '', text: post.status };

  // Кнопка «Редактировать» доступна только для pending/rejected
  const editBtn = post.status !== 'approved'
    ? `<a href="blog-editor.html?id=${post.id}" class="btn btn-ghost btn-sm">✏️ Редактировать</a>`
    : '';

  const rejectionReason = post.status === 'rejected' && post.rejection_reason
    ? `<div style="margin-top:0.5rem;padding:0.6rem 0.85rem;background:rgba(255,45,120,0.06);border-radius:var(--radius-sm);font-size:0.85rem;color:var(--text-secondary);">
         <strong style="color:#ff2d78;">Причина:</strong> ${AppUtils.escapeHtml(post.rejection_reason)}
       </div>`
    : '';

  return `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);padding:1.25rem;">
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">
        <span class="badge ${badge.cls}">${badge.text}</span>
        <span style="font-size:0.78rem;color:var(--text-muted);">📅 ${date}</span>
        <span style="font-size:0.78rem;color:var(--text-muted);">👁 ${AppUtils.formatNumber(post.views)}</span>
      </div>
      <a href="blog-post.html?id=${post.id}" style="text-decoration:none;color:inherit;">
        <h4 style="font-size:1.05rem;font-weight:700;color:var(--text-primary);margin:0 0 0.4rem;line-height:1.4;">
          ${AppUtils.escapeHtml(post.title)}
        </h4>
      </a>
      <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.6;margin:0;">
        ${AppUtils.escapeHtml(post.excerpt)}
      </p>
      ${rejectionReason}
      <div style="display:flex;gap:0.5rem;margin-top:0.85rem;flex-wrap:wrap;">
        <a href="blog-post.html?id=${post.id}" class="btn btn-secondary btn-sm">👁 Открыть</a>
        ${editBtn}
        <button class="btn btn-ghost btn-sm" id="myBlogDel-${post.id}"
          style="color:#ff2d78;border-color:rgba(255,45,120,0.3);">🗑 Удалить</button>
      </div>
    </div>`;
}

async function deleteMyBlogPost(id) {
  if (!confirm('Удалить статью? Это действие необратимо.')) return;

  try {
    const res = await fetch(`/api/blog/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('tr_token')}` }
    });
    const data = await res.json();

    if (data.success) {
      AppUtils.showToast('Статья удалена', 'success');
      renderMyBlogPosts(); // перерисовать список
    } else {
      AppUtils.showToast(data.message || 'Не удалось удалить', 'error');
    }
  } catch (err) {
    AppUtils.showToast('Ошибка соединения с сервером', 'error');
  }
}

window.handleProfileFav = handleProfileFav;
