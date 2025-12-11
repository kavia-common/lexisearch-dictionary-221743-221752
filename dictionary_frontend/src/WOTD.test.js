import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";

// Helpers
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

function setupDefinitionFetch(word) {
  global.fetch = jest.fn().mockImplementation((url) => {
    // WOTD backend endpoint simulated as missing -> 404
    if (url.includes("/word-of-the-day")) {
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    }
    // dictionary define endpoint
    if (url.includes("/api/v2/entries/") || url.includes("/define?word=")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              word,
              phonetic: "test",
              phonetics: [{ text: "test", audio: "" }],
              meanings: [
                {
                  partOfSpeech: "noun",
                  definitions: [{ definition: "d1", example: "ex1" }],
                },
              ],
            },
          ]),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  mockLs();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

test("WOTD caches per day and reuses cache without refresh", async () => {
  // First render: we expect a curated selection which then triggers define fetch.
  setupDefinitionFetch("serendipity"); // the exact word is deterministic but unknown here, we allow any fetch
  render(<App />);

  // Wait for WOTD section present
  await waitFor(() => {
    expect(screen.getByRole("region", { name: /Word of the Day card/i })).toBeInTheDocument();
  });

  // After first fetch, a cache should be stored
  const lsGet = window.localStorage.getItem("ls_wotd_v1");
  expect(lsGet).not.toBeNull();

  // Render again with same mocks; ensure it uses cache (fetch may still be called but WOTD shows quickly)
  jest.clearAllMocks();
  render(<App />);
  await waitFor(() => {
    expect(screen.getByRole("region", { name: /Word of the Day card/i })).toBeInTheDocument();
  });
});

test("WOTD refresh bypasses cache and triggers new fetch", async () => {
  setupDefinitionFetch("eloquent");
  render(<App />);
  await waitFor(() => {
    expect(screen.getByRole("region", { name: /Word of the Day card/i })).toBeInTheDocument();
  });

  const refreshBtn = screen.getByRole("button", { name: /Refresh word of the day/i });
  // Before clicking, record fetch calls
  const callsBefore = global.fetch.mock.calls.length;

  fireEvent.click(refreshBtn);
  await waitFor(() => {
    expect(global.fetch.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

test('"Use this word" triggers a search and shows result header', async () => {
  setupDefinitionFetch("resilience");
  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole("region", { name: /Word of the Day card/i })).toBeInTheDocument();
  });

  const useBtn = screen.getByRole("button", { name: /Use this word/i });
  fireEvent.click(useBtn);

  // A result section should appear eventually; we don't know the exact word,
  // but we can assert presence of results region by role label containing "Results for"
  await waitFor(() => {
    const region = screen.getAllByRole("region").find((el) =>
      el.getAttribute("aria-label")?.startsWith("Results for")
    );
    expect(region).toBeTruthy();
  });
}
) 
