//
// Local storage utilities with safety guards and in-memory fallback.
//

const HISTORY_KEY = "ls_history_v1";
const FAVORITES_KEY = "ls_favorites_v1";

// In-memory fallbacks if localStorage is unavailable or throws.
let mem = {
  [HISTORY_KEY]: [],
  [FAVORITES_KEY]: [],
};

// Safe JSON parse
function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : fallback;
  } catch (_) {
    return fallback;
  }
}

// Safe localStorage get
function getLs(key) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      return raw ? safeParse(raw, []) : [];
    }
  } catch (_) {}
  return Array.isArray(mem[key]) ? mem[key] : [];
}

// Safe localStorage set
function setLs(key, value) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    } else {
      mem[key] = value;
    }
  } catch (_) {
    mem[key] = value;
  }
}

// Normalize word key
function norm(w) {
  return (w || "").toString().trim().toLowerCase();
}

// PUBLIC_INTERFACE
export function getHistory() {
  /** Returns recent search history list: [{ term, ts }] most-recent-first. */
  const raw = getLs(HISTORY_KEY);
  // Validate shape
  return raw
    .filter((i) => i && typeof i.term === "string" && typeof i.ts === "number")
    .slice(0, 20);
}

// PUBLIC_INTERFACE
export function addToHistory(term) {
  /** Add/refresh a term in history with current timestamp; keeps max 20 and unique terms. */
  const t = norm(term);
  if (!t) return getHistory();
  const now = Date.now();
  const list = getHistory().filter((i) => norm(i.term) !== t);
  list.unshift({ term: t, ts: now });
  const trimmed = list.slice(0, 20);
  setLs(HISTORY_KEY, trimmed);
  return trimmed;
}

// PUBLIC_INTERFACE
export function removeFromHistory(term) {
  /** Remove a term from history. */
  const t = norm(term);
  const list = getHistory().filter((i) => norm(i.term) !== t);
  setLs(HISTORY_KEY, list);
  return list;
}

// PUBLIC_INTERFACE
export function clearHistory() {
  /** Clears entire search history. */
  setLs(HISTORY_KEY, []);
  return [];
}

// PUBLIC_INTERFACE
export function getFavorites() {
  /** Returns favorites as ordered list of strings (most-recent-first). */
  const raw = getLs(FAVORITES_KEY);
  return raw.filter((w) => typeof w === "string").map(norm);
}

// PUBLIC_INTERFACE
export function toggleFavorite(term) {
  /** Toggle favorite for a term; returns { list, isFav }. */
  const t = norm(term);
  if (!t) return { list: getFavorites(), isFav: false };
  const current = getFavorites();
  const idx = current.indexOf(t);
  let next;
  let isFav;
  if (idx >= 0) {
    next = current.filter((x) => x !== t);
    isFav = false;
  } else {
    next = [t, ...current]; // most recent first
    isFav = true;
  }
  setLs(FAVORITES_KEY, next);
  return { list: next, isFav };
}

// PUBLIC_INTERFACE
export function removeFavorite(term) {
  /** Remove a single favorite item. */
  const t = norm(term);
  const next = getFavorites().filter((x) => x !== t);
  setLs(FAVORITES_KEY, next);
  return next;
}

// PUBLIC_INTERFACE
export function clearFavorites() {
  /** Clears all favorites. */
  setLs(FAVORITES_KEY, []);
  return [];
}

// PUBLIC_INTERFACE
export function isFavorite(term) {
  /** Returns boolean if term is in favorites. */
  const t = norm(term);
  return getFavorites().includes(t);
}

// PUBLIC_INTERFACE
export function timeAgo(ts) {
  /** Convert a timestamp to a human-friendly relative time string. */
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
