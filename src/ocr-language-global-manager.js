import {
  createIndexedDbOcrLanguageDriver,
  createOcrLanguageStorage,
} from "./ocr-language-storage.js";

export const OCR_LANGUAGES_CHANGED_EVENT =
  "pdfprivado:ocr-languages-changed";

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
