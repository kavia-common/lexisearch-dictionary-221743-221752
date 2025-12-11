import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { fetchDefinitions, getApiBaseUrl } from "./api";
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

// Helpers for safe access
const safeArray = (val) => (Array.isArray(val) ? val : []);
const safeString = (val) => (typeof val === "string" ? val : "");

// PUBLIC_INTERFACE
function Navbar() {
  /** Minimal top navbar with Ocean Professional styling. */
  const base = getApiBaseUrl();
  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <div className="brand">
          <span className="brand__logo" aria-hidden="true">
            🔎
          </span>
          <span className="brand__name">LexiSearch</span>
        </div>
        <div className="navbar__meta">
          <span className="navbar__env" title="API Base URL in use">
            API: {safeString(base)}
          </span>
        </div>
      </div>
    </nav>
  );
}

// PUBLIC_INTERFACE
function SearchBar({ onSubmit, defaultValue = "" }) {
  /**
   * Central search input with:
   * - Enter or button submit
   * - Microphone input using Web Speech API (fallback when unsupported)
   * - Debounced auto-suggestions with keyboard navigation and accessible roles
   */
  const [value, setValue] = useState(defaultValue);
  const [listening, setListening] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
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
      return;
    }

    setLoadingSug(true);
    debounceRef.current = setTimeout(async () => {
      const currentId = ++controllerRef.current;
      const data = await fetchSuggestions(q);
      if (currentId === controllerRef.current) {
        setSuggestions(data);
        setShowSuggestions(true);
        setLoadingSug(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Keyboard navigation for suggestions
  const onKeyDown = (e) => {
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
  };

  // Voice input using Web Speech API
  const isSpeechSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const startListening = () => {
    if (!isSpeechSupported) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "en-US";
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
        const t = finalTranscript.trim();
        setValue(t);
        if (t.length > 0) {
          onSubmit(t);
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
      alert("Speech recognition is not supported in this browser.");
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
      <div className="search__inner" onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          aria-label="Search for a word"
          className="search__input"
          type="text"
          placeholder="Search any word (e.g., eloquent)…"
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
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            title={listening ? "Stop voice input" : "Start voice input"}
          >
            {listening ? "🎤" : "🎙️"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--icon btn--muted"
            disabled
            aria-disabled="true"
            title="Speech recognition not supported"
          >
            🎙️
          </button>
        )}
        <button className="btn btn--primary" type="submit" aria-label="Search">
          Search
        </button>

        {showSuggestions && (
          <div className="suggestions" role="region" aria-label="Suggestions">
            <div className="suggestions__header">
              <span>Suggestions</span>
              <span aria-hidden="true">•</span>
              <span>
                Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to select
              </span>
            </div>
            {loadingSug ? (
              <div className="suggestions__status">Loading suggestions…</div>
            ) : suggestions.length === 0 ? (
              <div className="suggestions__status">No matches</div>
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
        Tip: Try words like “serendipity”, “benevolent”, or “ocean”. Press{" "}
        <kbd>Enter</kbd> to search.
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

function MeaningCard({ meaning, onChipClick }) {
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
          <p className="empty">No definitions available.</p>
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
              <span className="chips__label">Synonyms</span>
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
              <span className="chips__label">Antonyms</span>
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

function Result({ item, onChipClick }) {
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
    <section className="result" role="region" aria-label={`Results for ${word}`}>
      <header className="result__header">
        <div className="result__word">
          <h2 className="word">{word}</h2>
          {phonetic && <span className="phonetic">/{phonetic}/</span>}
        </div>
        <div className="result__meta">
          <AudioButton url={audioUrl} />
          {/* Favorite star is injected by parent via CSS sibling; placeholder for alignment */}
        </div>
      </header>

      <div className="result__content">
        {meanings.length === 0 ? (
          <div className="empty">No meanings found.</div>
        ) : (
          meanings.map((m, idx) => (
            <MeaningCard key={idx} meaning={m} onChipClick={onChipClick} />
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
   * - Top navbar
   * - Central search
   * - Results below as cards
   * Includes loading, error, and empty states.
   */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]); // normalized entries
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(() => getHistory());
  const [favorites, setFavorites] = useState(() => getFavorites());
  const [panelsOpen, setPanelsOpen] = useState({ history: true, favorites: true });

  // Apply subtle page theme background via body class
  useEffect(() => {
    document.body.classList.add("ocean-bg");
    return () => document.body.classList.remove("ocean-bg");
  }, []);

  // Ensure chips update history too
  useEffect(() => {
    if (results && results.length > 0 && query) {
      // We already updated history on successful search in handleSearch
    }
  }, [results, query]);

  const handleSearch = async (word) => {
    setQuery(word);
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const data = await fetchDefinitions(word);
      // fetchDefinitions now always returns normalized array on success
      if (Array.isArray(data) && data.length > 0) {
        setResults(data);
        // Update history with normalized word key
        setHistory(addToHistory(word));
      } else {
        setError("No results found.");
      }
    } catch (e) {
      setError(e?.message || "Unable to fetch definitions.");
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (w) => {
    if (typeof w === "string" && w.trim().length > 0) {
      // handleSearch will add to history on success
      handleSearch(w.trim());
    }
  };

  return (
    <div className="app">
      <Navbar />
      <main className="container">
        <section className="hero">
          <h1 className="title">Find the meaning of any word</h1>
          <p className="subtitle">
            Definitions, pronunciation, synonyms and antonyms – all in one place.
          </p>
          <SearchBar onSubmit={handleSearch} />
        </section>

        <section className="status-area" aria-live="polite">
          {loading && (
            <div className="status status--loading" role="status" aria-busy="true">
              <span className="spinner" aria-hidden="true" />
              <span>Searching the depths…</span>
            </div>
          )}
          {!loading && error && (
            <div className="status status--error" role="alert">
              {error}
            </div>
          )}
          {!loading && !error && results.length === 0 && query.length === 0 && (
            <div className="status status--hint" role="note">
              Start by typing a word above to see results.
            </div>
          )}
          {!loading && !error && results.length === 0 && query.length > 0 && (
            <div className="status status--hint" role="note">
              No results yet. Try a different word.
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
                    <Result item={r} onChipClick={handleChipClick} />
                    <div style={{ position: "absolute", top: 14, right: 18 }}>
                      <button
                        className="star-btn"
                        aria-label={fav ? "Unfavorite word" : "Favorite word"}
                        aria-pressed={fav}
                        title={fav ? "Unfavorite" : "Add to favorites"}
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
              <aside className="panel" aria-label="Recent Searches">
                <div className="panel__header">
                  <div className="panel__title" role="heading" aria-level={2}>
                    🕘 <span>Recent Searches</span>
                  </div>
                  <div className="panel__actions">
                    <button
                      className="icon-btn"
                      onClick={() =>
                        setPanelsOpen((p) => ({ ...p, history: !p.history }))
                      }
                      aria-label={panelsOpen.history ? "Collapse history" : "Expand history"}
                    >
                      {panelsOpen.history ? "▾" : "▸"}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => setHistory(clearHistory())}
                      aria-label="Clear all history"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                {panelsOpen.history && (
                  <div className="panel__body">
                    {history.length === 0 ? (
                      <div className="empty">No recent searches.</div>
                    ) : (
                      <ul className="list" role="list">
                        {history.map((h, i) => (
                          <li key={`h-${i}`} className="list__item">
                            <button
                              className="list__action"
                              aria-label={`Search ${h.term}`}
                              onClick={() => handleSearch(h.term)}
                            >
                              Go
                            </button>
                            <span className="list__term">{h.term}</span>
                            <span className="list__meta">{timeAgo(h.ts)}</span>
                            <button
                              className="list__action"
                              aria-label={`Remove ${h.term} from history`}
                              onClick={() => setHistory(removeFromHistory(h.term))}
                              title="Remove"
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

              {/* Favorites Panel */}
              <aside className="panel" aria-label="Favorite Words">
                <div className="panel__header">
                  <div className="panel__title" role="heading" aria-level={2}>
                    ⭐ <span>Favorites</span>
                  </div>
                  <div className="panel__actions">
                    <button
                      className="icon-btn"
                      onClick={() =>
                        setPanelsOpen((p) => ({ ...p, favorites: !p.favorites }))
                      }
                      aria-label={panelsOpen.favorites ? "Collapse favorites" : "Expand favorites"}
                    >
                      {panelsOpen.favorites ? "▾" : "▸"}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => setFavorites(clearFavorites())}
                      aria-label="Clear all favorites"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                {panelsOpen.favorites && (
                  <div className="panel__body">
                    {favorites.length === 0 ? (
                      <div className="empty">No favorites yet.</div>
                    ) : (
                      <ul className="list" role="list">
                        {favorites.map((w, i) => (
                          <li key={`f-${i}`} className="list__item">
                            <button
                              className="list__action"
                              aria-label={`Search ${w}`}
                              onClick={() => handleSearch(w)}
                            >
                              Go
                            </button>
                            <span className="list__term">{w}</span>
                            <button
                              className="list__action"
                              aria-label={`Remove ${w} from favorites`}
                              onClick={() => setFavorites(removeFavorite(w))}
                              title="Remove"
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
