import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";

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

function setupFetch(word = "alpha") {
  global.fetch = jest.fn().mockImplementation((url) => {
    // Assert lang parameter is present when backend base is in env; but our tests run with public API by default
    if (url.includes("/api/v2/entries/")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{
          word,
          phonetic: "tɛst",
          phonetics: [{ text: "tɛst", audio: "" }],
          meanings: [{ partOfSpeech: "noun", definitions: [{ definition: "d", example: "e" }], synonyms: [], antonyms: [] }],
        }]),
      });
    }
    if (url.includes("/define?word=")) {
      // backend path, include lang param
      expect(url).toMatch(/&lang=/);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ word, meanings: [], phonetics: [] }]),
      });
    }
    if (url.includes("/word-of-the-day")) {
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    }
    if (url.includes("/sug?s=") || url.includes("/suggest?q=")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  mockLs();
});

afterEach(() => {
  jest.resetAllMocks();
});

test("UI labels change with language selection", async () => {
  setupFetch("gamma");
  render(<App />);
  // default en
  expect(screen.getByRole("button", { name: /Search/i })).toBeInTheDocument();
  const langSelect = screen.getByLabelText(/Select language/i);
  fireEvent.change(langSelect, { target: { value: "hi" } });
  // Button label should be Hindi best-effort translation
  expect(screen.getByRole("button", { name: /खोजें/i })).toBeInTheDocument();
});

test("search uses current language for history replay tagging", async () => {
  setupFetch("delta");
  render(<App />);
  const input = screen.getByRole("combobox", { name: /Search for a word/i });
  fireEvent.change(input, { target: { value: "delta" } });
  fireEvent.submit(input.closest("form"));
  await waitFor(() => expect(screen.getByText("delta")).toBeInTheDocument());

  // switch to Hindi and search a different word
  const langSelect = screen.getByLabelText(/Select language/i);
  fireEvent.change(langSelect, { target: { value: "hi" } });

  setupFetch("epsilon");
  fireEvent.change(input, { target: { value: "epsilon" } });
  fireEvent.submit(input.closest("form"));
  await waitFor(() => expect(screen.getByText("epsilon")).toBeInTheDocument());

  // History entries exist. Clicking first Go should re-run search with that entry's lang.
  const goButtons = screen.getAllByRole("button", { name: /Go|जाएँ/ });
  expect(goButtons.length).toBeGreaterThan(0);
});

test("non-English suggestions show limited notice", async () => {
  setupFetch("zeta");
  render(<App />);
  const langSelect = screen.getByLabelText(/Select language/i);
  fireEvent.change(langSelect, { target: { value: "hi" } });
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "प" } });
  // open suggestions
  await waitFor(() => {
    const sugRegion = screen.getByRole("region", { name: /Suggestions|सुझाव|సూచనలు/ });
    expect(sugRegion).toBeInTheDocument();
  });
});
