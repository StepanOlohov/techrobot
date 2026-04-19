/**
 * TECHROBOT — Скрипт каталога роботов
 * Загрузка, фильтрация по типу, поиск, детальный просмотр
 */

'use strict';

let allRobots = [];
let filteredRobots = [];
let currentType = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  await loadRobots();
  initFilters();
  initSearch();

  // Проверяем URL параметр для открытия конкретного робота
  const robotId = parseInt(AppUtils.getUrlParam('id'), 10);
  if (robotId) {
    setTimeout(() => openRobotModal(robotId), 500);
  }
});

/* =============================================
   Загрузка данных
   ============================================= */
async function loadRobots() {
  AppUtils.showLoading('robotsGrid');
  try {
    allRobots = await AppUtils.fetchData('data/robots.json');
    filteredRobots = [...allRobots];
    renderRobots();
  } catch (err) {
    AppUtils.showError('robotsGrid', 'Не удалось загрузить каталог роботов');
  }
}

/* =============================================
   Рендеринг карточек
   ============================================= */
function renderRobots() {
  const container = document.getElementById('robotsGrid');
  const countEl = document.getElementById('robotsCount');
  if (!container) return;

  if (countEl) countEl.textContent = `${filteredRobots.length} роботов`;

  if (filteredRobots.length === 0) {
    AppUtils.showEmpty('robotsGrid', '🤖', 'Роботы не найдены', 'Попробуйте изменить фильтры');
    return;
  }

  container.innerHTML = filteredRobots.map(robot => buildRobotCard(robot)).join('');
  AppUtils.initScrollAnimations();
}

function buildRobotCard(robot) {
  const typeIcons = {
    research:  '🔬',
    service:   '🤝',
    medical:   '🏥',
    military:  '🎖️',
    household: '🏠',
    industrial:'⚙️'
  };

  const typeBadges = {
    research:  'badge-primary',
    service:   'badge-iot',
    medical:   'badge-biotech',
    military:  'badge-drones',
    household: 'badge-vrar',
    industrial:'badge-robotics'
  };

  const icon = typeIcons[robot.type] || '🤖';
  const badgeClass = typeBadges[robot.type] || 'badge-primary';

  return `
    <div class="robot-card fade-in" onclick="openRobotModal(${robot.id})" style="cursor:pointer;" role="button" tabindex="0" aria-label="${AppUtils.escapeHtml(robot.name)}">
      <div class="robot-card-img-wrapper">
        ${robot.image
          ? `<img src="${AppUtils.escapeHtml(robot.image)}" alt="${AppUtils.escapeHtml(robot.name)}" class="robot-card-img" loading="lazy" onerror="this.outerHTML='<div class=\\'robot-img-placeholder\\'><span style=\\'font-size:5rem;\\'>${icon}</span></div>'">`
          : `<div class="robot-img-placeholder"><span style="font-size:5rem;">${icon}</span></div>`}
        <div class="robot-card-type">
          <span class="badge ${badgeClass}">${AppUtils.escapeHtml(robot.typeLabel)}</span>
        </div>
      </div>
      <div class="robot-card-body">
        <div class="robot-card-manufacturer">${AppUtils.escapeHtml(robot.manufacturer)} · ${robot.year}</div>
        <h3 class="robot-card-name">${AppUtils.escapeHtml(robot.name)}</h3>
        <p class="robot-card-desc">${AppUtils.escapeHtml(robot.description)}</p>
        <div class="robot-specs-grid">
          <div class="robot-spec-item">
            <div class="robot-spec-label">Высота</div>
            <div class="robot-spec-value">${AppUtils.escapeHtml(robot.specs.height)}</div>
          </div>
          <div class="robot-spec-item">
            <div class="robot-spec-label">Масса</div>
            <div class="robot-spec-value">${AppUtils.escapeHtml(robot.specs.weight)}</div>
          </div>
          <div class="robot-spec-item">
            <div class="robot-spec-label">Автономность</div>
            <div class="robot-spec-value">${AppUtils.escapeHtml(robot.specs.battery)}</div>
          </div>
          <div class="robot-spec-item">
            <div class="robot-spec-label">Страна</div>
            <div class="robot-spec-value">${AppUtils.escapeHtml(robot.country)}</div>
          </div>
        </div>
      </div>
      <div class="robot-card-footer">
        <span class="robot-card-price">${AppUtils.escapeHtml(robot.price)}</span>
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openRobotModal(${robot.id})">Подробнее</button>
      </div>
    </div>
  `;
}

/* =============================================
   Модальное окно с деталями робота
   ============================================= */
function openRobotModal(robotId) {
  const robot = allRobots.find(r => r.id === robotId);
  if (!robot) return;

  const typeIcons = { research:'🔬', service:'🤝', medical:'🏥', military:'🎖️', household:'🏠', industrial:'⚙️' };
  const icon = typeIcons[robot.type] || '🤖';

  const specsHtml = Object.entries(robot.specs).map(([key, val]) => {
    const labels = { height:'Высота', weight:'Масса', payload:'Нагрузка', battery:'Автономность', speed:'Скорость', dof:'Степени свободы', sensors:'Сенсоры' };
    return `
      <div class="robot-spec-item" style="margin-bottom:0.5rem;">
        <div class="robot-spec-label">${labels[key] || key}</div>
        <div class="robot-spec-value">${AppUtils.escapeHtml(val)}</div>
      </div>
    `;
  }).join('');

  const tagsHtml = (robot.tags || []).map(t =>
    `<span class="tag">#${AppUtils.escapeHtml(t)}</span>`
  ).join('');

  const modalHtml = `
    <div class="modal-overlay active" id="robotModal">
      <div class="modal" style="max-width:640px;" role="dialog" aria-modal="true" aria-label="${AppUtils.escapeHtml(robot.name)}">
        <div class="modal-header">
          <div>
            <div style="font-size:0.8rem;color:var(--primary);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">
              ${AppUtils.escapeHtml(robot.manufacturer)} · ${robot.year}
            </div>
            <h2 class="modal-title">${AppUtils.escapeHtml(robot.name)}</h2>
          </div>
          <button class="modal-close" onclick="closeRobotModal()" aria-label="Закрыть">×</button>
        </div>

        <!-- Картинка робота -->
        <div style="display:flex;align-items:center;justify-content:center;height:300px;background:linear-gradient(135deg,var(--bg-dark2),var(--bg-card));border-radius:var(--radius-lg);margin-bottom:1.5rem;overflow:hidden;padding:0.5rem;">
          ${robot.image
            ? `<img src="${AppUtils.escapeHtml(robot.image)}" alt="${AppUtils.escapeHtml(robot.name)}" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;" onerror="this.outerHTML='<span style=\\'font-size:6rem;\\'>${icon}</span>'">`
            : `<span style="font-size:6rem;">${icon}</span>`}
        </div>

        <!-- Описание -->
        <p style="color:var(--text-secondary);line-height:1.7;margin-bottom:1.5rem;">${AppUtils.escapeHtml(robot.description)}</p>

        <!-- Назначение -->
        <div style="margin-bottom:1.25rem;">
          <div style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.35rem;">Назначение</div>
          <div style="color:var(--text-primary);font-size:0.95rem;">${AppUtils.escapeHtml(robot.purpose)}</div>
        </div>

        <!-- Цена -->
        <div style="margin-bottom:1.5rem;">
          <div style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.35rem;">Стоимость</div>
          <div style="font-size:1.2rem;font-weight:800;color:var(--primary);">${AppUtils.escapeHtml(robot.price)}</div>
        </div>

        <!-- Характеристики -->
        <div style="margin-bottom:1.5rem;">
          <div style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem;">Характеристики</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">${specsHtml}</div>
        </div>

        <!-- Теги -->
        ${tagsHtml ? `<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">${tagsHtml}</div>` : ''}
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Закрытие по клику на фон
  document.getElementById('robotModal').addEventListener('click', e => {
    if (e.target.id === 'robotModal') closeRobotModal();
  });

  // Закрытие по Escape
  const escHandler = e => {
    if (e.key === 'Escape') { closeRobotModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}

function closeRobotModal() {
  const modal = document.getElementById('robotModal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 400);
  }
}

window.openRobotModal  = openRobotModal;
window.closeRobotModal = closeRobotModal;

/* =============================================
   Фильтрация и поиск
   ============================================= */
function initFilters() {
  document.querySelectorAll('.filter-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentType = btn.dataset.type;
      document.querySelectorAll('.filter-btn[data-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });
}

function initSearch() {
  const searchInput = document.getElementById('robotsSearch');
  if (!searchInput) return;
  const debouncedSearch = AppUtils.debounce(() => applyFilters(), 300);
  searchInput.addEventListener('input', debouncedSearch);
}

function applyFilters() {
  const query = ((document.getElementById('robotsSearch') || {}).value || '').toLowerCase().trim();

  let result = currentType === 'all'
    ? [...allRobots]
    : allRobots.filter(r => r.type === currentType);

  if (query.length >= 2) {
    result = result.filter(r =>
      r.name.toLowerCase().includes(query) ||
      r.manufacturer.toLowerCase().includes(query) ||
      r.purpose.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query) ||
      (r.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }

  filteredRobots = result;
  renderRobots();
}
