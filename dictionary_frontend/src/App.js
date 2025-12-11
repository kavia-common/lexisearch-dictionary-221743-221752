import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  fetchDefinitions,
  getApiBaseUrl,
  fetchWotdFromBackend,
  curatedWords,
  dailyIndex,
} from "./api";
import { fetchSuggestions } from "./suggestions";
import {
  addToHistory,
  clearFavorites,
  clearHistory,
  getFavorites,
  getHistory,
  isFavorite,
  removeFavorite,
  removeFromHistory,
  timeAgo,
  toggleFavorite,
} from "./storage";
import { getDefaultLang, setStoredLang, SUPPORTED_LANGS, t } from "./i18n";

// Helpers for safe access
const safeArray = (val) => (Array.isArray(val) ? val : []);
const safeString = (val) => (typeof val === "string" ? val : "");

// PUBLIC_INTERFACE
function Navbar({ lang, onLangChange }) {
  /** Minimal top navbar with Ocean Professional styling and language switcher. */
  const base = getApiBaseUrl();
  const liveRef = useRef(null);

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.textContent = `Language set to ${lang}`;
    }
  }, [lang]);

  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <div className="brand">
          <span className="brand__logo" aria-hidden="true">
            🔎
          </span>
          <span className="brand__name">{t(lang, "app_name")}</span>
        </div>
        <div className="navbar__meta" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label htmlFor="lang-select" className="navbar__env" aria-label="Select language">
            🌐
          </label>
          <select
            id="lang-select"
            aria-label="Select language"
            onChange={(e) => onLangChange(e.target.value)}
            value={lang}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "#fff",
            }}
          >
            {SUPPORTED_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="navbar__env" title="API Base URL in use">
            {t(lang, "api_label")}: {safeString(base)}
          </span>
          <span aria-live="polite" aria-atomic="true" style={{ position: "absolute", left: -9999 }} ref={liveRef} />
        </div>
      </div>
    </nav>
  );
}

// PUBLIC_INTERFACE
function SearchBar({ lang, onSubmit, defaultValue = "" }) {
  /**
   * Central search input with:
   * - Enter or button submit
   * - Microphone input using Web Speech API (fallback when unsupported)
   * - Debounced auto-suggestions with keyboard navigation and accessible roles
   */
  const [value, setValue] = useState(defaultValue);
  const [listening, setListening] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLimited, setSuggestionsLimited] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSug, setLoadingSug] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const controllerRef = useRef(0);
  const debounceRef = useRef(null);
  const recognitionRef = useRef(null);

  const handleSubmit = useCallback(
    (e) => {
      if (e) e.preventDefault();
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        onSubmit(trimmed);
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    },
    [value, onSubmit]
  );

  // Debounced suggestions fetch
  useEffect(() => {
    const q = value.trim();
    setActiveIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (q.length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoadingSug(false);
      setSuggestionsLimited(false);
      return;
    }

    setLoadingSug(true);
    debounceRef.current = setTimeout(async () => {
      const currentId = ++controllerRef.current;
      const { list, limited } = await fetchSuggestions(q, lang);
      if (currentId === controllerRef.current) {
        setSuggestions(list);
        setSuggestionsLimited(!!limited);
        setShowSuggestions(true);
        setLoadingSug(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, lang]);

  // Voice input using Web Speech API
  const isSpeechSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const startListening = () => {
    if (!isSpeechSupported) {
      alert(t(lang, "speech_unsupported"));
      return;
    }

    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    // Best effort: map app language to SR locale
    const locales = { en: "en-US", hi: "hi-IN", te: "te-IN" };
    recognition.lang = locales[lang] || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setListening(true);
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      let interim = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      if (finalTranscript) {
        const tVal = finalTranscript.trim();
        setValue(tVal);
        if (tVal.length > 0) {
          onSubmit(tVal);
          setShowSuggestions(false);
        }
      } else if (interim) {
        setValue(() => interim);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (_) {}
  };

  const stopListening = () => {
    try {
      recognitionRef.current && recognitionRef.current.stop();
    } catch (_) {
    } finally {
      setListening(false);
    }
  };

  const toggleMic = () => {
    if (!isSpeechSupported) {
      alert(t(lang, "speech_unsupported"));
      return;
    }
    if (listening) stopListening();
    else startListening();
  };

  const selectSuggestion = (s) => {
    setValue(s);
    setShowSuggestions(false);
    setActiveIndex(-1);
    onSubmit(s);
  };

  const listId = "suggestions-listbox";

  return (
    <form className="search" onSubmit={handleSubmit} role="search">
      <div className="search__inner" onKeyDown={(e) => {
        if (!showSuggestions) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((idx) => {
            const next = idx + 1;
            return next >= suggestions.length ? suggestions.length - 1 : next;
          });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex((idx) => {
            const next = idx - 1;
            return next < 0 ? -1 : next;
          });
        } else if (e.key === "Enter") {
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            e.preventDefault();
            const chosen = suggestions[activeIndex];
            setValue(chosen);
            setShowSuggestions(false);
            setActiveIndex(-1);
            onSubmit(chosen);
          }
        } else if (e.key === "Escape") {
          setShowSuggestions(false);
          setActiveIndex(-1);
        }
      }}>
        <input
          ref={inputRef}
          aria-label={t(lang, "search_aria")}
          className="search__input"
          type="text"
          placeholder={t(lang, "search_placeholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={listId}
          aria-activedescendant={
            activeIndex >= 0 ? `sug-${activeIndex}` : undefined
          }
        />
        {isSpeechSupported ? (
          <button
            type="button"
            className={`btn btn--icon btn--muted ${listening ? "mic-on" : ""}`}
            onClick={toggleMic}
            aria-pressed={listening}
            aria-label={listening ? t(lang, "voice_stop") : t(lang, "voice_start")}
            title={listening ? t(lang, "voice_stop") : t(lang, "voice_start")}
          >
            {listening ? "🎤" : "🎙️"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--icon btn--muted"
            disabled
            aria-disabled="true"
            title={t(lang, "speech_unsupported")}
          >
            🎙️
          </button>
        )}
        <button className="btn btn--primary" type="submit" aria-label={t(lang, "search_btn")}>
          {t(lang, "search_btn")}
        </button>

        {showSuggestions && (
          <div className="suggestions" role="region" aria-label={t(lang, "suggestions")}>
            <div className="suggestions__header">
              <span>{t(lang, "suggestions")}</span>
              <span aria-hidden="true">•</span>
              <span>
                Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to select
              </span>
            </div>
            {loadingSug ? (
              <div className="suggestions__status">{t(lang, "suggestions_loading")}</div>
            ) : suggestions.length === 0 ? (
              <div className="suggestions__status">
                {t(lang, "suggestions_none")}
                {suggestionsLimited ? ` — ${t(lang, "suggestions_disabled_non_en")}` : ""}
              </div>
            ) : (
              <ul
                id={listId}
                className="suggestions__list"
                role="listbox"
                ref={listRef}
              >
                {suggestions.map((s, i) => (
                  <li
                    key={`s-${i}`}
                    id={`sug-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    className="suggestion-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    onClick={() => selectSuggestion(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span className="suggestion-text">{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <p className="search__hint">
        {t(lang, "tip")}
      </p>
    </form>
  );
}

function AudioButton({ url, label = "Play pronunciation" }) {
  if (!url) return null;
  return (
    <audio className="audio" controls preload="none" aria-label={label}>
      <source src={url} />
      Your browser does not support the audio element.
    </audio>
  );
}

function MeaningCard({ lang, meaning, onChipClick }) {
  const partOfSpeech = safeString(meaning.partOfSpeech);
  const definitions = safeArray(meaning.definitions);
  const synonyms = safeArray(meaning.synonyms);
  const antonyms = safeArray(meaning.antonyms);

  return (
    <div className="card" role="article" aria-label={`Meanings: ${partOfSpeech || "unknown part of speech"}`}>
      <div className="card__header">
        <span className="pos">{partOfSpeech || "—"}</span>
      </div>
      <div className="card__body">
        {definitions.length === 0 ? (
          <p className="empty">{t(lang, "no_definitions")}</p>
        ) : (
          <ol className="definitions">
            {definitions.map((d, idx) => (
              <li key={idx} className="definition">
                <div className="definition__text">{safeString(d.definition)}</div>
                {d.example ? (
                  <div className="definition__example">“{safeString(d.example)}”</div>
                ) : null}
              </li>
            ))}
          </ol>
        )}

        <div className="chips">
          {synonyms.length > 0 && (
            <div className="chips__group">
              <span className="chips__label">{t(lang, "synonyms")}</span>
              <div className="chips__wrap" role="list">
                {synonyms.map((s, i) => (
                  <button
                    key={`syn-${i}`}
                    className="chip chip--syn"
                    role="listitem"
                    onClick={() => onChipClick && onChipClick(s)}
                    aria-label={`Search synonym ${s}`}
                    title={`Search synonym: ${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {antonyms.length > 0 && (
            <div className="chips__group">
              <span className="chips__label">{t(lang, "antonyms")}</span>
              <div className="chips__wrap" role="list">
                {antonyms.map((a, i) => (
                  <button
                    key={`ant-${i}`}
                    className="chip chip--ant"
                    role="listitem"
                    onClick={() => onChipClick && onChipClick(a)}
                    aria-label={`Search antonym ${a}`}
                    title={`Search antonym: ${a}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Result({ lang, item, onChipClick }) {
  const word = safeString(item.word);
  const phonetic = safeString(item.phonetic);
  const phonetics = safeArray(item.phonetics);
  const meanings = safeArray(item.meanings);

  const audioUrl = useMemo(() => {
    // Prefer the first available audio URL
    const p = phonetics.find((p) => p.audio && p.audio.length > 0);
    return p ? p.audio : "";
  }, [phonetics]);

  return (
    <section className="result" role="region" aria-label={`${t(lang, "results_for")} ${word}`}>
      <header className="result__header">
        <div className="result__word">
          <h2 className="word">{word}</h2>
          {phonetic && <span className="phonetic">/{phonetic}/</span>}
        </div>
        <div className="result__meta">
          <AudioButton url={audioUrl} label={t(lang, "play_pron")} />
        </div>
      </header>

      <div className="result__content">
        {meanings.length === 0 ? (
          <div className="empty">{t(lang, "meanings_not_found")}</div>
        ) : (
          meanings.map((m, idx) => (
            <MeaningCard key={idx} lang={lang} meaning={m} onChipClick={onChipClick} />
          ))
        )}
      </div>
    </section>
  );
}

// PUBLIC_INTERFACE
function App() {
  /**
   * Main App with single-page layout:
   * - Top navbar with language switcher
   * - Central search
   * - Results below as cards
   * Includes loading, error, and empty states.
   */
  const [lang, setLang] = useState(() => getDefaultLang());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]); // normalized entries
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Track if at least one explicit search has completed to avoid premature "no results" hints
  const [hasSearched, setHasSearched] = useState(false);
  const [history, setHistory] = useState(() => getHistory());
  const [favorites, setFavorites] = useState(() => getFavorites());
  const [panelsOpen, setPanelsOpen] = useState({ history: true, favorites: true });

  // WOTD State
  const [wotd, setWotd] = useState(null); // normalized single entry
  const [wotdLoading, setWotdLoading] = useState(true);
  const [wotdError, setWotdError] = useState("");
  const [wotdNotice, setWotdNotice] = useState("");

  // Apply subtle page theme background via body class
  useEffect(() => {
    document.body.classList.add("ocean-bg");
    return () => document.body.classList.remove("ocean-bg");
  }, []);

  // Persist lang changes
  useEffect(() => {
    setStoredLang(lang);
  }, [lang]);

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // Safe localStorage helpers for WOTD, cache per-day and per-language
  const lsKey = "ls_wotd_v1";
  const readWotdCache = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(lsKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (parsed.date !== `${todayStr}:${lang}`) return null;
      return parsed.payload || null;
    } catch (_) {
      return null;
    }
  }, [todayStr, lang]);

  const writeWotdCache = useCallback((payload, dateStr, langCode) => {
    try {
      window.localStorage.setItem(
        lsKey,
        JSON.stringify({ date: `${dateStr}:${langCode}`, payload })
      );
    } catch (_) {
      // ignore
    }
  }, []);

  const pickCuratedWord = useCallback(() => {
    const list = curatedWords();
    const idx = dailyIndex(todayStr, list.length);
    return list[idx];
  }, [todayStr]);

  // PUBLIC_INTERFACE
  async function loadWotd({ forceRefresh = false } = {}) {
    /**
     * Load WOTD:
     * 1) Use cache if present for today+lang and not forcing refresh.
     * 2) Try backend GET /word-of-the-day?lang=<code> if custom base configured.
     * 3) Fallback: for non-English show English WOTD with notice.
     */
    setWotdLoading(true);
    setWotdError("");
    setWotdNotice("");
    try {
      if (!forceRefresh) {
        const cached = readWotdCache();
        if (cached && Array.isArray(cached) && cached.length > 0) {
          setWotd(cached[0]);
          setWotdLoading(false);
          return;
        }
      }

      // Try backend first
      const fromBackend = await fetchWotdFromBackend(lang);
      if (fromBackend && fromBackend.length > 0 && fromBackend[0]?.word) {
        setWotd(fromBackend[0]);
        writeWotdCache(fromBackend, todayStr, lang);
        setWotdLoading(false);
        return;
      }

      // Fallback:
      // If non-English, fallback to English daily logic with notice
      let targetLang = lang;
      if (lang !== "en") {
        setWotdNotice(t(lang, "wotd_fallback_notice"));
        targetLang = "en";
      }
      const term = pickCuratedWord();
      const defs = await fetchDefinitions(term, targetLang);
      if (Array.isArray(defs) && defs.length > 0) {
        setWotd(defs[0]);
        writeWotdCache(defs, todayStr, lang);
      } else {
        setWotd(null);
        writeWotdCache([], todayStr, lang);
      }
    } catch (e) {
      setWotdError(e?.message || "Unable to load Word of the Day.");
    } finally {
      setWotdLoading(false);
    }
  }

  useEffect(() => {
    loadWotd({ forceRefresh: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr, lang]);

  const handleSearch = async (word) => {
    setQuery(word);
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const data = await fetchDefinitions(word, lang);
      if (Array.isArray(data) && data.length > 0) {
        setResults(data);
        // Update history with language
        const h = addToHistory(`${word}|${lang}`); // temporary call; will normalize below
        // We'll instead store as { word, lang, ts } by patching storage below in rendering
        // but for backward compat we still call addToHistory; UI rendering uses custom view mapping
        setHistory(h);
      } else {
        setError(t(lang, "no_results_yet"));
      }
    } catch (e) {
      setError(e?.message || "Unable to fetch definitions.");
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  // Render
  return (
    <div className="app">
      <Navbar
        lang={lang}
        onLangChange={(code) => {
          setLang(code);
        }}
      />
      <main className="container">
        <section className="hero">
          <h1 className="title">{t(lang, "app_name")}: {t(lang, "start_prompt")}</h1>
          <p className="subtitle">
            {/* Keep subtitle concise, localized via two keys */}
            {t(lang, "start_prompt")}
          </p>
          <SearchBar lang={lang} onSubmit={handleSearch} />
        </section>

        {/* Word of the Day */}
        <section className="wotd" aria-label={t(lang, "wotd")}>
          <div className="wotd__card" role="region" aria-label="Word of the Day card">
            <div className="wotd__header">
              <div className="wotd__title" role="heading" aria-level={2}>
                🌅 <span>{t(lang, "wotd")}</span>
              </div>
              <div className="wotd__actions">
                <button
                  className="icon-btn"
                  aria-label={t(lang, "wotd_refresh")}
                  title={t(lang, "wotd_refresh")}
                  onClick={() => loadWotd({ forceRefresh: true })}
                >
                  ⟳
                </button>
              </div>
            </div>
            <div className="wotd__body">
              {wotdNotice ? (
                <div className="status status--hint" role="note">{wotdNotice}</div>
              ) : null}
              {wotdLoading ? (
                <div className="status status--loading" role="status" aria-busy="true">
                  <span className="spinner" aria-hidden="true" />
                  <span>{t(lang, "fetching")}</span>
                </div>
              ) : wotdError ? (
                <div className="status status--error" role="alert">
                  {wotdError}
                </div>
              ) : !wotd ? (
                <div className="empty">{t(lang, "no_word")}</div>
              ) : (
                <>
                  <div className="wotd__word">
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <h3>{wotd.word}</h3>
                      {wotd.phonetic ? (
                        <span className="phonetic">/{wotd.phonetic}/</span>
                      ) : null}
                    </div>
                    <div className="wotd__meta">
                      {(() => {
                        const p = (Array.isArray(wotd.phonetics) ? wotd.phonetics : []).find(
                          (p) => p.audio
                        );
                        return p ? <AudioButton url={p.audio} label={t(lang, "play_pron_wotd")} /> : null;
                      })()}
                      <button
                        className="star-btn"
                        aria-label={isFavorite(wotd.word) ? t(lang, "unfavorite") + " word" : t(lang, "favorite") + " word"}
                        aria-pressed={isFavorite(wotd.word)}
                        title={isFavorite(wotd.word) ? t(lang, "unfavorite") : t(lang, "favorite")}
                        onClick={() => {
                          const res = toggleFavorite(wotd.word);
                          setFavorites(res.list);
                        }}
                      >
                        {isFavorite(wotd.word) ? "★" : "☆"}
                      </button>
                    </div>
                  </div>

                  {/* Show first meaning/definition */}
                  {Array.isArray(wotd.meanings) && wotd.meanings.length > 0 ? (
                    <div className="card" role="article" aria-label={t(lang, "primary_meaning")}>
                      <div className="card__header">
                        <span className="pos">
                          {wotd.meanings[0]?.partOfSpeech || "—"}
                        </span>
                      </div>
                      <div className="card__body">
                        <ol className="definitions">
                          {Array.isArray(wotd.meanings[0]?.definitions) &&
                          wotd.meanings[0].definitions.length > 0 ? (
                            <>
                              <li className="definition">
                                <div className="definition__text">
                                  {wotd.meanings[0].definitions[0]?.definition || ""}
                                </div>
                                {wotd.meanings[0].definitions[0]?.example ? (
                                  <div className="definition__example">
                                    “{wotd.meanings[0].definitions[0].example}”
                                  </div>
                                ) : null}
                              </li>
                            </>
                          ) : (
                            <li className="definition">
                              <div className="definition__text">{t(lang, "no_definitions")}</div>
                            </li>
                          )}
                        </ol>
                      </div>
                    </div>
                  ) : (
                    <div className="empty">{t(lang, "meanings_not_found")}</div>
                  )}

                  <div className="wotd__buttons">
                    <button
                      className="btn btn--amber btn--small"
                      aria-label={`${t(lang, "use_this_word")} ${wotd.word}`}
                      onClick={() => handleSearch(wotd.word)}
                      title={t(lang, "use_this_word")}
                    >
                      {t(lang, "use_this_word")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="status-area" aria-live="polite">
          {loading && (
            <div className="status status--loading" role="status" aria-busy="true">
              <span className="spinner" aria-hidden="true" />
              <span>{t(lang, "loading")}</span>
            </div>
          )}
          {!loading && error && (
            <div className="status status--error" role="alert">
              {error}
            </div>
          )}
          {!loading && !error && results.length === 0 && query.length === 0 && (
            <div className="status status--hint" role="note">
              {t(lang, "start_prompt")}
            </div>
          )}
          {!loading && !error && results.length === 0 && query.length > 0 && hasSearched && (
            <div className="status status--hint" role="note">
              {t(lang, "no_results_yet")}
            </div>
          )}
        </section>

        {!loading && !error && results.length > 0 && (
          <>
            <section className="results" aria-label="Search results">
              {results.map((r, idx) => {
                const w = (r?.word || "").toString();
                const fav = isFavorite(w);
                return (
                  <div key={idx} style={{ position: "relative" }}>
                    <Result lang={lang} item={r} onChipClick={(v) => handleSearch(v)} />
                    <div style={{ position: "absolute", top: 14, right: 18 }}>
                      <button
                        className="star-btn"
                        aria-label={fav ? t(lang, "unfavorite") + " word" : t(lang, "favorite") + " word"}
                        aria-pressed={fav}
                        title={fav ? t(lang, "unfavorite") : t(lang, "favorite")}
                        onClick={() => {
                          const res = toggleFavorite(w);
                          setFavorites(res.list);
                        }}
                      >
                        {fav ? "★" : "☆"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="panels" aria-label="History and Favorites">
              {/* History Panel */}
              <aside className="panel" aria-label={t(lang, "recent_searches")}>
                <div className="panel__header">
                  <div className="panel__title" role="heading" aria-level={2}>
                    🕘 <span>{t(lang, "recent_searches")}</span>
                  </div>
                  <div className="panel__actions">
                    <button
                      className="icon-btn"
                      onClick={() =>
                        setPanelsOpen((p) => ({ ...p, history: !p.history }))
                      }
                      aria-label={
                        panelsOpen.history ? `${t(lang, "collapse")} history` : `${t(lang, "expand")} history`
                      }
                    >
                      {panelsOpen.history ? "▾" : "▸"}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => setHistory(clearHistory())}
                      aria-label={t(lang, "clear_all")}
                    >
                      {t(lang, "clear_all")}
                    </button>
                  </div>
                </div>
                {panelsOpen.history && (
                  <div className="panel__body">
                    {history.length === 0 ? (
                      <div className="empty">{t(lang, "no_recent")}</div>
                    ) : (
                      <ul className="list" role="list">
                        {history.map((h, i) => {
                          // Backward compatibility: if term contains |lang, split; else assume current lang
                          let term = h.term;
                          let hLang = lang;
                          if (typeof term === "string" && term.includes("|")) {
                            const [w, l] = term.split("|");
                            term = w;
                            hLang = l || lang;
                          }
                          return (
                            <li key={`h-${i}`} className="list__item">
                              <button
                                className="list__action"
                                aria-label={`Search ${term}`}
                                onClick={() => {
                                  // re-run with stored language
                                  setLang(hLang);
                                  // ensure persistence before search
                                  setTimeout(() => handleSearch(term), 0);
                                }}
                              >
                                {t(lang, "go")}
                              </button>
                              <span className="list__term">{term}</span>
                              <span className="list__meta">{timeAgo(h.ts)}</span>
                              <button
                                className="list__action"
                                aria-label={`${t(lang, "remove")} ${term} from history`}
                                onClick={() => setHistory(removeFromHistory(h.term))}
                                title={t(lang, "remove")}
                              >
                                ✕
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </aside>

              {/* Favorites Panel */}
              <aside className="panel" aria-label={t(lang, "favorites")}>
                <div className="panel__header">
                  <div className="panel__title" role="heading" aria-level={2}>
                    ⭐ <span>{t(lang, "favorites")}</span>
                  </div>
                  <div className="panel__actions">
                    <button
                      className="icon-btn"
                      onClick={() =>
                        setPanelsOpen((p) => ({ ...p, favorites: !p.favorites }))
                      }
                      aria-label={panelsOpen.favorites ? `${t(lang, "collapse")} favorites` : `${t(lang, "expand")} favorites`}
                    >
                      {panelsOpen.favorites ? "▾" : "▸"}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => setFavorites(clearFavorites())}
                      aria-label={t(lang, "clear_all")}
                    >
                      {t(lang, "clear_all")}
                    </button>
                  </div>
                </div>
                {panelsOpen.favorites && (
                  <div className="panel__body">
                    {favorites.length === 0 ? (
                      <div className="empty">{t(lang, "no_favorites")}</div>
                    ) : (
                      <ul className="list" role="list">
                        {favorites.map((w, i) => (
                          <li key={`f-${i}`} className="list__item">
                            <button
                              className="list__action"
                              aria-label={`Search ${w}`}
                              onClick={() => handleSearch(w)}
                            >
                              {t(lang, "go")}
                            </button>
                            <span className="list__term">{w}</span>
                            <button
                              className="list__action"
                              aria-label={`${t(lang, "remove")} ${w} from favorites`}
                              onClick={() => setFavorites(removeFavorite(w))}
                              title={t(lang, "remove")}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </aside>
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <span>
            Built with Ocean Professional theme. Data by{" "}
            <a
              href="https://dictionaryapi.dev/"
              target="_blank"
              rel="noreferrer"
              className="footer__link"
            >
              Free Dictionary API
            </a>
            .
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
