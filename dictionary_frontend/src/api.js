 /**
 * API client for dictionary lookups with environment-aware base URL and normalization.
 * Provides one normalized response shape to avoid UI crashes across backends.
 */

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

  const cleaned =
    typeof envUrl === "string" && envUrl.trim().length > 0
      ? envUrl.replace(/\/*$/, "")
      : null;

  return cleaned || "https://api.dictionaryapi.dev";
}

/**
 * Normalize arbitrary values safely.
 */
const safeArray = (v) => (Array.isArray(v) ? v : []);
const safeString = (v) => (typeof v === "string" ? v : "");

/**
 * Normalize the public dictionaryapi.dev payload into our internal shape.
 * Adds a lang field to the normalized result for downstream logic.
 */
function normalizePublicApi(data, lang = "en") {
  const entries = Array.isArray(data) ? data : [];
  return entries.map((e) => {
    const word = safeString(e?.word);
    const phonetic = safeString(e?.phonetic);
    const phonetics = safeArray(e?.phonetics).map((p) => ({
      text: safeString(p?.text),
      audio: safeString(p?.audio),
    }));
    const meanings = safeArray(e?.meanings).map((m) => ({
      partOfSpeech: safeString(m?.partOfSpeech),
      definitions: safeArray(m?.definitions).map((d) => ({
        definition: safeString(d?.definition),
        example: safeString(d?.example),
      })),
      synonyms: safeArray(m?.synonyms).filter(Boolean),
      antonyms: safeArray(m?.antonyms).filter(Boolean),
    }));
    return { word, phonetic, phonetics, meanings, lang };
  });
}

/**
 * Normalize custom backend (/define?word=<w>&lang=<code>) response.
 * Adds a lang field to the normalized result.
 */
function normalizeCustomApi(data, lang = "en") {
  const rawEntries = Array.isArray(data)
    ? data
    : Array.isArray(data?.result)
    ? data.result
    : data
    ? [data]
    : [];

  return rawEntries.map((e) => {
    const word = safeString(e?.word);
    const phonetic = safeString(e?.phonetic);
    const phonetics = safeArray(e?.phonetics).map((p) => ({
      text: safeString(p?.text),
      audio: safeString(p?.audio),
    }));
    const meanings = safeArray(e?.meanings).map((m) => {
      const defs = safeArray(m?.definitions).map((d) => ({
        definition:
          safeString(d?.definition) ||
          safeString(d?.text) ||
          safeString(d?.meaning),
        example: safeString(d?.example),
      }));
      return {
        partOfSpeech: safeString(m?.partOfSpeech || m?.pos),
        definitions: defs,
        synonyms: safeArray(m?.synonyms).filter(Boolean),
        antonyms: safeArray(m?.antonyms).filter(Boolean),
      };
    });
    return { word, phonetic, phonetics, meanings, lang };
  });
}

/**
 * Helpers
 */
function isPublicBase(base) {
  return /dictionaryapi\.dev/i.test(base || "");
}

// PUBLIC_INTERFACE
export async function fetchDefinitions(word, lang = "en") {
  /**
   * Fetch word data and return a normalized array of entries.
   * Strategy with language:
   * 1) If custom backend provided, GET /define?word=<w>&lang=<code>
   * 2) Else, for en use dictionaryapi.dev; for non-en show friendly notice via empty [].
   */
  const base = getApiBaseUrl();
  const usePublic = isPublicBase(base);

  let url = "";
  if (!usePublic && base) {
    url = `${base}/define?word=${encodeURIComponent(word)}&lang=${encodeURIComponent(lang)}`;
  } else {
    // Public fallback only supports English
    url = `${base}/api/v2/entries/en/${encodeURIComponent(word)}`;
  }

  // First attempt
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    // If backend failed, try English public fallback only for en
    if (!usePublic) {
      if (lang !== "en") {
        // Non-English fallback not supported publicly; return empty
        return [];
      }
      const fallbackUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        word
      )}`;
      const fbRes = await fetch(fallbackUrl, {
        headers: { Accept: "application/json" },
      });
      if (!fbRes.ok) {
        if (fbRes.status === 404) return [];
        throw new Error(`Request failed with status ${fbRes.status}`);
      }
      const fbData = await fbRes.json();
      return normalizePublicApi(fbData, "en");
    }
    throw err;
  }

  if (!res.ok) {
    if (!usePublic) {
      if (lang !== "en") {
        // For non-English, public fallback is not available; return empty gracefully
        return [];
      }
      const fallbackUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        word
      )}`;
      const fbRes = await fetch(fallbackUrl, {
        headers: { Accept: "application/json" },
      });
      if (!fbRes.ok) {
        if (fbRes.status === 404) return [];
        let msg = `Request failed with status ${fbRes.status}`;
        try {
          const errJson = await fbRes.json();
          if (errJson && (errJson.title || errJson.message)) {
            msg = `${errJson.title || "Error"}: ${errJson.message || ""}`.trim();
          }
        } catch (_) {}
        throw new Error(msg);
      }
      const fbData = await fbRes.json();
      return normalizePublicApi(fbData, "en");
    } else {
      if (res.status === 404) {
        return [];
      }
      let msg = `Request failed with status ${res.status}`;
      try {
        const data = await res.json();
        if (data && (data.title || data.message)) {
          msg = `${data.title || "Error"}: ${data.message || ""}`.trim();
        }
      } catch (_) {}
      throw new Error(msg);
    }
  }

  const data = await res.json();
  if (!usePublic) {
    return normalizeCustomApi(data, lang);
  }
  // If using public, we fetched en always
  return normalizePublicApi(data, "en");
}

/**
 * Word of the Day helpers
 */

// PUBLIC_INTERFACE
export function getWotdBackendUrl(lang = "en") {
  /**
   * Returns the full WOTD endpoint if a custom backend base is configured, else null.
   * Endpoint: GET <BASE>/word-of-the-day?lang=<code>
   */
  const base = getApiBaseUrl();
  if (!isPublicBase(base)) {
    return `${base}/word-of-the-day?lang=${encodeURIComponent(lang)}`;
  }
  return null;
}

// PUBLIC_INTERFACE
export async function fetchWotdFromBackend(lang = "en") {
  /**
   * Tries to fetch WOTD from custom backend by language if available.
   * Returns normalized array or null if not available/404.
   */
  const url = getWotdBackendUrl(lang);
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      if (res.status === 404) return null;
      return null;
    }
    const data = await res.json();
    const normalized = normalizeCustomApi(data, lang);
    return normalized;
  } catch (_) {
    return null;
  }
}

// PUBLIC_INTERFACE
export function curatedWords() {
  /**
   * Returns a small curated list of nice words for fallback WOTD selection.
   */
  return [
    "serendipity",
    "eloquent",
    "ephemeral",
    "benevolent",
    "luminous",
    "resilience",
    "mellifluous",
    "zenith",
    "aesthetic",
    "solace",
    "vernacular",
    "catharsis",
  ];
}

// PUBLIC_INTERFACE
export function dailyIndex(dateStr, modulo) {
  /**
   * Deterministically pick an index for given date string YYYY-MM-DD within modulo range.
   * Uses a simple DJB2-like hash.
   */
  const s = (dateStr || "").toString();
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) ^ s.charCodeAt(i);
  }
  const idx = Math.abs(hash) % Math.max(1, modulo);
  return idx;
}
