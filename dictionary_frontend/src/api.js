//
// API client for dictionary lookups with environment-aware base URL.
//
// PUBLIC_INTERFACE
export function getApiBaseUrl() {
  /**
   * Returns the API base URL from environment or defaults to public dictionary API.
   * Safe for undefined envs; no failures when not set.
   */
  const envUrl =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_FRONTEND_URL;

  // Ensure no trailing slash to avoid double slashes when joining paths
  const cleaned =
    typeof envUrl === "string" && envUrl.trim().length > 0
      ? envUrl.replace(/\/+$/, "")
      : null;

  // Default to the public free dictionary API if no env is provided
  return cleaned || "https://api.dictionaryapi.dev";
}

// PUBLIC_INTERFACE
export async function fetchDefinitions(word) {
  /**
   * Fetch word definitions, phonetics, meanings, synonyms, antonyms.
   * Uses:
   * - REACT_APP_API_BASE (preferred)
   * - falls back to public API when not provided.
   */
  const base = getApiBaseUrl();

  // If the base looks like the public api, use its canonical path schema.
  // Public API endpoint: https://api.dictionaryapi.dev/api/v2/entries/en/<word>
  let url = "";
  if (/dictionaryapi\.dev/i.test(base)) {
    url = `${base}/api/v2/entries/en/${encodeURIComponent(word)}`;
  } else {
    // For custom backends, assume a sane REST path like /api/v1/entries/en/<word>
    // This is a best effort; if backend differs, env should point directly to correct path.
    url = `${base}/api/v2/entries/en/${encodeURIComponent(word)}`;
  }

  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    // Try to extract error message if provided
    let msg = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (data && (data.title || data.message)) {
        msg = `${data.title || "Error"}: ${data.message || ""}`.trim();
      }
    } catch (_) {
      // ignore json parse errors and keep generic message
    }
    throw new Error(msg);
  }

  return res.json();
}
