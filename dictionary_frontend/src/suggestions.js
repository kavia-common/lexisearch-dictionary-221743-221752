//
// Suggestions API client with environment-aware base URL and graceful fallback.
//
// Resolve suggestion endpoint base, prioritizing REACT_APP_API_BASE if present.
// If not set, we use Datamuse as a public fallback.
//
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
export async function fetchSuggestions(prefix, lang = "en") {
  /** Fetch auto-suggestions for a given prefix (300ms debounced at caller).
   * - Uses GET /suggest?q=<prefix>&lang=<code> against REACT_APP_API_BASE if set.
   * - Else falls back to Datamuse (English only). For non-English without backend, returns [] with limited=true.
   * Returns { list: string[], limited: boolean } where limited=true indicates disabled/limited suggestions.
   */
  const trimmed = (prefix || "").trim();
  if (!trimmed) return { list: [], limited: false };

  const resolved = getSuggestionsBase();

  let url = "";
  let limited = false;

  if (resolved.type === "custom") {
    url = `${resolved.base}/suggest?q=${encodeURIComponent(trimmed)}&lang=${encodeURIComponent(
      lang
    )}`;
  } else {
    // Datamuse: English only
    if (lang !== "en") {
      // Disable suggestions gracefully for non-English without backend
      return { list: [], limited: true };
    }
    url = `${resolved.base}/sug?s=${encodeURIComponent(trimmed)}`;
  }

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return { list: [], limited };
    }
    const data = await res.json();

    if (Array.isArray(data)) {
      const list = data
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item.term === "string") return item.term;
          if (item && typeof item.word === "string") return item.word;
          return "";
        })
        .filter(Boolean);
      return { list, limited };
    }
    return { list: [], limited };
  } catch (_) {
    return { list: [], limited };
  }
}
