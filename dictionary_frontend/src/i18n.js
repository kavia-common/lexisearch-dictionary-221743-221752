//
// Lightweight i18n utility with simple translations and localStorage persistence.
//
const LS_LANG_KEY = "ls_lang_v1";

export const SUPPORTED_LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "te", label: "తెలుగు" },
];

// PUBLIC_INTERFACE
export function getStoredLang() {
  /** Returns persisted language code from localStorage or default 'en'. */
  try {
    const v = window.localStorage.getItem(LS_LANG_KEY);
    if (typeof v === "string" && v.trim()) return v;
  } catch (_) {}
  return "en";
}

// PUBLIC_INTERFACE
export function setStoredLang(code) {
  /** Persist language code to localStorage safely. */
  try {
    window.localStorage.setItem(LS_LANG_KEY, code);
  } catch (_) {}
}

// PUBLIC_INTERFACE
export function getDefaultLang() {
  /** Returns default language preferring persisted value, else 'en'. */
  return getStoredLang() || "en";
}

const en = {
  app_name: "LexiSearch",
  search_placeholder: "Search any word (e.g., eloquent)…",
  search_aria: "Search for a word",
  search_btn: "Search",
  suggestions: "Suggestions",
  suggestions_loading: "Loading suggestions…",
  suggestions_none: "No matches",
  tip: "Tip: Try words like “serendipity”, “benevolent”, or “ocean”. Press Enter to search.",
  wotd: "Word of the Day",
  wotd_refresh: "Refresh word of the day",
  fetching: "Fetching today’s word…",
  no_word: "No word available. Try refresh.",
  primary_meaning: "Primary meaning",
  use_this_word: "Use this word",
  loading: "Searching the depths…",
  start_prompt: "Start by typing a word above to see results.",
  no_results_yet: "No results yet. Try a different word.",
  recent_searches: "Recent Searches",
  collapse: "Collapse",
  expand: "Expand",
  clear_all: "Clear All",
  no_recent: "No recent searches.",
  favorites: "Favorites",
  no_favorites: "No favorites yet.",
  unfavorite: "Unfavorite",
  favorite: "Favorite",
  no_definitions: "No definitions available.",
  synonyms: "Synonyms",
  antonyms: "Antonyms",
  meanings_not_found: "No meanings found.",
  results_for: "Results for",
  play_pron: "Play pronunciation",
  play_pron_wotd: "Play WOTD pronunciation",
  go: "Go",
  remove: "Remove",
  voice_start: "Start voice input",
  voice_stop: "Stop voice input",
  speech_unsupported: "Speech recognition is not supported in this browser.",
  api_label: "API",
  suggestions_disabled_non_en: "Suggestions are limited or disabled for this language.",
  fallback_not_supported_for_lang: "Public fallback doesn’t support this language; try another or set backend.",
  wotd_fallback_notice: "Showing English Word of the Day (fallback).",
};

const hi = {
  app_name: "लेक्सीसर्च",
  search_placeholder: "कोई शब्द खोजें (जैसे, eloquent)…",
  search_aria: "शब्द खोजें",
  search_btn: "खोजें",
  suggestions: "सुझाव",
  suggestions_loading: "सुझाव लोड हो रहे हैं…",
  suggestions_none: "कोई मेल नहीं",
  tip: "संकेत: “serendipity”, “benevolent”, या “ocean” जैसे शब्द आज़माएं। खोज के लिए Enter दबाएं।",
  wotd: "आज का शब्द",
  wotd_refresh: "आज के शब्द को ताज़ा करें",
  fetching: "आज का शब्द प्राप्त हो रहा है…",
  no_word: "कोई शब्द उपलब्ध नहीं। पुनः प्रयास करें।",
  primary_meaning: "मुख्य अर्थ",
  use_this_word: "इस शब्द का उपयोग करें",
  loading: "खोज जारी है…",
  start_prompt: "परिणाम देखने के लिए ऊपर कोई शब्द टाइप करें।",
  no_results_yet: "अभी तक कोई परिणाम नहीं। कोई दूसरा शब्द आज़माएं।",
  recent_searches: "हाल की खोजें",
  collapse: "संकुचित करें",
  expand: "विस्तार करें",
  clear_all: "सभी साफ़ करें",
  no_recent: "कोई हाल की खोज नहीं।",
  favorites: "पसंदीदा",
  no_favorites: "अभी तक कोई पसंदीदा नहीं।",
  unfavorite: "पसंदीदा हटाएं",
  favorite: "पसंदीदा करें",
  no_definitions: "कोई परिभाषा उपलब्ध नहीं।",
  synonyms: "पर्यायवाची",
  antonyms: "विलोम",
  meanings_not_found: "कोई अर्थ नहीं मिला।",
  results_for: "के परिणाम",
  play_pron: "उच्चारण चलाएं",
  play_pron_wotd: "आज के शब्द का उच्चारण चलाएं",
  go: "जाएँ",
  remove: "हटाएं",
  voice_start: "वॉइस इनपुट शुरू करें",
  voice_stop: "वॉइस इनपुट रोकें",
  speech_unsupported: "यह ब्राउज़र वॉइस पहचान का समर्थन नहीं करता।",
  api_label: "API",
  suggestions_disabled_non_en: "इस भाषा के लिए सुझाव सीमित या अक्षम हैं।",
  fallback_not_supported_for_lang: "पब्लिक फॉलबैक इस भाषा का समर्थन नहीं करता; कोई अन्य भाषा आज़माएं या बैकएंड सेट करें।",
  wotd_fallback_notice: "अंग्रेज़ी 'आज का शब्द' दिखाया जा रहा है (फॉलबैक)।",
};

const te = {
  app_name: "లెక్సిసెర్చ్",
  search_placeholder: "ఏదైనా పదాన్ని శోధించండి (ఉదా., eloquent)…",
  search_aria: "పదాన్ని శోధించండి",
  search_btn: "వెతకండి",
  suggestions: "సూచనలు",
  suggestions_loading: "సూచనలు లోడవుతున్నాయి…",
  suggestions_none: "పోలికలు లేవు",
  tip: "చిట్కా: “serendipity”, “benevolent”, లేదా “ocean” వంటి పదాలను ప్రయత్నించండి. Enter నొక్కండి.",
  wotd: "ఈరోజు పదం",
  wotd_refresh: "ఈరోజు పదాన్ని రిఫ్రెష్ చేయండి",
  fetching: "ఈరోజు పదం తెస్తున్నాం…",
  no_word: "పదం లేదు. రిఫ్రెష్ చేయండి.",
  primary_meaning: "ముఖ్య అర్థం",
  use_this_word: "ఈ పదాన్ని వాడండి",
  loading: "శోధిస్తున్నాం…",
  start_prompt: "ఫలితాల కోసం పైన ఒక పదం టైప్ చేయండి.",
  no_results_yet: "ఫలితాలు లేవు. వేరే పదం ప్రయత్నించండి.",
  recent_searches: "ఇటీవలి శోధనలు",
  collapse: "మూసివేయి",
  expand: "విస్తరించు",
  clear_all: "అన్నీ క్లియర్ చేయి",
  no_recent: "ఇటీవలి శోధనలు లేవు.",
  favorites: "ఇష్టమైనవి",
  no_favorites: "ఇష్టమైనవి లేవు.",
  unfavorite: "ఇష్టంనుండి తొలగించు",
  favorite: "ఇష్టంగా గుర్తించు",
  no_definitions: "వ్యాఖ్యానాలు లేవు.",
  synonyms: "పర్యాయపదాలు",
  antonyms: "విరుద్ధపదాలు",
  meanings_not_found: "అర్థాలు లభించలేదు.",
  results_for: "ఫలితాలు",
  play_pron: "ఉచ్చారణ విని",
  play_pron_wotd: "ఈరోజు పదం ఉచ్చారణ విని",
  go: "వెళ్ళు",
  remove: "తొలగించు",
  voice_start: "వాయిస్ ఇన్‌పుట్ ప్రారంభించు",
  voice_stop: "వాయిస్ ఇన్‌పుట్ ఆపు",
  speech_unsupported: "ఈ బ్రౌజర్‌లో వాయిస్ గుర్తింపు లేదు.",
  api_label: "API",
  suggestions_disabled_non_en: "ఈ భాషకు సూచనలు పరిమితం లేదా నిలిపివేయబడ్డాయి.",
  fallback_not_supported_for_lang: "పబ్లిక్ ఫాల్‌బ్యాక్ ఈ భాషను మద్దతు ఇవ్వదు; మరొక భాష లేదా బ్యాక్‌ఎండ్ వాడండి.",
  wotd_fallback_notice: "ఆంగ్లం 'ఈరోజు పదం' చూపబడుతోంది (ఫాల్‌బ్యాక్).",
};

const bundles = { en, hi, te };

// PUBLIC_INTERFACE
export function t(lang, key) {
  /** Translate key using current language, with English fallback. */
  const L = (bundles[lang] || en);
  return L[key] || en[key] || key;
}
