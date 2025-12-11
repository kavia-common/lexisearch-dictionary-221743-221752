//
// Suggestions API client with environment-aware base URL and graceful fallback.
//
/**
 * Resolve suggestion endpoint base, prioritizing REACT_APP_API_BASE if present.
 * If not set, we use Datamuse as a public fallback.
 */
export function getSuggestionsBase() {
  const raw =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_FRONTEND_URL ||
    "";
  const cleaned =
    typeof raw === "string" && raw.trim().length > 0
      ? raw.replace(/\/*$/, "")
      : "";

  if (cleaned) {
    return { type: "custom", base: cleaned };
  }
  return { type: "datamuse", base: "https://api.datamuse.com" };
}

// PUBLIC_INTERFACE
export async function fetchSuggestions(prefix) {
  /** Fetch auto-suggestions for a given prefix (300ms debounced at caller).
   * - Uses GET /suggest?q=<prefix> against REACT_APP_API_BASE if set.
   * - Else falls back to Datamuse: /sug?s=<prefix>.
   * Returns a normalized array of suggestion strings.
   */
  const trimmed = (prefix || "").trim();
  if (!trimmed) return [];

  const resolved = getSuggestionsBase();

  let url = "";
  if (resolved.type === "custom") {
    url = `${resolved.base}/suggest?q=${encodeURIComponent(trimmed)}`;
  } else {
    url = `${resolved.base}/sug?s=${encodeURIComponent(trimmed)}`;
  }

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      // Surface no suggestions on error, do not throw to avoid crashes
      return [];
    }
    const data = await res.json();

    // Normalize various shapes. Expected:
    // - Custom: [{ term: "word" }, ...] or ["word", ...]
    // - Datamuse: [{ word: "word", score: N }, ...]
    if (Array.isArray(data)) {
      return data
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item.term === "string") return item.term;
          if (item && typeof item.word === "string") return item.word;
          return "";
        })
        .filter(Boolean);
    }
    // If object or unknown shape, return empty for safety
    return [];
  } catch (_) {
    return [];
  }
}
