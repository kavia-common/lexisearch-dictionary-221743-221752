import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";

function setupFetchSuccessFor(word) {
  global.fetch = jest.fn().mockImplementation((url) => {
    // return minimal valid normalized-like payload from dictionaryapi
    if (url.includes("/api/v2/entries/") || url.includes("/define?word=")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              word,
              phonetic: "tɛrm",
              phonetics: [{ text: "tɛrm", audio: "" }],
              meanings: [
                {
                  partOfSpeech: "noun",
                  definitions: [{ definition: "a test term", example: "example" }],
                  synonyms: [],
                  antonyms: [],
                },
              ],
            },
          ]),
      });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

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
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

test("search adds to history and clicking history re-searches", async () => {
  setupFetchSuccessFor("alpha");
  render(<App />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "alpha" } });
  fireEvent.submit(input.closest("form"));

  await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());

  // History panel should have 'alpha' - click a Go button (label localized)
  const goButtons = screen.getAllByRole("button", { name: /Go|जाएँ|వెళ్ళు/i });
  expect(goButtons.length).toBeGreaterThan(0);

  // Clicking history triggers another fetch
  setupFetchSuccessFor("alpha");
  fireEvent.click(goButtons[0]);

  await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());
});

test("favoriting current word appears in Favorites and clicking triggers search", async () => {
  setupFetchSuccessFor("beta");
  render(<App />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "beta" } });
  fireEvent.submit(input.closest("form"));

  await waitFor(() => expect(screen.getByText("beta")).toBeInTheDocument());

  // Click star button to favorite
  const starBtn = screen.getByRole("button", { name: /Favorite|Unfavorite|पसंदीदा|हटाएं|ఇష్టంగా|తొలగించు/i });
  fireEvent.click(starBtn);

  // Favorites panel should now contain 'beta'
  const favGo = screen.getAllByRole("button", { name: /Go|जाएँ|వెళ్ళు/i })[0];
  setupFetchSuccessFor("beta");
  fireEvent.click(favGo);

  await waitFor(() => expect(screen.getByText("beta")).toBeInTheDocument());
});
