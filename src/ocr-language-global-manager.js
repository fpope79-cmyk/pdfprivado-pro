import {
  createIndexedDbOcrLanguageDriver,
  createOcrLanguageStorage,
} from "./ocr-language-storage.js";

export const OCR_LANGUAGES_CHANGED_EVENT =
  "pdfprivado:ocr-languages-changed";

export const OCR_PRIMARY_LANGUAGE_PREFERENCE_KEY =
  "pdfprivado.ocr.primaryLanguage.v1";

const OCR_LOCALE_TO_LANGUAGE = Object.freeze({
  es: "spa",
  en: "eng",
  fr: "fra",
  de: "deu",
  it: "ita",
  pt: "por",
  nl: "nld",
  pl: "pol",
  ro: "ron",
  tr: "tur",
  ru: "rus",
  uk: "ukr",
  ar: "ara",
  zh: "chi_sim",
  ja: "jpn",
});

function normalizedOcrCode(value) {
  return String(value || "").trim().toLowerCase();
}

function localeToOcrCode(locale) {
  const base = String(locale || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .split("-")[0];
  return OCR_LOCALE_TO_LANGUAGE[base] || "";
}

export function readGlobalOcrPrimaryLanguagePreference() {
  try {
    return normalizedOcrCode(
      localStorage.getItem(OCR_PRIMARY_LANGUAGE_PREFERENCE_KEY)
    );
  } catch {
    return "";
  }
}

export function saveGlobalOcrPrimaryLanguagePreference(code) {
  const normalized = normalizedOcrCode(code);
  if (!normalized) return;
  try {
    localStorage.setItem(OCR_PRIMARY_LANGUAGE_PREFERENCE_KEY, normalized);
  } catch {
    // La selección continúa activa durante la sesión aunque no pueda persistirse.
  }
}

export function resolveGlobalOcrPrimaryLanguage({
  availableCodes = [],
  preferredCodes = [],
} = {}) {
  const available = [...new Set(availableCodes.map(normalizedOcrCode).filter(Boolean))];
  const installed = new Set(available);
  if (!available.length) return "";

  const explicitCandidates = [
    ...preferredCodes,
    readGlobalOcrPrimaryLanguagePreference(),
  ]
    .map(normalizedOcrCode)
    .filter(Boolean);

  for (const code of explicitCandidates) {
    if (installed.has(code)) return code;
  }

  const localeCandidates = [
    document.documentElement?.lang,
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ];

  for (const locale of localeCandidates) {
    const code = localeToOcrCode(locale);
    if (code && installed.has(code)) return code;
  }

  const optionalInstalled = available.find(
    (code) => code !== "eng" && code !== "spa"
  );
  if (optionalInstalled) return optionalInstalled;
  if (installed.has("eng")) return "eng";
  if (installed.has("spa")) return "spa";
  return available[0];
}

let sharedStorage = null;

export function getGlobalOcrLanguageStorage() {
  if (!sharedStorage) {
    sharedStorage = createOcrLanguageStorage({
      driver: createIndexedDbOcrLanguageDriver(),
    });
  }

  return sharedStorage;
}

export async function listGlobalInstalledOcrLanguages() {
  return getGlobalOcrLanguageStorage().list();
}

export function announceGlobalOcrLanguageChange({
  action = "refresh",
  code = "",
} = {}) {
  window.dispatchEvent(
    new CustomEvent(OCR_LANGUAGES_CHANGED_EVENT, {
      detail: Object.freeze({
        action: String(action || "refresh"),
        code: String(code || "").trim().toLowerCase(),
      }),
    })
  );
}

export function onGlobalOcrLanguagesChanged(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  const handler = (event) => listener(event.detail || {});
  window.addEventListener(OCR_LANGUAGES_CHANGED_EVENT, handler);

  return () => {
    window.removeEventListener(OCR_LANGUAGES_CHANGED_EVENT, handler);
  };
}


let lastFocusedElement = null;

export function openGlobalOcrLanguageManager() {
  const overlay = document.querySelector("#ocr-language-manager-overlay");
  if (!overlay) return;
  lastFocusedElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  overlay.hidden = false;
  document.body.classList.add("ocr-language-manager-open");
  requestAnimationFrame(() => {
    document.querySelector("#ocr-language-manager-close")?.focus({ preventScroll: true });
  });
}

export function closeGlobalOcrLanguageManager() {
  const overlay = document.querySelector("#ocr-language-manager-overlay");
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  document.body.classList.remove("ocr-language-manager-open");
  lastFocusedElement?.focus?.({ preventScroll: true });
  lastFocusedElement = null;
}

function initializeGlobalOcrLanguageManagerUi() {
  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-open-ocr-language-manager]")) {
      event.preventDefault();
      openGlobalOcrLanguageManager();
      return;
    }
    if (event.target.closest?.("#ocr-language-manager-close")) {
      closeGlobalOcrLanguageManager();
      return;
    }
    const overlay = event.target.closest?.("#ocr-language-manager-overlay");
    if (overlay && event.target === overlay) closeGlobalOcrLanguageManager();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeGlobalOcrLanguageManager();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeGlobalOcrLanguageManagerUi, { once: true });
} else {
  initializeGlobalOcrLanguageManagerUi();
}
