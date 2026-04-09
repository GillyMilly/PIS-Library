const STORAGE_KEY = "pis-library:v1";

/** @typedef {{ id: string, pitanje: string, odgovor: string, slika?: string, slikaAlt?: string, _search?: string }} QAItem */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function normalize(text) {
  return (text ?? "").toString().trim().toLowerCase();
}

function formatPitanjaCount(n) {
  const num = Number(n) || 0;
  const mod10 = num % 10;
  const mod100 = num % 100;
  if (mod10 === 1 && mod100 !== 11) return `${num} pitanje`;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return `${num} pitanja`;
  return `${num} pitanja`;
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = safeJsonParse(raw, {});
  if (!parsed || typeof parsed !== "object") return {};
  return parsed;
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getItemState(state, id) {
  const s = state?.[id];
  const counter = clamp(Number(s?.counter ?? 0) || 0, 0, 10);
  const checked = Boolean(s?.checked ?? false);
  return { counter, checked };
}

function setItemState(state, id, next) {
  state[id] = {
    counter: clamp(Number(next.counter ?? 0) || 0, 0, 10),
    checked: Boolean(next.checked ?? false),
  };
  saveState(state);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === false || v == null) continue;
    else node.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function makeChevron() {
  // simple inline SVG chevron
  const svg = el("svg", { width: "16", height: "16", viewBox: "0 0 24 24", "aria-hidden": "true" });
  const path = el("path", {
    d: "M6.7 9.3a1 1 0 0 1 1.4 0L12 13.2l3.9-3.9a1 1 0 1 1 1.4 1.4l-4.6 4.6a1 1 0 0 1-1.4 0L6.7 10.7a1 1 0 0 1 0-1.4Z",
    fill: "currentColor",
  });
  svg.appendChild(path);
  return svg;
}

function renderCard(item, state, onStateChange) {
  const { counter, checked } = getItemState(state, item.id);

  const card = el("article", {
    class: "card",
    dataset: { id: item.id, open: "false", checked: checked ? "true" : "false", selected: "false" },
  });

  const qbtn = el(
    "button",
    {
      class: "qbtn",
      type: "button",
      "aria-expanded": "false",
      "aria-controls": `ans-${item.id}`,
    },
    [
      el("span", { class: "qbtn__chev", "aria-hidden": "true" }, [makeChevron()]),
      el("h2", { class: "qbtn__title" }, [item.pitanje]),
    ],
  );

  const counterValue = el("span", { class: "counter__value", "aria-live": "polite" }, [String(counter)]);

  const decBtn = el("button", { class: "counter__btn", type: "button", "aria-label": "Smanji brojač" }, ["−"]);
  const incBtn = el("button", { class: "counter__btn", type: "button", "aria-label": "Povećaj brojač" }, ["+"]);

  function updateCounter(next) {
    const v = clamp(next, 0, 10);
    counterValue.textContent = String(v);
    onStateChange(item.id, { counter: v, checked: checkbox.checked });
  }

  // Prevent clicks in controls from toggling accordion
  for (const btn of [decBtn, incBtn]) {
    btn.addEventListener("click", (e) => e.stopPropagation());
    btn.addEventListener("mousedown", (e) => e.stopPropagation());
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  decBtn.addEventListener("click", () => updateCounter(Number(counterValue.textContent) - 1));
  incBtn.addEventListener("click", () => updateCounter(Number(counterValue.textContent) + 1));

  const counterWrap = el("div", { class: "counter" }, [decBtn, counterValue, incBtn]);

  const checkbox = el("input", { type: "checkbox" });
  checkbox.checked = checked;

  const checkWrap = el("label", { class: "check" }, [checkbox, el("span", {}, ["pitala"])]);

  // Prevent checkbox interactions from toggling accordion
  for (const node of [checkWrap, checkbox]) {
    node.addEventListener("click", (e) => e.stopPropagation());
    node.addEventListener("mousedown", (e) => e.stopPropagation());
    node.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  checkbox.addEventListener("change", () => {
    card.dataset.checked = checkbox.checked ? "true" : "false";
    onStateChange(item.id, { counter: Number(counterValue.textContent), checked: checkbox.checked });
  });

  const controls = el("div", { class: "controls" }, [checkWrap, counterWrap]);

  const header = el("div", { class: "card__header" }, [qbtn, controls]);

  const answerInnerChildren = [item.odgovor];
  if (item.slika) {
    const img = el("img", {
      src: item.slika,
      alt: String(item.slikaAlt ?? item.pitanje ?? "Skica"),
      loading: "lazy",
      decoding: "async",
    });
    answerInnerChildren.push(el("div", { class: "answer__media" }, [img]));
  }

  const answer = el("div", { class: "answer", id: `ans-${item.id}` }, [
    el("div", { class: "answer__inner" }, answerInnerChildren),
  ]);

  function setOpen(nextOpen) {
    card.dataset.open = nextOpen ? "true" : "false";
    qbtn.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  }

  qbtn.addEventListener("click", () => {
    const next = card.dataset.open !== "true";
    setOpen(next);
  });

  card.appendChild(header);
  card.appendChild(answer);
  return card;
}

async function loadData() {
  const res = await fetch("./data.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load data.json (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter((x) => x && typeof x === "object")
    .map((x) => ({
      id: String(x.id ?? ""),
      pitanje: String(x.pitanje ?? ""),
      odgovor: String(x.odgovor ?? ""),
      slika: x.slika ? String(x.slika) : undefined,
      slikaAlt: x.slikaAlt ? String(x.slikaAlt) : undefined,
    }))
    .filter((x) => x.id && x.pitanje)
    .map((x) => ({ ...x, _search: normalize(`${x.pitanje} ${x.odgovor}`) }));
}

function updateMeta(resultsCountEl, count, total, query) {
  const q = normalize(query);
  if (!q) resultsCountEl.textContent = formatPitanjaCount(total);
  else resultsCountEl.textContent = `${count} / ${total} rezultata`;
}

function updateEmptyState(emptyEl, subtitleEl, count, query) {
  const q = normalize(query);
  const show = count === 0;
  emptyEl.hidden = !show;
  if (!show) return;
  subtitleEl.textContent = q ? `Nema rezultata za “${query.trim()}”.` : "Nema dostupnih pitanja.";
}

function main() {
  const cardsEl = document.getElementById("cards");
  const searchEl = document.getElementById("searchInput");
  const resultsCountEl = document.getElementById("resultsCount");
  const emptyEl = document.getElementById("emptyState");
  const emptySubtitleEl = document.getElementById("emptyStateSubtitle");
  const clearAllBtn = document.getElementById("clearAllBtn");

  if (!cardsEl || !searchEl || !resultsCountEl || !emptyEl || !emptySubtitleEl || !clearAllBtn) return;

  const state = loadState();
  /** @type {QAItem[]} */
  let allItems = [];
  /** @type {Map<string, HTMLElement>} */
  const cardById = new Map();
  /** @type {string | null} */
  let selectedId = null;

  function onStateChange(id, next) {
    setItemState(state, id, next);
  }

  function buildOnce() {
    cardById.clear();
    const nodes = [];
    for (const it of allItems) {
      const node = renderCard(it, state, onStateChange);
      cardById.set(it.id, node);
      nodes.push(node);
    }
    cardsEl.replaceChildren(...nodes);
  }

  // Mark last-clicked question (visual cue on left chevron).
  cardsEl.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
    const qbtn = target?.closest?.(".qbtn");
    if (!qbtn) return;

    const card = qbtn.closest?.(".card");
    const id = card?.dataset?.id;
    if (!id) return;

    if (selectedId && selectedId !== id) {
      const prev = cardById.get(selectedId);
      if (prev) prev.dataset.selected = "false";
    }

    selectedId = id;
    if (card) card.dataset.selected = "true";
  });

  function applySearchFilter() {
    const qRaw = searchEl.value;
    const q = normalize(qRaw);
    let visible = 0;
    for (const it of allItems) {
      const node = cardById.get(it.id);
      if (!node) continue;
      const match = !q || (it._search ?? "").includes(q);
      node.hidden = !match;
      if (match) visible += 1;
    }
    updateMeta(resultsCountEl, visible, allItems.length, qRaw);
    updateEmptyState(emptyEl, emptySubtitleEl, visible, qRaw);
  }

  let searchTimer = 0;
  searchEl.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(applySearchFilter, 80);
  });

  clearAllBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    const keys = Object.keys(state);
    for (const k of keys) delete state[k];
    buildOnce();
    applySearchFilter();
  });

  loadData()
    .then((items) => {
      allItems = items;
      buildOnce();
      applySearchFilter();
    })
    .catch(() => {
      allItems = [];
      buildOnce();
      applySearchFilter();
    });
}

document.addEventListener("DOMContentLoaded", main);

