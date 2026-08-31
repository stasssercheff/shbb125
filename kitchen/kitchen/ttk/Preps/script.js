// ================== ЯЗЫК ==================
function getLang() {
  return localStorage.getItem("lang") || "ru";
}

function t(key, ru, en, vi) {
  const lang = getLang();
  if (typeof translations !== "undefined" && translations[key]?.[lang]) {
    return translations[key][lang];
  }
  if (lang === "en") return en;
  if (lang === "vi") return vi;
  return ru;
}

// ================== НАВИГАЦИЯ ==================
function goHome() {
  location.href = location.origin + "/" + location.pathname.split("/")[1] + "/";
}

function goBack() {
  const path = location.pathname;
  const parent = path.substring(0, path.lastIndexOf("/"));
  const upper = parent.substring(0, parent.lastIndexOf("/"));
  location.href = upper + "/index.html";
}

// ================== DATA ==================
const DATA_FILE = "data/preps.json";
const STORAGE_PREFIX = "kitchen_preps";
const EXPANDED_KEY = `${STORAGE_PREFIX}_expanded`;
const AMOUNTS_KEY = `${STORAGE_PREFIX}_amounts`;

let cachedData = null;

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
  return [...table.querySelectorAll("tbody tr")].map(row => row.cells[2]?.textContent?.trim() ?? "");
}

function applyAmountsToTable(table, amounts) {
  if (!Array.isArray(amounts)) return;
  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((row, index) => {
    const cell = row.cells[2];
    if (!cell || amounts[index] == null || amounts[index] === "") return;
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

// ================== LOAD JSON ==================
function loadData() {
  if (cachedData) {
    renderPreps(cachedData);
    return;
  }

  fetch(DATA_FILE)
    .then(r => r.json())
    .then(data => {
      cachedData = data;
      renderPreps(data);
    })
    .catch(err => console.error("JSON load error:", err));
}

// ================== RENDER ==================
function renderPreps(data) {
  const lang = getLang();
  const container = document.querySelector(".table-container");
  if (!container) return;

  container.innerHTML = "";

  const title = document.createElement("div");
  title.className = "ttk-toc-title";
  title.setAttribute("data-i18n", "ttk_all_cards");
  title.textContent = t("ttk_all_cards", "Все карточки", "All cards", "Tất cả thẻ");
  container.appendChild(title);

  const accordion = document.createElement("div");
  accordion.className = "ttk-accordion";
  container.appendChild(accordion);

  const recipes = (data.recipes || []).filter(dish => dish.enabled !== false);
  const expandedIds = new Set(getExpandedIds());
  const savedAmounts = getSavedAmountsMap();

  recipes.forEach((dish, index) => {
    const cardId = `dish-${index}`;
    const dishName = dish.name?.[lang] || dish.name?.ru || dish.title || "";

    const item = document.createElement("details");
    item.className = "ttk-accordion-item";
    item.dataset.cardId = cardId;

    const header = document.createElement("summary");
    header.className = "ttk-accordion-header";
    header.textContent = dishName;

    const panel = document.createElement("div");
    panel.className = "ttk-accordion-panel";

    const table = document.createElement("table");
    table.className = "pf-table";

    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");

    const headers =
      lang === "ru"
        ? ["#", "Продукт", "Гр/шт", "Описание"]
        : lang === "vi"
          ? ["#", "Nguyên liệu", "Gr/Pcs", "Mô tả"]
          : ["#", "Ingredient", "Gr/Pcs", "Process"];

    const trh = document.createElement("tr");
    headers.forEach(h => {
      const th = document.createElement("th");
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);

    dish.ingredients.forEach((ing, i) => {
      const tr = document.createElement("tr");

      const tdNum = document.createElement("td");
      tdNum.textContent = ing["№"] ?? i + 1;

      const tdName = document.createElement("td");
      if (lang === "ru") {
        tdName.textContent = ing["Продукт"] || "";
      } else if (lang === "vi") {
        tdName.textContent = ing["Ingredient_vi"] || ing["Ingredient"] || ing["Продукт"] || "";
      } else {
        tdName.textContent = ing["Ingredient"] || ing["Продукт"] || "";
      }

      const tdAmount = document.createElement("td");
      tdAmount.textContent = ing["Шт/гр"];
      tdAmount.dataset.base = ing["Шт/гр"];

      if (ing["Продукт"] === dish.key) {
        tdAmount.contentEditable = true;
        tdAmount.classList.add("key-ingredient");

        tdAmount.addEventListener("input", () => {
          const newVal = parseFloat(tdAmount.textContent.replace(/[^0-9.]/g, "")) || 0;
          const baseVal = parseFloat(tdAmount.dataset.base) || 1;
          const factor = newVal / baseVal;

          tbody.querySelectorAll("tr").forEach(r => {
            const cell = r.children[2];
            if (cell && cell !== tdAmount) {
              const base = parseFloat(cell.dataset.base) || 0;
              cell.textContent = Math.round(base * factor);
            }
          });

          persistCardAmounts(cardId, table);
        });

        tdAmount.addEventListener("keydown", e => {
          if (!/[0-9]|Backspace|Delete|ArrowLeft|ArrowRight/.test(e.key)) {
            e.preventDefault();
          }
        });
      }

      tr.appendChild(tdNum);
      tr.appendChild(tdName);
      tr.appendChild(tdAmount);

      if (i === 0) {
        const tdDesc = document.createElement("td");
        tdDesc.textContent = dish.process?.[lang] || dish.process?.ru || "";
        tdDesc.rowSpan = dish.ingredients.length;
        tr.appendChild(tdDesc);
      }

      tbody.appendChild(tr);
    });

    table.append(thead, tbody);
    panel.appendChild(table);
    item.append(header, panel);
    accordion.appendChild(item);

    if (savedAmounts[cardId]) {
      applyAmountsToTable(table, savedAmounts[cardId]);
    }

    if (expandedIds.has(cardId)) {
      item.open = true;
    }

    item.addEventListener("toggle", () => {
      rememberExpandedState(cardId, item.open);
    });
  });
}

// ================== INIT ==================
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setTimeout(() => {
        if (cachedData) renderPreps(cachedData);
      }, 0);
    });
  });
});
