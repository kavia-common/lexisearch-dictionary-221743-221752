import { addToHistory, getHistory, clearHistory, getFavorites, toggleFavorite, clearFavorites } from "./storage";

function mockLs() {
  const store = {};
  const api = {
    getItem: jest.fn((k) => store[k] || null),
    setItem: jest.fn((k, v) => {
      store[k] = v;
    }),
    removeItem: jest.fn((k) => {
      delete store[k];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
  };
  Object.defineProperty(window, "localStorage", {
    value: api,
    configurable: true,
    writable: true,
  });
  return { store, api };
}

beforeEach(() => {
  mockLs();
  clearHistory();
  clearFavorites();
});

test("history adds unique terms and caps at 20", () => {
  for (let i = 0; i < 25; i++) {
    addToHistory("term" + i);
  }
  const h = getHistory();
  expect(h.length).toBe(20);
  // Most recent first
  expect(h[0].term).toBe("term24");
  // Re-adding moves to top without duplicates
  addToHistory("term10");
  const h2 = getHistory();
  expect(h2[0].term).toBe("term10");
  expect(h2.filter((x) => x.term === "term10").length).toBe(1);
});

test("favorites toggles and orders correctly", () => {
  expect(getFavorites()).toEqual([]);
  let r1 = toggleFavorite("alpha");
  expect(r1.isFav).toBe(true);
  expect(getFavorites()).toEqual(["alpha"]);
  let r2 = toggleFavorite("beta");
  expect(r2.list).toEqual(["beta", "alpha"]);
  let r3 = toggleFavorite("alpha"); // remove
  expect(r3.isFav).toBe(false);
  expect(getFavorites()).toEqual(["beta"]);
});
