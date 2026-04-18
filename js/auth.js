/**
 * TECHROBOT — Модуль авторизации (серверная версия)
 *
 * Работает через REST API (Node.js + MySQL):
 *   POST /api/register — регистрация
 *   POST /api/login    — вход
 *   GET  /api/me       — проверка токена
 *   PUT  /api/profile  — обновление профиля
 *   POST /api/favorites/:id — переключение избранного
 *   POST /api/history/:id   — запись в историю
 *   DELETE /api/history      — очистка истории
 *
 * JWT-токен хранится в localStorage.
 * Данные пользователя кэшируются в localStorage для синхронного доступа
 * и синхронизируются с сервером в фоне.
 *
 * Пароли хешируются на сервере через bcrypt (10 раундов).
 */

'use strict';

/* =============================================
   Константы
   ============================================= */
const API_BASE    = '/api';           // Базовый путь API (через Nginx-прокси)
const TOKEN_KEY   = 'tr_token';       // Ключ JWT-токена в localStorage
const SESSION_KEY = 'tr_current_user'; // Ключ кэша пользователя

/* =============================================
   Работа с токеном и кэшем
   ============================================= */

/** Получить JWT-токен */
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** Сохранить JWT-токен */
function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Удалить JWT-токен */
function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Получить кэшированные данные пользователя */
function getCachedUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Сохранить данные пользователя в кэш */
function setCachedUser(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

/** Полная очистка сессии */
function clearSession() {
  removeToken();
  localStorage.removeItem(SESSION_KEY);
}

/* =============================================
   API-запросы (хелпер)
   ============================================= */

/**
 * Отправляет запрос к REST API
 * @param {string} method - HTTP-метод
 * @param {string} path - путь (например '/register')
 * @param {Object|null} body - тело запроса
 * @returns {Promise<Object>} - ответ сервера
 */
async function apiRequest(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();

    if (!res.ok) {
      return { success: false, message: data.message || 'Ошибка сервера' };
    }
    return data;
  } catch (err) {
    console.error('Ошибка API-запроса:', err);
    return { success: false, message: 'Нет соединения с сервером' };
  }
}

/* =============================================
   Управление сессией (синхронные — из кэша)
   ============================================= */

/**
 * Возвращает текущего пользователя (из кэша)
 * @returns {Object|null}
 */
function getCurrentUser() {
  return getCachedUser();
}

/**
 * Проверяет, авторизован ли пользователь
 * @returns {boolean}
 */
function isLoggedIn() {
  return getToken() !== null && getCachedUser() !== null;
}

/* =============================================
   Регистрация (async → сервер)
   ============================================= */

/**
 * Регистрирует нового пользователя через API
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function register(name, email, password) {
  // Клиентская валидация (дублирует серверную для UX)
  if (!name || !email || !password) {
    return { success: false, message: 'Заполните все поля' };
  }
  if (name.trim().length < 2) {
    return { success: false, message: 'Имя должно содержать не менее 2 символов' };
  }
  if (!validateEmail(email)) {
    return { success: false, message: 'Введите корректный email' };
  }
  if (password.length < 6) {
    return { success: false, message: 'Пароль должен содержать не менее 6 символов' };
  }

  const data = await apiRequest('POST', '/register', { name, email, password });

  if (data.success) {
    setToken(data.token);
    setCachedUser(data.user);
  }

  return data;
}

/* =============================================
   Вход (async → сервер)
   ============================================= */

/**
 * Выполняет вход через API
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function login(email, password) {
  if (!email || !password) {
    return { success: false, message: 'Введите email и пароль' };
  }

  const data = await apiRequest('POST', '/login', { email, password });

  if (data.success) {
    setToken(data.token);
    setCachedUser(data.user);
  }

  return data;
}

/* =============================================
   Выход
   ============================================= */

/**
 * Выходит из аккаунта: очистка кэша + редирект
 */
function logout() {
  clearSession();
  window.location.href = 'index.html';
}

/* =============================================
   Обновление профиля (async → сервер)
   ============================================= */

/**
 * Обновляет данные профиля через API
 * @param {Object} updates - {name, bio, avatar}
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function updateProfile(updates) {
  const data = await apiRequest('PUT', '/profile', updates);

  if (data.success && data.user) {
    setCachedUser(data.user);
  }

  return data;
}

/* =============================================
   Избранное (оптимистичное обновление)
   ============================================= */

/**
 * Добавляет или убирает статью из избранного
 * Синхронно обновляет кэш, асинхронно синхронизирует с сервером
 * @param {number} articleId
 * @returns {boolean} - true если добавлено, false если убрано
 */
function toggleFavorite(articleId) {
  const user = getCachedUser();
  if (!user) {
    showToast('Войдите в аккаунт, чтобы добавить в избранное', 'info');
    return false;
  }

  const favorites = user.favorites || [];
  const idx = favorites.indexOf(articleId);
  let added;

  if (idx === -1) {
    favorites.push(articleId);
    added = true;
  } else {
    favorites.splice(idx, 1);
    added = false;
  }

  user.favorites = favorites;
  setCachedUser(user);

  // Синхронизация с сервером в фоне
  apiRequest('POST', `/favorites/${articleId}`).catch(err =>
    console.warn('Не удалось синхронизировать избранное:', err)
  );

  return added;
}

/**
 * Проверяет, в избранном ли статья (из кэша)
 * @param {number} articleId
 * @returns {boolean}
 */
function isFavorite(articleId) {
  const user = getCachedUser();
  if (!user) return false;
  return (user.favorites || []).includes(articleId);
}

/**
 * Возвращает массив ID избранных статей (из кэша)
 * @returns {Array<number>}
 */
function getFavorites() {
  const user = getCachedUser();
  return user ? (user.favorites || []) : [];
}

/* =============================================
   История просмотров (оптимистичное обновление)
   ============================================= */

/**
 * Добавляет статью в историю просмотров
 * @param {number} articleId
 */
function addToHistory(articleId) {
  const user = getCachedUser();
  if (!user) return;

  const history = user.history || [];
  // Убираем дубликат если есть
  const existing = history.indexOf(articleId);
  if (existing !== -1) history.splice(existing, 1);
  // Добавляем в начало
  history.unshift(articleId);
  // Ограничиваем 50 записями
  if (history.length > 50) history.pop();

  user.history = history;
  setCachedUser(user);

  // Синхронизация с сервером в фоне
  apiRequest('POST', `/history/${articleId}`).catch(err =>
    console.warn('Не удалось синхронизировать историю:', err)
  );
}

/**
 * Возвращает историю просмотров (массив ID из кэша)
 * @returns {Array<number>}
 */
function getHistory() {
  const user = getCachedUser();
  return user ? (user.history || []) : [];
}

/**
 * Очищает историю просмотров через API
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function clearHistory() {
  const data = await apiRequest('DELETE', '/history');

  if (data.success) {
    const user = getCachedUser();
    if (user) {
      user.history = [];
      setCachedUser(user);
    }
  }

  return data;
}

/* =============================================
   Валидация форм
   ============================================= */

/**
 * Проверяет корректность email
 * @param {string} email
 * @returns {boolean}
 */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

/**
 * Валидирует форму входа
 */
function validateLoginForm(email, password) {
  const errors = {};
  if (!email) errors.email = 'Введите email';
  else if (!validateEmail(email)) errors.email = 'Некорректный формат email';
  if (!password) errors.password = 'Введите пароль';
  else if (password.length < 6) errors.password = 'Пароль должен быть не менее 6 символов';
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Валидирует форму регистрации
 */
function validateRegisterForm(name, email, password, confirmPassword) {
  const errors = {};
  if (!name || name.trim().length < 2) errors.name = 'Имя должно содержать не менее 2 символов';
  if (!email) errors.email = 'Введите email';
  else if (!validateEmail(email)) errors.email = 'Некорректный формат email';
  if (!password || password.length < 6) errors.password = 'Пароль должен быть не менее 6 символов';
  if (password !== confirmPassword) errors.confirmPassword = 'Пароли не совпадают';
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Отображает ошибки валидации в форме
 */
function showFormErrors(form, errors) {
  form.querySelectorAll('.form-group').forEach(group => {
    group.classList.remove('has-error');
    const errorEl = group.querySelector('.form-error');
    if (errorEl) errorEl.textContent = '';
  });

  Object.entries(errors).forEach(([field, message]) => {
    const input = form.querySelector(`[name="${field}"], #${field}`);
    if (input) {
      const group = input.closest('.form-group');
      if (group) {
        group.classList.add('has-error');
        const errorEl = group.querySelector('.form-error');
        if (errorEl) errorEl.textContent = message;
      }
    }
  });
}

/* =============================================
   Модальное окно авторизации
   ============================================= */

/**
 * Открывает модальное окно входа / регистрации
 * @param {'login'|'register'} mode
 */
function openAuthModal(mode = 'login') {
  // Если модалка уже есть — убираем
  const existing = document.getElementById('authModal');
  if (existing) existing.remove();

  const modalHtml = `
    <div class="modal-overlay" id="authModal">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Авторизация">
        <div class="modal-header">
          <h2 class="modal-title" id="authModalTitle">
            ${mode === 'login' ? 'Войти в аккаунт' : 'Регистрация'}
          </h2>
          <button class="modal-close" id="authModalClose" aria-label="Закрыть">×</button>
        </div>

        <!-- Переключатель вкладок -->
        <div class="auth-tabs" style="display:flex;gap:0.5rem;margin-bottom:1.5rem;border-bottom:1px solid var(--border);padding-bottom:0.75rem;">
          <button class="auth-tab ${mode === 'login' ? 'active' : ''}" data-tab="login" style="background:none;border:none;font-size:0.95rem;font-weight:600;color:${mode === 'login' ? 'var(--primary)' : 'var(--text-secondary)'};cursor:pointer;padding:0.25rem 0.5rem;font-family:var(--font-main);border-bottom:2px solid ${mode === 'login' ? 'var(--primary)' : 'transparent'};transition:all 0.25s;">Вход</button>
          <button class="auth-tab ${mode === 'register' ? 'active' : ''}" data-tab="register" style="background:none;border:none;font-size:0.95rem;font-weight:600;color:${mode === 'register' ? 'var(--primary)' : 'var(--text-secondary)'};cursor:pointer;padding:0.25rem 0.5rem;font-family:var(--font-main);border-bottom:2px solid ${mode === 'register' ? 'var(--primary)' : 'transparent'};transition:all 0.25s;">Регистрация</button>
        </div>

        <!-- Форма входа -->
        <form id="loginForm" class="${mode !== 'login' ? 'hidden' : ''}">
          <div class="form-group">
            <label class="form-label" for="loginEmail">Email</label>
            <input type="email" id="loginEmail" name="email" class="form-input" placeholder="your@email.com" autocomplete="email">
            <span class="form-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="loginPassword">Пароль</label>
            <input type="password" id="loginPassword" name="password" class="form-input" placeholder="Не менее 6 символов" autocomplete="current-password">
            <span class="form-error"></span>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%">Войти</button>
        </form>

        <!-- Форма регистрации -->
        <form id="registerForm" class="${mode !== 'register' ? 'hidden' : ''}">
          <div class="form-group">
            <label class="form-label" for="regName">Имя</label>
            <input type="text" id="regName" name="name" class="form-input" placeholder="Ваше имя" autocomplete="name">
            <span class="form-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="regEmail">Email</label>
            <input type="email" id="regEmail" name="email" class="form-input" placeholder="your@email.com" autocomplete="email">
            <span class="form-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="regPassword">Пароль</label>
            <input type="password" id="regPassword" name="password" class="form-input" placeholder="Не менее 6 символов" autocomplete="new-password">
            <span class="form-error"></span>
          </div>
          <div class="form-group">
            <label class="form-label" for="regConfirm">Подтвердите пароль</label>
            <input type="password" id="regConfirm" name="confirmPassword" class="form-input" placeholder="Повторите пароль" autocomplete="new-password">
            <span class="form-error"></span>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%">Зарегистрироваться</button>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const overlay = document.getElementById('authModal');
  requestAnimationFrame(() => overlay.classList.add('active'));

  // Закрытие
  document.getElementById('authModalClose').addEventListener('click', closeAuthModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAuthModal(); });
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeAuthModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  // Переключение вкладок
  overlay.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      overlay.querySelectorAll('.auth-tab').forEach(t => {
        t.style.color = 'var(--text-secondary)';
        t.style.borderBottomColor = 'transparent';
        t.classList.remove('active');
      });
      tab.style.color = 'var(--primary)';
      tab.style.borderBottomColor = 'var(--primary)';
      tab.classList.add('active');

      document.getElementById('loginForm').classList.toggle('hidden', targetTab !== 'login');
      document.getElementById('registerForm').classList.toggle('hidden', targetTab !== 'register');
      document.getElementById('authModalTitle').textContent =
        targetTab === 'login' ? 'Войти в аккаунт' : 'Регистрация';
    });
  });

  // --- Обработчик формы входа (async!) ---
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    const validation = validateLoginForm(email, password);
    if (!validation.valid) {
      showFormErrors(e.target, validation.errors);
      return;
    }

    // Блокируем кнопку на время запроса
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Вход...';

    const result = await login(email, password);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Войти';

    if (result.success) {
      showToast(result.message, 'success');
      closeAuthModal();
      if (typeof updateHeaderAuth === 'function') updateHeaderAuth();
      else location.reload();
    } else {
      showToast(result.message, 'error');
    }
  });

  // --- Обработчик формы регистрации (async!) ---
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name            = document.getElementById('regName').value;
    const email           = document.getElementById('regEmail').value;
    const password        = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirm').value;

    const validation = validateRegisterForm(name, email, password, confirmPassword);
    if (!validation.valid) {
      showFormErrors(e.target, validation.errors);
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Регистрация...';

    const result = await register(name, email, password);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Зарегистрироваться';

    if (result.success) {
      showToast(result.message, 'success');
      closeAuthModal();
      if (typeof updateHeaderAuth === 'function') updateHeaderAuth();
      else location.reload();
    } else {
      showToast(result.message, 'error');
    }
  });
}

/**
 * Закрывает модальное окно авторизации
 */
function closeAuthModal() {
  const overlay = document.getElementById('authModal');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 400);
  }
}

/* =============================================
   Экспорт в глобальную область
   ============================================= */
window.AuthModule = {
  getCurrentUser,
  isLoggedIn,
  register,
  login,
  logout,
  toggleFavorite,
  isFavorite,
  getFavorites,
  addToHistory,
  getHistory,
  clearHistory,
  updateProfile,
  openAuthModal,
  validateEmail,
  showFormErrors
};

// Глобальные алиасы (используются из onclick и других модулей)
window.getCurrentUser = getCurrentUser;
window.isLoggedIn     = isLoggedIn;
window.toggleFavorite = toggleFavorite;
window.isFavorite     = isFavorite;
window.openAuthModal  = openAuthModal;
window.showToast      = window.showToast || function() {};
