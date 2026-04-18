/**
 * TECHROBOT — Модуль форума
 * Хранение тем и сообщений в localStorage
 * Ключ хранилища: 'tr_forum_topics'
 */

'use strict';

const FORUM_KEY = 'tr_forum_topics';

/* =============================================
   CRUD операции с localStorage
   ============================================= */

/**
 * Загружает темы из localStorage (или инициализирует из JSON)
 */
async function getForumTopics() {
  try {
    const raw = localStorage.getItem(FORUM_KEY);
    if (raw) return JSON.parse(raw);

    // Первый запуск — инициализируем из JSON-файла
    const data = await fetch('data/forum.json').then(r => r.json());
    localStorage.setItem(FORUM_KEY, JSON.stringify(data));
    return data;
  } catch {
    return [];
  }
}

function saveForumTopics(topics) {
  localStorage.setItem(FORUM_KEY, JSON.stringify(topics));
}

/* =============================================
   Страница списка тем (forum.html)
   ============================================= */
document.addEventListener('DOMContentLoaded', async () => {
  const topicsList = document.getElementById('forumTopicsList');
  if (!topicsList) return;

  AppUtils.showLoading('forumTopicsList');
  const topics = await getForumTopics();

  initNewTopicBtn();
  renderTopicsList(topics);
});

function renderTopicsList(topics) {
  const container = document.getElementById('forumTopicsList');
  if (!container) return;

  if (topics.length === 0) {
    AppUtils.showEmpty('forumTopicsList', '💬', 'Тем пока нет', 'Создайте первую тему!');
    return;
  }

  // Сначала закреплённые, потом по дате
  const sorted = [...topics].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date) - new Date(a.date);
  });

  const countEl = document.getElementById('topicsCount');
  if (countEl) countEl.textContent = `${topics.length} тем`;

  container.innerHTML = sorted.map(topic => buildTopicRow(topic)).join('');
}

function buildTopicRow(topic) {
  const msgCount = (topic.messages || []).length;
  const date = AppUtils.formatDate(topic.date);
  const badgeClass = AppUtils.getCategoryBadgeClass(topic.category);

  return `
    <a href="forum-topic.html?id=${topic.id}" class="forum-topic fade-in" aria-label="${AppUtils.escapeHtml(topic.title)}">
      <div class="forum-topic-icon">
        ${topic.pinned ? '📌' : '💬'}
      </div>
      <div class="forum-topic-body">
        <h3 class="forum-topic-title">
          ${topic.pinned ? '<span style="color:var(--primary);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:2px;">Закреплено</span>' : ''}
          ${AppUtils.escapeHtml(topic.title)}
        </h3>
        <div class="forum-topic-meta">
          <span class="badge ${badgeClass}" style="font-size:0.72rem;">${AppUtils.escapeHtml(topic.categoryLabel)}</span>
          <span>👤 ${AppUtils.escapeHtml(topic.authorName)}</span>
          <span>📅 ${date}</span>
        </div>
      </div>
      <div class="forum-topic-stats">
        <div class="forum-topic-replies">${msgCount}</div>
        <div class="forum-topic-replies-label">сообщений</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.25rem;">👁 ${topic.views || 0}</div>
      </div>
    </a>
  `;
}

/* =============================================
   Кнопка создания новой темы
   ============================================= */
function initNewTopicBtn() {
  const btn = document.getElementById('newTopicBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!isLoggedIn()) {
      AppUtils.showToast('Войдите в аккаунт для создания тем', 'info');
      openAuthModal('login');
      return;
    }
    openNewTopicModal();
  });
}

function openNewTopicModal() {
  const existing = document.getElementById('newTopicModal');
  if (existing) existing.remove();

  const html = `
    <div class="modal-overlay active" id="newTopicModal">
      <div class="modal" style="max-width:560px;">
        <div class="modal-header">
          <h2 class="modal-title">Новая тема</h2>
          <button class="modal-close" onclick="document.getElementById('newTopicModal').remove()">×</button>
        </div>
        <form id="newTopicForm">
          <div class="form-group">
            <label class="form-label" for="topicTitle">Заголовок темы *</label>
            <input type="text" id="topicTitle" name="title" class="form-input" placeholder="Введите заголовок темы" maxlength="200">
            <span class="form-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="topicCategory">Категория *</label>
            <select id="topicCategory" name="category" class="form-select">
              <option value="ai">Искусственный интеллект</option>
              <option value="robotics">Робототехника</option>
              <option value="iot">Интернет вещей</option>
              <option value="vrar">VR / AR</option>
              <option value="biotech">Биотехнологии</option>
              <option value="drones">Беспилотники</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="topicMessage">Сообщение *</label>
            <textarea id="topicMessage" name="message" class="form-textarea" placeholder="Напишите первое сообщение в теме..." style="min-height:140px;" maxlength="2000"></textarea>
            <span class="form-error"></span>
          </div>
          <div style="display:flex;gap:0.75rem;">
            <button type="submit" class="btn btn-primary" style="flex:1;">Создать тему</button>
            <button type="button" class="btn btn-ghost" onclick="document.getElementById('newTopicModal').remove()">Отмена</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  document.getElementById('newTopicModal').addEventListener('click', e => {
    if (e.target.id === 'newTopicModal') document.getElementById('newTopicModal').remove();
  });

  document.getElementById('newTopicForm').addEventListener('submit', handleCreateTopic);
}

async function handleCreateTopic(e) {
  e.preventDefault();

  const title   = document.getElementById('topicTitle').value.trim();
  const catEl   = document.getElementById('topicCategory');
  const message = document.getElementById('topicMessage').value.trim();
  const user    = getCurrentUser();

  if (!title) {
    AppUtils.showToast('Введите заголовок темы', 'error');
    return;
  }
  if (!message) {
    AppUtils.showToast('Введите сообщение', 'error');
    return;
  }
  if (!user) {
    AppUtils.showToast('Не авторизован', 'error');
    return;
  }

  const catLabels = { ai:'Искусственный интеллект', robotics:'Робототехника', iot:'Интернет вещей', vrar:'VR / AR', biotech:'Биотехнологии', drones:'Беспилотники' };
  const category = catEl.value;

  const topics = await getForumTopics();
  const newTopic = {
    id: Date.now(),
    title,
    author: user.email,
    authorName: user.name,
    date: new Date().toISOString().split('T')[0],
    category,
    categoryLabel: catLabels[category] || category,
    views: 0,
    pinned: false,
    messages: [
      {
        id: 1,
        author: user.email,
        authorName: user.name,
        date: new Date().toISOString(),
        text: message
      }
    ]
  };

  topics.push(newTopic);
  saveForumTopics(topics);

  document.getElementById('newTopicModal').remove();
  AppUtils.showToast('Тема создана!', 'success');
  renderTopicsList(topics);
}

/* =============================================
   Страница отдельной темы (forum-topic.html)
   ============================================= */
document.addEventListener('DOMContentLoaded', async () => {
  const messagesContainer = document.getElementById('forumMessages');
  if (!messagesContainer) return;

  const topicId = parseInt(AppUtils.getUrlParam('id'), 10);
  if (!topicId) {
    AppUtils.showError('forumMessages', 'Тема не найдена');
    return;
  }

  const topics = await getForumTopics();
  const topic = topics.find(t => t.id === topicId);

  if (!topic) {
    AppUtils.showError('forumMessages', 'Тема не найдена');
    return;
  }

  // Увеличиваем счётчик просмотров
  topic.views = (topic.views || 0) + 1;
  saveForumTopics(topics);

  renderTopicPage(topic);
  initReplyForm(topicId);
});

function renderTopicPage(topic) {
  document.title = `${topic.title} — Форум — TechRobot`;

  // Заголовок
  const titleEl = document.getElementById('topicTitle');
  if (titleEl) titleEl.textContent = topic.title;

  // Мета
  const metaEl = document.getElementById('topicMeta');
  if (metaEl) {
    const badgeClass = AppUtils.getCategoryBadgeClass(topic.category);
    metaEl.innerHTML = `
      <span class="badge ${badgeClass}">${AppUtils.escapeHtml(topic.categoryLabel)}</span>
      <span>👤 ${AppUtils.escapeHtml(topic.authorName)}</span>
      <span>📅 ${AppUtils.formatDate(topic.date)}</span>
      <span>👁 ${topic.views} просмотров</span>
    `;
  }

  // Сообщения
  const container = document.getElementById('forumMessages');
  if (!container) return;

  if (!topic.messages || topic.messages.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);">Сообщений нет</p>';
    return;
  }

  container.innerHTML = topic.messages.map((msg, idx) => buildMessage(msg, idx + 1)).join('');
}

function buildMessage(msg, num) {
  const initials = msg.authorName ? msg.authorName.charAt(0).toUpperCase() : '?';
  return `
    <div class="forum-message">
      <div class="forum-message-avatar">${initials}</div>
      <div class="forum-message-body">
        <div class="forum-message-header">
          <span class="forum-message-author">${AppUtils.escapeHtml(msg.authorName)}</span>
          <span class="forum-message-date">${AppUtils.formatDateTime(msg.date)}</span>
          <span style="font-size:0.75rem;color:var(--text-muted);">#${num}</span>
        </div>
        <div class="forum-message-text">${AppUtils.escapeHtml(msg.text)}</div>
      </div>
    </div>
  `;
}

function initReplyForm(topicId) {
  const form = document.getElementById('replyForm');
  if (!form) return;

  // Показываем форму только авторизованным
  const user = getCurrentUser();
  const loginNotice = document.getElementById('replyLoginNotice');

  if (!user) {
    if (form) form.style.display = 'none';
    if (loginNotice) {
      loginNotice.style.display = 'block';
      loginNotice.innerHTML = `
        <p style="color:var(--text-muted);">
          <a href="#" onclick="openAuthModal('login')" style="color:var(--primary);">Войдите</a>, чтобы ответить в теме.
        </p>
      `;
    }
    return;
  }

  if (loginNotice) loginNotice.style.display = 'none';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const textarea = form.querySelector('textarea');
    const text = textarea ? textarea.value.trim() : '';

    if (!text) {
      AppUtils.showToast('Введите текст сообщения', 'error');
      return;
    }
    if (text.length < 5) {
      AppUtils.showToast('Сообщение слишком короткое (минимум 5 символов)', 'error');
      return;
    }

    const topics = await getForumTopics();
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    const newMsg = {
      id: (topic.messages.length + 1),
      author: user.email,
      authorName: user.name,
      date: new Date().toISOString(),
      text
    };

    topic.messages.push(newMsg);
    saveForumTopics(topics);

    // Добавляем сообщение в DOM
    const container = document.getElementById('forumMessages');
    if (container) {
      container.insertAdjacentHTML('beforeend', buildMessage(newMsg, topic.messages.length));
    }

    if (textarea) textarea.value = '';
    AppUtils.showToast('Сообщение отправлено!', 'success');

    // Скроллим к новому сообщению
    setTimeout(() => {
      const lastMsg = container.lastElementChild;
      if (lastMsg) lastMsg.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  });
}
