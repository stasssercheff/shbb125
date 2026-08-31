
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

// Загрузка JSON
function loadData(sectionName, callback) {
  fetch(dataFiles[sectionName])
    .then(res => res.json())
    .then(data => callback(data))
    .catch(err => console.error(err));
}

// 🔄 Обновление таблицы при смене языка
function updateTablesByLang(lang) {
  currentLang = lang;
  renderSection('Preps');
}

// Отображение раздела
function renderSection(sectionName) {
  loadData(sectionName, data => createTable(data, sectionName));
}

// Название блюда с учётом языка
function getDishName(dish) {
  return dish.name?.[currentLang] || dish.name?.ru || dish.title || '';
}

// Вертикальный список ТТК: карточка раскрывается под названием
function createTable(data) {
  const tableContainer = document.querySelector('.table-container');
  tableContainer.innerHTML = '';

  const tocTitle = document.createElement('div');
  tocTitle.className = 'ttk-toc-title';
  tocTitle.setAttribute('data-i18n', 'ttk_toc');
  tocTitle.textContent =
    (typeof translations !== 'undefined' && translations.ttk_toc?.[currentLang]) ||
    (currentLang === 'en' ? 'Contents' : currentLang === 'vi' ? 'Mục lục' : 'Оглавление');
  tableContainer.appendChild(tocTitle);

  const accordion = document.createElement('div');
  accordion.className = 'ttk-accordion';
  tableContainer.appendChild(accordion);

  const recipes = data.recipes.filter(dish => !dish.hidden);
  const expandedIds = new Set(getExpandedIds());
  const savedAmounts = getSavedAmountsMap();

  recipes.forEach((dish, index) => {
    const cardId = `dish-${index}`;
    const dishName = getDishName(dish);

    const item = document.createElement('details');
    item.className = 'ttk-accordion-item';
    item.dataset.cardId = cardId;

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
