/**
 * TECHROBOT — Основной модуль приложения
 * Содержит: утилиты, загрузку данных, форматирование дат, обработку ошибок
 */

'use strict';

/* =============================================
   Утилитарные функции
   ============================================= */

/**
 * Форматирует дату в читаемый вид на русском языке
 * @param {string} dateStr - дата в формате YYYY-MM-DD
 * @returns {string} - отформатированная дата
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Форматирует дату в краткий формат (День / Месяц сокр.)
 * @param {string} dateStr - дата в формате YYYY-MM-DD
 * @returns {{day: string, month: string}} - объект с днём и месяцем
 */
function formatDateShort(dateStr) {
  if (!dateStr) return { day: '', month: '' };
  const date = new Date(dateStr);
  const months = ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'];
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: months[date.getMonth()]
  };
}

/**
 * Форматирует большие числа (1000 -> 1K)
 * @param {number} num - число
 * @returns {string} - форматированное число
 */
function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

/**
 * Возвращает CSS-класс бейджа по категории
 * @param {string} category - идентификатор категории
 * @returns {string} - CSS-класс
 */
function getCategoryBadgeClass(category) {
  const map = {
    ai: 'badge-ai',
    robotics: 'badge-robotics',
    iot: 'badge-iot',
    vrar: 'badge-vrar',
    biotech: 'badge-biotech',
    drones: 'badge-drones'
  };
  return map[category] || 'badge-primary';
}

/**
 * Возвращает эмодзи-иконку категории
 * @param {string} category - идентификатор категории
 * @returns {string} - эмодзи
 */
function getCategoryIcon(category) {
  const icons = {
    ai: '🤖',
    robotics: '⚙️',
    iot: '📡',
    vrar: '🥽',
    biotech: '🧬',
    drones: '🚁'
  };
  return icons[category] || '💡';
}

/**
 * Экранирует HTML-спецсимволы для предотвращения XSS
 * @param {string} str - строка для экранирования
 * @returns {string} - безопасная строка
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Подсвечивает вхождения поискового запроса в тексте
 * @param {string} text - исходный текст
 * @param {string} query - поисковый запрос
 * @returns {string} - текст с подсветкой совпадений
 */
function highlightText(text, query) {
  if (!query || !text) return escapeHtml(text);
  const safeText = escapeHtml(text);
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safeQuery})`, 'gi');
  return safeText.replace(regex, '<mark class="highlight">$1</mark>');
}

/**
 * Дебаунс — откладывает выполнение функции
 * @param {Function} func - функция
 * @param {number} wait - задержка в мс
 * @returns {Function} - обёрнутая функция
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Получает параметр из URL
 * @param {string} name - имя параметра
 * @returns {string|null} - значение параметра
 */
function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/* =============================================
   Загрузка данных (fetch с обработкой ошибок)
   ============================================= */

/**
 * Загружает JSON-файл через fetch
 * @param {string} url - путь к файлу
 * @returns {Promise<any>} - распарсенные данные
 */
async function fetchData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status} при загрузке ${url}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    throw error;
  }
}

/**
 * Показывает блок загрузки в контейнере
 * @param {string} containerId - ID контейнера
 */
function showLoading(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="loading-block">
        <div class="spinner spinner-lg"></div>
        <p>Загрузка данных...</p>
      </div>
    `;
  }
}

/**
 * Показывает ошибку в контейнере
 * @param {string} containerId - ID контейнера
 * @param {string} message - текст ошибки
 */
function showError(containerId, message = 'Не удалось загрузить данные') {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Ошибка загрузки</div>
        <div class="empty-state-text">${escapeHtml(message)}</div>
        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Попробовать снова</button>
      </div>
    `;
  }
}

/**
 * Показывает пустое состояние
 * @param {string} containerId - ID контейнера
 * @param {string} icon - иконка
 * @param {string} title - заголовок
 * @param {string} text - текст описания
 */
function showEmpty(containerId, icon = '🔍', title = 'Ничего не найдено', text = '') {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-title">${title}</div>
        ${text ? `<div class="empty-state-text">${text}</div>` : ''}
      </div>
    `;
  }
}

/* =============================================
   Toast-уведомления
   ============================================= */

/**
 * Показывает toast-уведомление
 * @param {string} message - текст уведомления
 * @param {'success'|'error'|'info'} type - тип уведомления
 * @param {number} duration - длительность в мс (по умолчанию 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  // Создаём контейнер если его нет
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Иконки по типу
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  // Создаём toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-text">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Убираем через заданное время
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* =============================================
   Анимации появления при скролле (Intersection Observer)
   ============================================= */

/**
 * Инициализирует анимации появления элементов при скролле
 */
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Убираем наблюдение после появления
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  // Наблюдаем за всеми элементами с классом fade-in
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

/* =============================================
   Обработчики изображений (fallback при ошибке)
   ============================================= */

/**
 * Устанавливает обработчики ошибок для всех изображений на странице
 */
function initImageFallbacks() {
  document.querySelectorAll('img[data-fallback]').forEach(img => {
    img.onerror = function() {
      const fallback = this.getAttribute('data-fallback');
      if (fallback) {
        // Заменяем img на placeholder div
        const placeholder = document.createElement('div');
        placeholder.className = this.className + ' article-img-placeholder';
        placeholder.style.cssText = this.style.cssText;
        placeholder.innerHTML = fallback;
        this.parentNode.replaceChild(placeholder, this);
      }
    };
  });
}

/* =============================================
   Инициализация страницы
   ============================================= */

/**
 * Выполняется при загрузке DOM
 */
document.addEventListener('DOMContentLoaded', () => {
  // Инициализируем анимации скролла
  initScrollAnimations();
  // Инициализируем fallback изображений
  initImageFallbacks();
});

/* =============================================
   Экспорт (доступность глобально)
   ============================================= */

// Прямой глобальный доступ к часто используемым функциям
window.showToast = showToast;

window.AppUtils = {
  formatDate,
  formatDateShort,
  formatNumber,
  getCategoryBadgeClass,
  getCategoryIcon,
  escapeHtml,
  highlightText,
  debounce,
  getUrlParam,
  fetchData,
  showLoading,
  showError,
  showEmpty,
  showToast,
  initScrollAnimations
};
