/**
 * TECHROBOT — Редактор статьи блога (создание + редактирование)
 *
 * Режимы:
 *   blog-editor.html              → новая статья (POST /api/blog)
 *   blog-editor.html?id=N         → редактирование (PUT /api/blog/:N)
 *
 * Доступна только авторизованным. Если не авторизован — редирект на главную
 * с открытием модалки логина.
 */

'use strict';

const FIELD_LIMITS = {
  title:   { min: 5,   max: 200 },
  excerpt: { min: 20,  max: 500 },
  content: { min: 100, max: 50000 }
};

const ALLOWED_TAGS  = ['p', 'h2', 'h3', 'h4', 'strong', 'em', 'u', 'a',
                       'ul', 'ol', 'li', 'img', 'code', 'pre', 'blockquote', 'br'];
const ALLOWED_ATTRS = ['href', 'src', 'alt', 'class'];

let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Проверка авторизации
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user) {
    AppUtils.showToast('Войдите в аккаунт, чтобы написать статью', 'info');
    setTimeout(() => {
      location.href = 'index.html';
      // Модалку откроет следующая страница если есть ?auth=login,
      // но проще — пользователь сам кликнет «Войти»
    }, 1200);
    return;
  }

  // Режим редактирования?
  editingId = parseInt(AppUtils.getUrlParam('id'), 10) || null;
  if (editingId) {
    setMode('edit');
    await loadExistingPost(editingId);
  }

  initCounters();
  initCoverPreview();
  initTabs();
  initSubmit();
});

/* =============================================
   Загрузка существующей статьи для редактирования
   ============================================= */
async function loadExistingPost(id) {
  try {
    const res = await fetch(`/api/blog/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('tr_token')}` }
    });
    const data = await res.json();

    if (!data.success) {
      AppUtils.showToast(data.message || 'Не удалось загрузить статью', 'error');
      setTimeout(() => location.href = 'blog.html', 1500);
      return;
    }

    const post = data.post;
    const user = getCurrentUser();
    // Сервер уже проверяет права, но дополнительно убедимся
    if (post.user_id !== user.id) {
      AppUtils.showToast('Это не ваша статья', 'error');
      setTimeout(() => location.href = `blog-post.html?id=${id}`, 1500);
      return;
    }
    if (post.status === 'approved') {
      AppUtils.showToast('Опубликованную статью изменить нельзя', 'info');
      setTimeout(() => location.href = `blog-post.html?id=${id}`, 1500);
      return;
    }

    // Заполняем поля
    document.getElementById('fieldTitle').value    = post.title;
    document.getElementById('fieldCategory').value = post.category;
    document.getElementById('fieldCover').value    = post.cover_url || '';
    document.getElementById('fieldExcerpt').value  = post.excerpt;
    document.getElementById('fieldContent').value  = post.content;

    // Обновляем счётчики
    updateCounter('fieldTitle', 'counterTitle', FIELD_LIMITS.title.max);
    updateCounter('fieldExcerpt', 'counterExcerpt', FIELD_LIMITS.excerpt.max);
    updateCounter('fieldContent', 'counterContent', FIELD_LIMITS.content.max);
    showCoverPreview(post.cover_url);
  } catch (err) {
    console.error('Ошибка загрузки статьи:', err);
    AppUtils.showToast('Ошибка соединения с сервером', 'error');
  }
}

function setMode(mode) {
  if (mode === 'edit') {
    document.getElementById('modeCrumb').textContent = 'Редактирование';
    document.getElementById('modeTitle').textContent = 'Редактирование статьи';
    document.getElementById('submitBtn').textContent = 'Сохранить и отправить';
  }
}

/* =============================================
   Счётчики символов
   ============================================= */
function initCounters() {
  bindCounter('fieldTitle',   'counterTitle',   FIELD_LIMITS.title.max);
  bindCounter('fieldExcerpt', 'counterExcerpt', FIELD_LIMITS.excerpt.max);
  bindCounter('fieldContent', 'counterContent', FIELD_LIMITS.content.max);
}

function bindCounter(inputId, counterId, max) {
  const input   = document.getElementById(inputId);
  if (!input) return;
  const update  = () => updateCounter(inputId, counterId, max);
  input.addEventListener('input', update);
  update();
}

function updateCounter(inputId, counterId, max) {
  const input   = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (!input || !counter) return;
  const len = input.value.length;
  counter.textContent = `${len} / ${max}`;
  counter.classList.toggle('over', len > max);
}

/* =============================================
   Превью обложки при вводе URL
   ============================================= */
function initCoverPreview() {
  const input = document.getElementById('fieldCover');
  if (!input) return;
  const debounced = AppUtils.debounce(() => showCoverPreview(input.value.trim()), 400);
  input.addEventListener('input', debounced);
}

function showCoverPreview(url) {
  const img = document.getElementById('coverPreview');
  if (!img) return;
  if (!url || !/^https:\/\/\S+$/i.test(url)) {
    img.classList.remove('visible');
    img.src = '';
    return;
  }
  img.onerror = () => img.classList.remove('visible');
  img.onload  = () => img.classList.add('visible');
  img.src = url;
}

/* =============================================
   Переключатель Редактор ↔ Превью
   ============================================= */
function initTabs() {
  const form    = document.getElementById('editorForm');
  const preview = document.getElementById('editorPreview');
  const tabs    = document.querySelectorAll('.editor-tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      tabs.forEach(t => t.classList.toggle('active', t === tab));

      if (mode === 'preview') {
        renderPreview();
        form.style.display = 'none';
        preview.classList.add('visible');
      } else {
        form.style.display = 'block';
        preview.classList.remove('visible');
      }
    });
  });
}

/**
 * Рендер превью статьи в том же виде, в каком её увидят читатели
 * на странице blog-post.html: обложка, заголовок, мета (автор/дата/категория),
 * описание, контент.
 */
function renderPreview() {
  const el = document.getElementById('editorPreview');
  if (!el) return;

  // Собираем все поля формы
  const title    = document.getElementById('fieldTitle').value.trim();
  const category = document.getElementById('fieldCategory').value;
  const coverUrl = document.getElementById('fieldCover').value.trim();
  const excerpt  = document.getElementById('fieldExcerpt').value.trim();
  const rawContent = document.getElementById('fieldContent').value || '';

  // Если ничего не заполнено — пустое состояние
  if (!title && !excerpt && !rawContent) {
    el.innerHTML = `
      <div class="preview-empty">
        <div style="font-size:3rem;margin-bottom:0.5rem;">👁</div>
        <div>Заполните поля — увидите, как статья будет выглядеть на сайте</div>
      </div>`;
    return;
  }

  // Текущий пользователь — для блока автора в превью
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const authorName    = user ? user.name : 'Вы';
  const authorAvatar  = user ? user.avatar : '';
  const authorInitial = authorName.charAt(0).toUpperCase();

  // Сегодняшняя дата (для предварительного просмотра)
  const today = AppUtils.formatDate(new Date().toISOString().slice(0, 10));

  // Обложка или цветной плейсхолдер по категории
  const coverHtml = coverUrl && /^https:\/\/\S+$/i.test(coverUrl)
    ? `<img src="${AppUtils.escapeHtml(coverUrl)}" alt="" class="preview-cover" onerror="this.style.display='none';">`
    : (category
        ? `<div class="preview-cover-placeholder article-img-${category}">${AppUtils.getCategoryIcon(category)}</div>`
        : `<div class="preview-cover-placeholder" style="background:var(--bg-dark2);color:var(--text-muted);">📝</div>`);

  // Бейдж категории
  const badgeHtml = category
    ? `<span class="badge ${AppUtils.getCategoryBadgeClass(category)}">${getCategoryLabel(category)}</span>`
    : '<span class="badge" style="background:var(--bg-dark2);color:var(--text-muted);">без категории</span>';

  // Аватар автора
  const avatarHtml = authorAvatar
    ? `<img src="${AppUtils.escapeHtml(authorAvatar)}" alt="" class="blog-author-avatar">`
    : `<div class="blog-author-avatar blog-author-avatar--initial">${authorInitial}</div>`;

  // Санитизированный контент (с авто-абзацами)
  const wrapped = autoWrapParagraphs(rawContent);
  const safeContent = (typeof DOMPurify !== 'undefined')
    ? DOMPurify.sanitize(wrapped, {
        ALLOWED_TAGS: ALLOWED_TAGS,
        ALLOWED_ATTR: ALLOWED_ATTRS,
        ALLOWED_URI_REGEXP: /^(https?:|mailto:|tel:)/i
      })
    : '<p style="color:var(--text-muted);">DOMPurify не загрузился — превью контента недоступно.</p>';

  el.innerHTML = `
    ${coverHtml}
    <div>${badgeHtml}</div>
    <h1 class="preview-title">${AppUtils.escapeHtml(title) || '<span style="color:var(--text-muted);">Без заголовка</span>'}</h1>
    ${excerpt ? `<p class="preview-excerpt">${AppUtils.escapeHtml(excerpt)}</p>` : ''}
    <div class="preview-meta">
      <div class="preview-author">
        ${avatarHtml}
        <span>${AppUtils.escapeHtml(authorName)}</span>
      </div>
      <span>📅 ${today}</span>
      <span style="color:#ffcc00;">🟡 На модерации (предпросмотр)</span>
    </div>
    <div class="post-content">${safeContent || '<p style="color:var(--text-muted);">Текст ещё не написан…</p>'}</div>
  `;
}

/**
 * Метки категорий (та же таблица что в blog.js и blog-post.js).
 */
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
   Отправка формы
   ============================================= */
function initSubmit() {
  const btn = document.getElementById('submitBtn');
  if (btn) btn.addEventListener('click', submitForm);
}

/**
 * Превращает обычный текст в HTML-абзацы, если пользователь не написал теги сам.
 * - Если в тексте уже есть блочные теги (<p>, <h2>, <ul>...) — возвращаем как есть
 * - Иначе разбиваем по пустым строкам → каждая часть оборачивается в <p>
 * - Одиночные переносы внутри абзаца → <br>
 */
function autoWrapParagraphs(text) {
  if (!text) return text;
  if (/<(p|h[1-6]|ul|ol|li|blockquote|pre|div)[\s>/]/i.test(text)) {
    return text; // пользователь уже разметил — не трогаем
  }
  return text
    .split(/\n\s*\n+/)               // разбить на абзацы (пустая строка)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

async function submitForm() {
  const title    = document.getElementById('fieldTitle').value.trim();
  const category = document.getElementById('fieldCategory').value;
  const coverUrl = document.getElementById('fieldCover').value.trim();
  const excerpt  = document.getElementById('fieldExcerpt').value.trim();
  let   content  = document.getElementById('fieldContent').value.trim();

  // Автоматически оборачиваем обычный текст в <p> — пользователю удобнее
  content = autoWrapParagraphs(content);

  // Клиентская валидация — дублирует серверную для UX
  const errors = [];
  if (title.length < FIELD_LIMITS.title.min || title.length > FIELD_LIMITS.title.max) {
    errors.push(`Заголовок: ${FIELD_LIMITS.title.min}–${FIELD_LIMITS.title.max} символов`);
  }
  if (!category) errors.push('Выберите категорию');
  if (excerpt.length < FIELD_LIMITS.excerpt.min || excerpt.length > FIELD_LIMITS.excerpt.max) {
    errors.push(`Описание: ${FIELD_LIMITS.excerpt.min}–${FIELD_LIMITS.excerpt.max} символов`);
  }
  if (content.length < FIELD_LIMITS.content.min || content.length > FIELD_LIMITS.content.max) {
    errors.push(`Контент: ${FIELD_LIMITS.content.min}–${FIELD_LIMITS.content.max} символов`);
  }
  if (coverUrl && !/^https:\/\/\S+$/i.test(coverUrl)) {
    errors.push('Ссылка на обложку должна начинаться с https://');
  }

  if (errors.length) {
    AppUtils.showToast(errors[0], 'error');
    return;
  }

  const btn = document.getElementById('submitBtn');
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Отправка...';

  try {
    const url    = editingId ? `/api/blog/${editingId}` : '/api/blog';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${localStorage.getItem('tr_token')}`
      },
      body: JSON.stringify({ title, category, cover_url: coverUrl, excerpt, content })
    });
    const data = await res.json();

    if (data.success) {
      AppUtils.showToast(data.message || 'Статья отправлена на модерацию', 'success');
      setTimeout(() => location.href = 'profile.html?tab=blog', 1000);
    } else {
      AppUtils.showToast(data.message || 'Не удалось сохранить', 'error');
      btn.disabled = false;
      btn.textContent = oldText;
    }
  } catch (err) {
    AppUtils.showToast('Ошибка соединения с сервером', 'error');
    btn.disabled = false;
    btn.textContent = oldText;
  }
}
