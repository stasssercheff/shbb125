
// На главную
function goHome() {
  location.href = location.origin + '/' + location.pathname.split('/')[1] + '/';
}

// На уровень выше (одну папку вверх)
function goBack() {
  const currentPath = window.location.pathname;
  const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
  const upperPath = parentPath.substring(0, parentPath.lastIndexOf('/'));
  window.location.href = upperPath + '/index.html';
}

const dataFiles = {
  Preps: 'data/preps.json',
};

const POSITIONS_FILE = 'data/positions.json';

const STORAGE_PREFIX = 'pastry_ttk';
const EXPANDED_KEY = `${STORAGE_PREFIX}_expanded`;
const AMOUNTS_KEY = `${STORAGE_PREFIX}_amounts`;

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getExpandedIds() {
  return parseJson(sessionStorage.getItem(EXPANDED_KEY), []);
}

function setExpandedIds(ids) {
  sessionStorage.setItem(EXPANDED_KEY, JSON.stringify(ids));
}

function getSavedAmountsMap() {
  const local = parseJson(localStorage.getItem(AMOUNTS_KEY), {});
  const session = parseJson(sessionStorage.getItem(AMOUNTS_KEY), {});
  return { ...local, ...session };
}

function saveAmountsMap(map) {
  const serialized = JSON.stringify(map);
  sessionStorage.setItem(AMOUNTS_KEY, serialized);
  localStorage.setItem(AMOUNTS_KEY, serialized);
}

function readAmountsFromTable(table) {
  return [...table.querySelectorAll('tbody tr')].map(row => row.cells[2]?.textContent?.trim() ?? '');
}

function applyAmountsToTable(table, amounts) {
  if (!Array.isArray(amounts)) return;
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row, index) => {
    const cell = row.cells[2];
    if (!cell || amounts[index] == null || amounts[index] === '') return;
    cell.textContent = amounts[index];
  });
}

function persistCardAmounts(cardId, table) {
  const map = getSavedAmountsMap();
  map[cardId] = readAmountsFromTable(table);
  saveAmountsMap(map);
}

function rememberExpandedState(cardId, isOpen) {
  const expanded = new Set(getExpandedIds());
  if (isOpen) expanded.add(cardId);
  else expanded.delete(cardId);
  setExpandedIds([...expanded]);
}

function t(key, ru, en, vi) {
  if (typeof translations !== 'undefined' && translations[key]?.[currentLang]) {
    return translations[key][currentLang];
  }
  if (currentLang === 'en') return en;
  if (currentLang === 'vi') return vi;
  return ru;
}

function getLocalizedName(item) {
  return item?.name?.[currentLang] || item?.name?.ru || item?.title || '';
}

function loadPositions() {
  return fetch(POSITIONS_FILE)
    .then(res => (res.ok ? res.json() : { positions: [] }))
    .catch(() => ({ positions: [] }));
}

function setCardsOpen(cardNames, cardByRuName, open) {
  let firstOpened = null;

  cardNames.forEach(name => {
    const item = cardByRuName.get(name.trim());
    if (!item) return;

    item.open = open;
    rememberExpandedState(item.dataset.cardId, open);
    if (open && !firstOpened) firstOpened = item;
  });

  return firstOpened;
}

function isPositionFullyOpen(position, cardByRuName) {
  return position.cards.every(name => {
    const item = cardByRuName.get(name.trim());
    return item && item.open;
  });
}

function renderPositions(positionsData, cardByRuName) {
  const positions = (positionsData.positions || []).filter(p => Array.isArray(p.cards) && p.cards.length);
  if (!positions.length) return null;

  const block = document.createElement('section');
  block.className = 'ttk-positions-block';

  const title = document.createElement('div');
  title.className = 'ttk-positions-title';
  title.setAttribute('data-i18n', 'ttk_positions');
  title.textContent = t('ttk_positions', 'Позиции', 'Menu items', 'Món');
  block.appendChild(title);

  const hint = document.createElement('div');
  hint.className = 'ttk-positions-hint';
  hint.textContent = t(
    'ttk_positions_hint',
    'Нажмите позицию — раскроются все связанные карточки ниже. Повторный клик — свернуть.',
    'Click an item to expand all linked cards below. Click again to collapse.',
    'Nhấp món để mở tất cả thẻ liên quan bên dưới. Nhấp lại để thu gọn.'
  );
  block.appendChild(hint);

  const list = document.createElement('div');
  list.className = 'ttk-positions-list';

  positions.forEach(position => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ttk-position-btn';
    btn.textContent = getLocalizedName(position);

    if (isPositionFullyOpen(position, cardByRuName)) {
      btn.classList.add('is-active');
    }

    btn.addEventListener('click', () => {
      const shouldOpen = !btn.classList.contains('is-active');
      const first = setCardsOpen(position.cards, cardByRuName, shouldOpen);
      btn.classList.toggle('is-active', shouldOpen);

      if (shouldOpen && first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    list.appendChild(btn);
  });

  block.appendChild(list);
  return block;
}

// 🔄 Обновление таблицы при смене языка
function updateTablesByLang(lang) {
  currentLang = lang;
  renderSection('Preps');
}

// Отображение раздела
function renderSection(sectionName) {
  Promise.all([
    fetch(dataFiles[sectionName]).then(res => res.json()),
    loadPositions(),
  ])
    .then(([data, positionsData]) => createTable(data, positionsData))
    .catch(err => console.error(err));
}

// Название блюда с учётом языка
function getDishName(dish) {
  return getLocalizedName(dish);
}

// Вертикальный список ТТК: карточка раскрывается под названием
function createTable(data, positionsData) {
  const tableContainer = document.querySelector('.table-container');
  tableContainer.innerHTML = '';

  const cardByRuName = new Map();
  const recipes = data.recipes.filter(dish => !dish.hidden);
  const expandedIds = new Set(getExpandedIds());
  const savedAmounts = getSavedAmountsMap();

  const accordion = document.createElement('div');
  accordion.className = 'ttk-accordion';

  recipes.forEach((dish, index) => {
    const cardId = `dish-${index}`;
    const dishName = getDishName(dish);
    const cardNameRu = (dish.name?.ru || '').trim();

    const item = document.createElement('details');
    item.className = 'ttk-accordion-item';
    item.dataset.cardId = cardId;
    if (cardNameRu) item.dataset.cardNameRu = cardNameRu;

    const header = document.createElement('summary');
    header.className = 'ttk-accordion-header';
    header.textContent = dishName;

    const panel = document.createElement('div');
    panel.className = 'ttk-accordion-panel';

    const table = document.createElement('table');
    table.className = 'pf-table';

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const headers = currentLang === 'ru'
      ? ['#', 'Продукт', 'Гр/шт', 'Описание']
      : ['#', 'Ingredient', 'Gr/Pcs', 'Process'];

    const trHead = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);

    dish.ingredients.forEach((ing, i) => {
      const tr = document.createElement('tr');

      const tdNum = document.createElement('td');
      tdNum.textContent = i + 1;

      const tdName = document.createElement('td');
      tdName.textContent = currentLang === 'ru' ? ing['Продукт'] : ing['Ingredient'];

      const tdAmount = document.createElement('td');
      tdAmount.textContent = ing['Шт/гр'];
      tdAmount.dataset.base = ing['Шт/гр'];

      if (ing['Продукт'] === dish.key) {
        tdAmount.contentEditable = true;
        tdAmount.classList.add('key-ingredient');

        tdAmount.addEventListener('input', () => {
          let newVal = parseFloat(tdAmount.textContent.replace(/[^0-9.]/g, '')) || 0;
          if (parseFloat(tdAmount.dataset.base) === 0) tdAmount.dataset.base = 1;
          const factor = newVal / parseFloat(tdAmount.dataset.base);

          const rows = tdAmount.closest('table').querySelectorAll('tbody tr');
          rows.forEach(r => {
            const cell = r.cells[2];
            if (cell && cell !== tdAmount) {
              const base = parseFloat(cell.dataset.base) || 0;
              cell.textContent = Math.round(base * factor);
            }
          });

          persistCardAmounts(cardId, table);
        });

        tdAmount.addEventListener('keydown', e => {
          if (!/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight/.test(e.key)) {
            e.preventDefault();
          }
        });
      }

      tr.appendChild(tdNum);
      tr.appendChild(tdName);
      tr.appendChild(tdAmount);

      const tdDesc = document.createElement('td');
      if (i === 0) {
        tdDesc.textContent = dish.process?.[currentLang] || '';
        tdDesc.rowSpan = dish.ingredients.length;
        tr.appendChild(tdDesc);
      }

      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    panel.appendChild(table);
    item.appendChild(header);
    item.appendChild(panel);
    accordion.appendChild(item);

    if (cardNameRu) cardByRuName.set(cardNameRu, item);

    if (savedAmounts[cardId]) {
      applyAmountsToTable(table, savedAmounts[cardId]);
    }

    if (expandedIds.has(cardId)) {
      item.open = true;
    }

    item.addEventListener('toggle', () => {
      rememberExpandedState(cardId, item.open);
    });
  });

  const positionsBlock = renderPositions(positionsData, cardByRuName);
  if (positionsBlock) {
    tableContainer.appendChild(positionsBlock);
  }

  const allTitle = document.createElement('div');
  allTitle.className = 'ttk-toc-title';
  allTitle.setAttribute('data-i18n', 'ttk_all_cards');
  allTitle.textContent = t('ttk_all_cards', 'Все карточки', 'All cards', 'Tất cả thẻ');
  tableContainer.appendChild(allTitle);

  tableContainer.appendChild(accordion);
}

// ✅ Инициализация
document.addEventListener('DOMContentLoaded', () => {
  renderSection('Preps');

  const originalSwitchLang = window.switchLanguage;
  if (typeof originalSwitchLang === 'function') {
    window.switchLanguage = function (lang) {
      originalSwitchLang(lang);
      updateTablesByLang(lang);
    };
  }
});
