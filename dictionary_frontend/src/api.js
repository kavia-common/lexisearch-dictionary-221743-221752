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
      ? envUrl.replace(/\/+$/, "")
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
 * Input can be array of entries; we map each to:
 * {
 *   word, phonetic, phonetics: [{text, audio}],
 *   meanings: [{ partOfSpeech, definitions: [{definition, example}], synonyms[], antonyms[] }]
 * }
 */
function normalizePublicApi(data) {
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
    return { word, phonetic, phonetics, meanings };
  });
}

/**
 * Normalize custom backend (/define?word=<w>) response into the same internal shape.
 * Expect flexible structures; we attempt to coerce fields where possible.
 * Supported input examples:
 * { word, phonetic?, phonetics?:[{text?, audio?}], meanings:[{ partOfSpeech, definitions:[{definition, example?}], synonyms?, antonyms? }] }
 * or a list of entries with the above shape.
 */
function normalizeCustomApi(data) {
  // Some backends may return a single object or {result: [...]} wrapper
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
    return { word, phonetic, phonetics, meanings };
  });
}

// PUBLIC_INTERFACE
export async function fetchDefinitions(word) {
  /**
   * Fetch word data and return a normalized array of entries.
   * Strategy:
   * 1) If REACT_APP_API_BASE is set and not the public API, call GET /define?word=<w>
   * 2) Else, call public API: https://api.dictionaryapi.dev/api/v2/entries/en/<word>
   * Always normalize to a single internal shape so UI never crashes on missing fields.
   */
  const base = getApiBaseUrl();
  const isPublic = /dictionaryapi\.dev/i.test(base);

  let url = "";
  if (!isPublic && base) {
    // Prefer custom backend if provided
    url = `${base}/define?word=${encodeURIComponent(word)}`;
  } else {
    url = `${base}/api/v2/entries/en/${encodeURIComponent(word)}`;
  }

  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    // If custom backend failed (network or CORS), try public API as a fallback
    if (!isPublic) {
      const fallbackUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        word
      )}`;
      const fbRes = await fetch(fallbackUrl, {
        headers: { Accept: "application/json" },
      });
      if (!fbRes.ok) {
        throw new Error(`Request failed with status ${fbRes.status}`);
      }
      const fbData = await fbRes.json();
      return normalizePublicApi(fbData);
    }
    throw err;
  }

  if (!res.ok) {
    // On custom backend failure, fallback to public API; on public, throw
    if (!isPublic) {
      const fallbackUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        word
      )}`;
      const fbRes = await fetch(fallbackUrl, {
        headers: { Accept: "application/json" },
      });
      if (!fbRes.ok) {
        // Try to read error message if any
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
      return normalizePublicApi(fbData);
    } else {
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
  if (!isPublic) {
    return normalizeCustomApi(data);
  }
  return normalizePublicApi(data);
}
