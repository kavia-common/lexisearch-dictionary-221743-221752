import { getDefaultLang, setStoredLang, t } from "./i18n";

function mockLs() {
  const store = {};
  const api = {
    getItem: jest.fn((k) => store[k] || null),
    setItem: jest.fn((k, v) => { store[k] = v; }),
    removeItem: jest.fn((k) => { delete store[k]; }),
    clear: jest.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
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
});

test("language persists in localStorage", () => {
  expect(getDefaultLang()).toBe("en");
  setStoredLang("hi");
  expect(getDefaultLang()).toBe("hi");
});

test("t() falls back to English for missing keys/languages", () => {
  expect(t("en", "search_btn")).toBeTruthy();
  expect(t("xx", "search_btn")).toBe(t("en", "search_btn"));
  expect(t("hi", "non_existing_key")).toBe(t("en", "non_existing_key") || "non_existing_key");
});
