// ── i18n Engine ──
// Lightweight internationalization for Code Harness
// Supports 13 languages with auto-detection and fallback to English

const I18N_STORAGE_KEY = 'code-harness-lang';

const SUPPORTED_LANGS = {
  en: 'English',
  ja: '日本語',
  zh: '中文（简体）',
  ko: '한국어',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  ru: 'Русский',
  hi: 'हिन्दी',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
};

let currentLang = 'en';
let translations = {};

function detectLanguage() {
  // 1. Saved preference
  const saved = localStorage.getItem(I18N_STORAGE_KEY);
  if (saved && SUPPORTED_LANGS[saved]) return saved;
  // 2. Browser/system locale
  const nav = navigator.language || navigator.userLanguage || 'en';
  const short = nav.split('-')[0].toLowerCase();
  if (SUPPORTED_LANGS[short]) return short;
  return 'en';
}

async function loadTranslations(lang) {
  try {
    const mod = await import(`./locales/${lang}.js`);
    return mod.default || mod;
  } catch {
    if (lang !== 'en') {
      const en = await import('./locales/en.js');
      return en.default || en;
    }
    return {};
  }
}

async function initI18n(forceLang) {
  currentLang = forceLang || detectLanguage();
  translations = await loadTranslations(currentLang);
  // Always load English as fallback
  if (currentLang !== 'en') {
    const en = await loadTranslations('en');
    translations = { ...en, ...translations };
  }
  localStorage.setItem(I18N_STORAGE_KEY, currentLang);
  applyTranslations();
  return currentLang;
}

function t(key, params) {
  let str = translations[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.documentElement.lang = currentLang;
}

async function switchLanguage(lang) {
  if (!SUPPORTED_LANGS[lang]) return;
  await initI18n(lang);
}

function getCurrentLang() { return currentLang; }
function getSupportedLangs() { return { ...SUPPORTED_LANGS }; }
