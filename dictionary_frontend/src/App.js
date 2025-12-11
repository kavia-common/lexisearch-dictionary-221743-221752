import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { fetchDefinitions, getApiBaseUrl } from "./api";
import { fetchSuggestions } from "./suggestions";

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
  const controllerRef = useRef(0); // simple request id to avoid race conditions
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
      // Only update if still latest
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
      // If a suggestion is highlighted, use it; otherwise submit as-is
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
        // auto-submit on final
        if (t.length > 0) {
          onSubmit(t);
          setShowSuggestions(false);
        }
      } else if (interim) {
        // update input with interim to show live dictation
        setValue((prev) => {
          // replace only if interim is longer than prev to avoid jumping
          return interim;
        });
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (_) {
      // some browsers throw if start called twice quickly
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current && recognitionRef.current.stop();
    } catch (_) {
      // no-op
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
              <div className="suggestions__status">
                Loading suggestions…
              </div>
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
                      // prevent input blur before click handler
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
        Tip: Try words like “serendipity”, “benevolent”, or “ocean”. Press
        <span> </span>
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

function MeaningCard({ meaning }) {
  const partOfSpeech = safeString(meaning.partOfSpeech);
  const definitions = safeArray(meaning.definitions);
  const synonyms = safeArray(meaning.synonyms);
  const antonyms = safeArray(meaning.antonyms);

  return (
    <div className="card">
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
              <div className="chips__wrap">
                {synonyms.map((s, i) => (
                  <span key={`syn-${i}`} className="chip chip--syn">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {antonyms.length > 0 && (
            <div className="chips__group">
              <span className="chips__label">Antonyms</span>
              <div className="chips__wrap">
                {antonyms.map((a, i) => (
                  <span key={`ant-${i}`} className="chip chip--ant">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Result({ item }) {
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
    <section className="result">
      <header className="result__header">
        <div className="result__word">
          <h2 className="word">{word}</h2>
          {phonetic && <span className="phonetic">/{phonetic}/</span>}
        </div>
        <div className="result__audio">
          <AudioButton url={audioUrl} />
        </div>
      </header>

      <div className="result__content">
        {meanings.length === 0 ? (
          <div className="empty">No meanings found.</div>
        ) : (
          meanings.map((m, idx) => <MeaningCard key={idx} meaning={m} />)
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
  const [results, setResults] = useState([]); // Raw array from API
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Apply subtle page theme background via body class
  useEffect(() => {
    document.body.classList.add("ocean-bg");
    return () => document.body.classList.remove("ocean-bg");
  }, []);

  const handleSearch = async (word) => {
    setQuery(word);
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const data = await fetchDefinitions(word);
      // API returns an array of entries on success; on error, an object with title/message
      if (Array.isArray(data)) {
        setResults(data);
      } else {
        // Unexpected structure -> treat as error message if present
        const msg =
          safeString(data?.message) ||
          safeString(data?.title) ||
          "No results found.";
        setError(msg);
      }
    } catch (e) {
      setError(e?.message || "Unable to fetch definitions.");
    } finally {
      setLoading(false);
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
            <div className="status status--loading">
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
            <div className="status status--hint">
              Start by typing a word above to see results.
            </div>
          )}
          {!loading && !error && results.length === 0 && query.length > 0 && (
            <div className="status status--hint">
              No results yet. Try a different word.
            </div>
          )}
        </section>

        {!loading && !error && results.length > 0 && (
          <section className="results">
            {results.map((r, idx) => (
              <Result key={idx} item={r} />
            ))}
          </section>
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
