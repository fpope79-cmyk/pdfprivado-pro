import * as pdfjsLib from "./vendor/pdfjs/pdf.mjs";
import {
  buildExportDocument,
  buildPageRecord,
  resolveExportPages,
  safeBaseName,
  textItemsToStructuredText,
  textItemsToLayout,
  ocrRecordToLayout,
  mergeNativeAndOcrLayouts,
  layoutToStructuredText,
} from "./convert-export-core.js";
import {
  classifyDocxPage,
  serializeExportDocument,
} from "./convert-export-formats.js";
import {
  buildOcrRecord,
  renderPageForOcr,
} from "./ocr-core.js";
import {
  cancelOcrEngine,
  isOcrCancelledError,
  recognizeOcrImage,
} from "./ocr-worker.js";
import { createOcrBenchmarkWorkerPool } from "./ocr-benchmark-worker.js";
import { resolveOcrProfile } from "./ocr-profiles.js";

import {
  hashDocumentBytes,
  readCachedPages,
  writeOcrCacheRecord,
} from "./ocr-cache.js";
import { reconstructOcrText } from "./ocr-text-layout.js";
import { OCR_LANGUAGE_MANIFEST } from "./ocr-language-manifest.js";
import {
  getGlobalOcrLanguageStorage,
  onGlobalOcrLanguagesChanged,
  resolveGlobalOcrPrimaryLanguage,
  saveGlobalOcrPrimaryLanguagePreference,
} from "./ocr-language-global-manager.js";
import {
  cancelExternalOcrRuntime,
  isExternalOcrCancelledError,
  recognizeExternalOcrImage,
} from "./ocr-external-runtime.js";
import { suppressRasterTextInImageData } from "./raster-text-separation.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.mjs",
  import.meta.url
).href;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  view: $("#convert-export-view"),
  openButtons: $$('[data-open-tool="convert-export"]'),
  back: $("#convert-export-back"),
  fileInput: $("#convert-export-file-input"),
  choose: $("#convert-export-choose-file"),
  fileName: $("#convert-export-file-name"),
  fileMeta: $("#convert-export-file-meta"),
  format: $("#convert-export-format"),
  scope: $("#convert-export-scope"),
  rangeField: $("#convert-export-range-field"),
  range: $("#convert-export-range"),
  textMode: $("#convert-export-text-mode"),
  ocrLanguageGroup: $("#convert-export-ocr-languages"),
  ocrPrimary: $("#convert-export-ocr-primary"),
  ocrSecondary: $("#convert-export-ocr-secondary"),
  ocrLanguageSummary: $("#convert-export-language-summary"),
  layoutModes: $$('[name="convert-export-layout-mode"]'),
  headings: $("#convert-export-page-headings"),
  analyze: $("#convert-export-analyze"),
  exportButton: $("#convert-export-save"),
  cancel: $("#convert-export-cancel"),
  status: $("#convert-export-status"),
  progress: $("#convert-export-progress"),
  progressText: $("#convert-export-progress-text"),
  preview: $("#convert-export-preview"),
  previewTabs: $$("[data-preview-mode]"),
  documentPane: $("#convert-export-document-pane"),
  textPane: $("#convert-export-text-pane"),
  documentStage: $("#convert-export-document-stage"),
  documentCanvas: $("#convert-export-document-canvas"),
  documentEmpty: $("#convert-export-document-empty"),
  documentPrev: $("#convert-export-document-prev"),
  documentNext: $("#convert-export-document-next"),
  documentPage: $("#convert-export-document-page"),
  documentCounter: $("#convert-export-document-counter"),
  documentZoomOut: $("#convert-export-document-zoom-out"),
  documentZoomIn: $("#convert-export-document-zoom-in"),
  documentZoom: $("#convert-export-document-zoom"),
  documentFit: $("#convert-export-document-fit"),
  stats: $("#convert-export-stats"),
};

if (!els.view) {
  console.warn("Convertir y exportar no está disponible en este documento.");
} else {
  const state = {
    file: null,
    bytes: null,
    pdf: null,
    pageCount: 0,
    document: null,
    serialized: null,
    structuredPages: [],
    busy: false,
    cancelled: false,
    renderTasks: new Set(),
    documentPreviewMode: "document",
    documentPreviewPage: 1,
    documentPreviewScale: 1,
    documentPreviewFitWidth: true,
    documentPreviewTask: null,
    documentPreviewSerial: 0,
    documentPreviewResizeTimer: 0,
    sourceKind: "standalone",
    ocrRecords: new Map(),
    ocrPool: null,
    documentHash: "",
    persistentCache: new Map(),
    cacheHits: 0,
    balancedOcrPool: null,
    preciseOcrPool: null,
    installedOcrLanguages: new Map(),
    externalOcrModels: [],
    usesExternalOcr: false,
    ocrLanguagesInitialized: false,
    adaptive: {
      fastAccepted: 0,
      balancedRetried: 0,
      preciseRetried: 0,
      blankSkipped: 0,
      croppedPages: 0,
    },
  };

  const SETTINGS_KEY = "pdfprivado.convertExport.v3";
  const NATIVE_TEXT_MINIMUM = 8;
  const ocrLanguageStorage = getGlobalOcrLanguageStorage();

  function selectedLayoutMode() {
    return (
      els.layoutModes.find((input) => input.checked)?.value ||
      "continuous"
    );
  }

  function setSelectedLayoutMode(value) {
    const safeValue = ["continuous", "clean-lines", "original"].includes(value)
      ? value
      : "continuous";

    for (const input of els.layoutModes) {
      input.checked = input.value === safeValue;
    }
  }

  function selectedOcrLanguages() {
    const availableCodes = new Set(
      [...els.ocrPrimary.options]
        .map((option) => option.value)
        .filter(Boolean)
    );

    const primary = availableCodes.has(els.ocrPrimary?.value)
      ? els.ocrPrimary.value
      : resolveGlobalOcrPrimaryLanguage({ availableCodes: [...availableCodes] });
    const secondary = availableCodes.has(els.ocrSecondary?.value)
      ? els.ocrSecondary.value
      : "";

    return secondary && secondary !== primary
      ? [primary, secondary]
      : [primary];
  }

  function languageDefinition(code) {
    return OCR_LANGUAGE_MANIFEST.find(
      (language) => language.code === code
    ) || null;
  }

  function savedOcrLanguageSelection() {
    try {
      const value = JSON.parse(
        localStorage.getItem(SETTINGS_KEY) || "{}"
      );
      return {
        primary: String(value.ocrPrimary || ""),
        secondary: String(value.ocrSecondary || ""),
      };
    } catch {
      return { primary: "", secondary: "" };
    }
  }

  function createLanguageOption(language, value = language.code) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = language.label;
    option.dataset.optional = language.installed ? "false" : "true";
    return option;
  }

  async function refreshOcrLanguageOptions() {
    const previous = {
      primary: els.ocrPrimary?.value || "",
      secondary: els.ocrSecondary?.value || "",
    };
    const saved = savedOcrLanguageSelection();

    const installedOptional = await ocrLanguageStorage.list();
    state.installedOcrLanguages = new Map(
      installedOptional.map((record) => [record.code, record])
    );

    const available = OCR_LANGUAGE_MANIFEST.filter(
      (language) =>
        language.installed ||
        state.installedOcrLanguages.has(language.code)
    );

    els.ocrPrimary.replaceChildren(
      ...available.map((language) =>
        createLanguageOption(language)
      )
    );

    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Ninguno";

    els.ocrSecondary.replaceChildren(
      none,
      ...available.map((language) =>
        createLanguageOption(language)
      )
    );

    const availableCodes = new Set(
      available.map((language) => language.code)
    );

    const primaryCandidate = resolveGlobalOcrPrimaryLanguage({
      availableCodes: [...availableCodes],
      preferredCodes: [
        saved.primary,
        state.ocrLanguagesInitialized ? previous.primary : "",
      ],
    });

    els.ocrPrimary.value = primaryCandidate;
    state.ocrLanguagesInitialized = true;

    const secondaryCandidate = [
      previous.secondary,
      saved.secondary,
    ].find(
      (code) =>
        code &&
        availableCodes.has(code) &&
        code !== els.ocrPrimary.value
    );

    els.ocrSecondary.value = secondaryCandidate || "";
    updateOcrLanguageUi();
    if (els.ocrLanguageSummary) {
      const count = available.length;
      els.ocrLanguageSummary.textContent = `${count} ${count === 1 ? "idioma OCR disponible" : "idiomas OCR disponibles"} en este equipo.`;
    }
  }

  async function readBundledOcrModel(code) {
    const language = languageDefinition(code);
    if (!language?.installed) return null;

    const response = await fetch(
      new URL(
        `./vendor/tesseract/lang/${language.file}`,
        import.meta.url
      )
    );

    if (!response.ok) {
      throw new Error(
        `No se pudo abrir el modelo OCR local ${language.label}.`
      );
    }

    return {
      code,
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  }

  async function prepareExternalOcrModels(languageCodes) {
    const models = [];

    for (const code of languageCodes) {
      const language = languageDefinition(code);

      if (!language) {
        throw new Error(`El idioma OCR ${code} no existe.`);
      }

      if (language.installed) {
        const bundled = await readBundledOcrModel(code);
        models.push(bundled);
        continue;
      }

      const verified = await ocrLanguageStorage.readVerified(code);

      if (!verified) {
        throw new Error(
          `${language.label} no está instalado en este equipo.`
        );
      }

      models.push({
        code,
        bytes: verified.bytes,
      });
    }

    return models;
  }

  function updateOcrLanguageUi() {
    const nativeOnly = els.textMode.value === "native";
    const disabled = state.busy || nativeOnly;

    if (
      els.ocrSecondary &&
      els.ocrSecondary.value &&
      els.ocrSecondary.value === els.ocrPrimary?.value
    ) {
      els.ocrSecondary.value = "";
    }

    if (els.ocrLanguageGroup) {
      els.ocrLanguageGroup.hidden = nativeOnly;
    }

    if (els.ocrPrimary) {
      els.ocrPrimary.disabled = disabled;

      for (const option of els.ocrPrimary.options) {
        option.disabled = Boolean(
          option.value &&
          option.value === els.ocrSecondary?.value
        );
      }
    }

    if (els.ocrSecondary) {
      els.ocrSecondary.disabled = disabled;

      for (const option of els.ocrSecondary.options) {
        option.disabled = Boolean(
          option.value &&
          option.value === els.ocrPrimary?.value
        );
      }
    }
  }
  function closeAppMenus() {
    $$("[data-app-menu]").forEach((menu) => {
      const trigger = menu.querySelector(".app-menu-trigger");
      const dropdown = menu.querySelector(".app-menu-dropdown");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      if (dropdown) dropdown.hidden = true;
    });
  }

  function showOnly(view) {
    $$(".app-view").forEach((item) => {
      item.hidden = item !== view;
    });
    document.body.classList.remove("viewer-active");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function setStatus(message, kind = "info") {
    els.status.textContent = message;
    els.status.dataset.kind = kind;
  }

  function setBusy(busy) {
    state.busy = busy;
    els.choose.disabled = busy;
    els.analyze.disabled = busy || !state.pdf;
    els.exportButton.disabled = busy || !state.serialized;
    els.cancel.hidden = !busy;
    els.cancel.disabled = false;
    els.format.disabled = busy;
    els.scope.disabled = busy;
    els.range.disabled = busy;
    els.textMode.disabled = busy;
    updateOcrLanguageUi();
    for (const input of els.layoutModes) input.disabled = busy;
  }

  async function destroyOcrPoolSafely(pool, timeoutMs = 1500) {
    if (!pool) return;

    let timeoutId = null;

    try {
      await Promise.race([
        Promise.resolve(pool.destroy()),
        new Promise((resolve) => {
          timeoutId = window.setTimeout(resolve, timeoutMs);
        }),
      ]);
    } catch (error) {
      console.warn("No se pudo cerrar completamente un worker OCR.", error);
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        format: els.format.value,
        scope: els.scope.value,
        textMode: els.textMode.value,
        ocrPrimary: els.ocrPrimary?.value || "",
        ocrSecondary: els.ocrSecondary?.value || "",
        headings: els.headings.checked,
        layoutMode: selectedLayoutMode(),
      }));
    } catch {}
  }

  function restoreSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (["docx", "txt", "json", "html", "markdown"].includes(value.format)) {
        els.format.value = value.format;
      }
      if (["all", "current", "range"].includes(value.scope)) {
        els.scope.value = value.scope;
      }
      if (["auto", "native", "ocr"].includes(value.textMode)) {
        els.textMode.value = value.textMode;
      }
      if (
        els.ocrPrimary &&
        [...els.ocrPrimary.options].some(
          (option) => option.value === value.ocrPrimary
        )
      ) {
        els.ocrPrimary.value = value.ocrPrimary;
      }

      if (
        els.ocrSecondary &&
        [...els.ocrSecondary.options].some(
          (option) => option.value === value.ocrSecondary
        ) &&
        value.ocrSecondary !== els.ocrPrimary?.value
      ) {
        els.ocrSecondary.value = value.ocrSecondary;
      }
      if (typeof value.headings === "boolean") {
        els.headings.checked = value.headings;
      }
    } catch {}
    updateScopeUi();
    updateOcrLanguageUi();
  }

  function updateScopeUi() {
    els.rangeField.hidden = els.scope.value !== "range";
    saveSettings();
  }

  function resetResult() {
    state.document = null;
    state.serialized = null;
    els.preview.textContent =
      "La vista previa aparecerá después de analizar el documento.";
    els.stats.replaceChildren();
    els.exportButton.disabled = true;
    els.progress.value = 0;
    delete els.progress.dataset.complete;
    els.progressText.textContent = "Sin procesar";
  }
  function clearStructuredResult() {
    state.structuredPages = [];
    resetResult();
  }

  function presentationCanRefresh() {
    return Boolean(
      state.document &&
      Array.isArray(state.structuredPages) &&
      state.structuredPages.length
    );
  }

  function rebuildPresentation() {
    if (!presentationCanRefresh()) return false;

    const mode = selectedLayoutMode();
    const pages = state.structuredPages.map((page) => {
      let text = page.nativeText || "";

      if (page.source === "ocr" && page.ocrRecord) {
        text = reconstructOcrText(page.ocrRecord, mode);
      } else if (page.source === "hybrid" && Array.isArray(page.layout)) {
        text = layoutToStructuredText(page.layout, { pageHeight: page.height });
      }

      return buildPageRecord({
        pageNumber: page.pageNumber,
        text,
        source: page.source,
        width: page.width,
        height: page.height,
        language: page.language,
        layout: Array.isArray(page.layout)
          ? page.layout
          : page.source === "ocr" && page.ocrRecord
            ? ocrRecordToLayout(page.ocrRecord, page.width, page.height)
            : null,
      });
    });

    state.document = buildExportDocument({
      sourceName: state.file.name,
      totalPages: state.pageCount,
      exportedPages: pages.map((page) => page.pageNumber),
      textMode: els.textMode.value,
      readingOrder: "native",
      pages,
      elapsedMs: state.document.statistics?.elapsedMs || 0,
    });

    refreshSerializedPreview();
    renderStats(state.document);
    els.progress.value = 100;
    els.progress.dataset.complete = "true";
    els.progressText.textContent =
      `100% · vista previa actualizada sin repetir OCR`;
    setStatus(
      "Vista previa actualizada instantáneamente. No se ha repetido el OCR.",
      "success"
    );
    return true;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );
    const value = bytes / (1024 ** index);
    return `${value.toFixed(index === 0 || value >= 100 ? 0 : 1)} ${units[index]}`;
  }

  async function replacePdf(file, bytes, sourceKind = "standalone") {
    cancelDocumentPreviewRender({ release: true });
    if (state.pdf) {
      try {
        await state.pdf.destroy();
      } catch {}
    }

    const sourceBytes = bytes instanceof Uint8Array
      ? bytes.slice()
      : new Uint8Array(await file.arrayBuffer());

    const pdf = await pdfjsLib.getDocument({
      data: sourceBytes.slice(),
    }).promise;

    state.file = file;
    state.bytes = sourceBytes;
    state.pdf = pdf;
    state.pageCount = pdf.numPages;
    state.sourceKind = sourceKind;
    state.documentHash = await hashDocumentBytes(sourceBytes);
    state.persistentCache.clear();
    state.cacheHits = 0;

    els.fileName.textContent = file.name;
    els.fileMeta.textContent =
      `${pdf.numPages} páginas · ${formatBytes(sourceBytes.byteLength)}` +
      (sourceKind === "viewer" ? " · reutilizado del visor" : "");
    els.range.placeholder = `Ej.: 1-3,5,8-${pdf.numPages}`;
    els.analyze.disabled = false;
    clearStructuredResult();
    resetDocumentPreviewForPdf();
  }

  async function loadFile(file) {
    if (!file) return;

    setBusy(true);
    resetResult();
    state.ocrRecords.clear();
    state.persistentCache.clear();
    state.cacheHits = 0;
    setStatus("Abriendo el PDF localmente…");

    try {
      await replacePdf(file, null, "standalone");
      setStatus(
        "PDF preparado. El modo automático aplicará OCR solo cuando sea necesario.",
        "success"
      );
    } catch (error) {
      console.error(error);
      state.file = null;
      state.pdf = null;
      state.pageCount = 0;
      resetDocumentPreviewForPdf();
      els.fileName.textContent = "Ningún PDF seleccionado";
      els.fileMeta.textContent =
        "El documento permanece siempre en este equipo.";
      setStatus(
        "No se pudo abrir el PDF. Comprueba que el archivo no esté dañado.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  async function preloadViewerDocument() {
    const bridge = window.PDFPrivadoProtectionBridge;
    if (typeof bridge?.buildCurrentDocumentBytes !== "function") {
      return false;
    }

    try {
      const current = await bridge.buildCurrentDocumentBytes();
      if (
        !current?.hasDocument ||
        !(current.bytes instanceof Uint8Array)
      ) {
        return false;
      }

      const file = new File(
        [current.bytes],
        current.name || "documento.pdf",
        {
          type: "application/pdf",
          lastModified: Date.now(),
        }
      );

      await replacePdf(file, current.bytes, "viewer");

      state.ocrRecords.clear();
      const ocrBridge = window.PDFPrivadoConvertExportBridge;
      const existingOcr =
        typeof ocrBridge?.getCurrentOcrRecords === "function"
          ? ocrBridge.getCurrentOcrRecords()
          : [];

      for (const record of existingOcr || []) {
        if (record?.pageNumber && record?.text) {
          state.ocrRecords.set(record.pageNumber, record);
        }
      }

      setStatus(
        current.changed
          ? "Se ha cargado la versión actual del documento abierto en el visor."
          : "Se ha reutilizado automáticamente el PDF abierto en el visor.",
        "success"
      );
      return true;
    } catch (error) {
      console.warn(
        "No se pudo reutilizar el documento del visor.",
        error
      );
      return false;
    }
  }

  function resetAdaptiveStats() {
    state.adaptive.fastAccepted = 0;
    state.adaptive.balancedRetried = 0;
    state.adaptive.preciseRetried = 0;
    state.adaptive.blankSkipped = 0;
    state.adaptive.croppedPages = 0;
  }

  function resolveAdaptiveWorkerCount(pageCount = 1) {
    const logicalCores = Math.max(1, Number(navigator.hardwareConcurrency) || 2);
    const memoryGb = Math.max(0, Number(navigator.deviceMemory) || 0);

    let workers = logicalCores >= 12 ? 4 : logicalCores >= 8 ? 3 : 2;

    if (memoryGb && memoryGb < 8) workers = Math.min(workers, 2);
    if (memoryGb && memoryGb < 4) workers = 1;

    return Math.max(1, Math.min(workers, pageCount, 4));
  }

  function ocrRecordQuality(record) {
    const text = String(record?.text || "").trim();
    const words = Array.isArray(record?.words) ? record.words.length : 0;
    const confidence = Number.isFinite(record?.confidence)
      ? Number(record.confidence)
      : null;
    const visibleCharacters = text.replace(/\s/gu, "").length;
    const suspiciousCharacters =
      text.match(/[^\p{L}\p{N}\p{P}\p{Z}\r\n\t]/gu)?.length || 0;
    const suspiciousRatio = visibleCharacters
      ? suspiciousCharacters / visibleCharacters
      : 0;

    const enoughContent = words >= 3 || visibleCharacters >= 24;
    const confidenceGood = confidence === null || confidence >= 72;
    const cleanEnough = suspiciousRatio <= 0.08;

    return {
      accepted: Boolean(text && enoughContent && confidenceGood && cleanEnough),
      confidence,
      words,
      visibleCharacters,
      suspiciousRatio,
    };
  }


  function ocrQualityScore(quality) {
    const confidence = Number.isFinite(Number(quality?.confidence))
      ? Number(quality.confidence)
      : 68;
    const visibleCharacters = Math.max(0, Number(quality?.visibleCharacters) || 0);
    const words = Math.max(0, Number(quality?.words) || 0);
    const suspiciousRatio = Math.max(0, Number(quality?.suspiciousRatio) || 0);
    return (
      (quality?.accepted ? 28 : 0) +
      confidence +
      Math.min(10, Math.log2(visibleCharacters + 1) * 1.25) +
      Math.min(4, Math.log2(words + 1) * 0.75) -
      suspiciousRatio * 125
    );
  }

  function shouldTryPreciseOcr(quality) {
    if (!quality) return true;
    if (!quality.accepted) return true;
    const confidence = Number(quality.confidence);
    return (
      (Number.isFinite(confidence) && confidence < 82) ||
      Number(quality.suspiciousRatio || 0) > 0.035
    );
  }

  function chooseBetterOcrRecord(primaryRecord, candidateRecord) {
    if (!candidateRecord?.text) return primaryRecord;
    if (!primaryRecord?.text) return candidateRecord;
    const primaryQuality = ocrRecordQuality(primaryRecord);
    const candidateQuality = ocrRecordQuality(candidateRecord);

    // Una pasada más precisa puede subir la confianza simplemente porque
    // omitió las palabras difíciles. No aceptamos esa falsa mejora cuando la
    // pasada primaria ya era coherente: debe conservar prácticamente toda la
    // cobertura textual antes de competir por puntuación.
    if (primaryQuality.accepted) {
      const characterCoverage =
        candidateQuality.visibleCharacters /
        Math.max(1, primaryQuality.visibleCharacters);
      const wordCoverage =
        candidateQuality.words / Math.max(1, primaryQuality.words);
      if (characterCoverage < 0.90 || (primaryQuality.words >= 8 && wordCoverage < 0.84)) {
        return primaryRecord;
      }
    }

    const primaryScore = ocrQualityScore(primaryQuality);
    const candidateScore = ocrQualityScore(candidateQuality);
    return candidateScore >= primaryScore + 1.5
      ? candidateRecord
      : primaryRecord;
  }

  function analyzeCanvasInk(canvas) {
    const width = canvas?.width || 0;
    const height = canvas?.height || 0;
    if (!width || !height) {
      return { blank: true, bounds: null, inkRatio: 0 };
    }

    const sampleWidth = Math.min(240, width);
    const sampleHeight = Math.max(
      1,
      Math.round((height / width) * sampleWidth)
    );
    const sample = document.createElement("canvas");
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const context = sample.getContext("2d", { alpha: false });
    context.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);

    const data = context.getImageData(
      0,
      0,
      sampleWidth,
      sampleHeight
    ).data;

    let minX = sampleWidth;
    let minY = sampleHeight;
    let maxX = -1;
    let maxY = -1;
    let ink = 0;
    const threshold = 238;

    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        const index = (y * sampleWidth + x) * 4;
        const gray =
          data[index] * 0.299 +
          data[index + 1] * 0.587 +
          data[index + 2] * 0.114;

        if (gray >= threshold) continue;

        ink += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    const total = sampleWidth * sampleHeight;
    const inkRatio = total ? ink / total : 0;
    if (inkRatio < 0.00045 || maxX < minX || maxY < minY) {
      return { blank: true, bounds: null, inkRatio };
    }

    const margin = 5;
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(sampleWidth - 1, maxX + margin);
    maxY = Math.min(sampleHeight - 1, maxY + margin);

    return {
      blank: false,
      inkRatio,
      bounds: {
        x: Math.floor((minX / sampleWidth) * width),
        y: Math.floor((minY / sampleHeight) * height),
        width: Math.max(
          1,
          Math.ceil(((maxX - minX + 1) / sampleWidth) * width)
        ),
        height: Math.max(
          1,
          Math.ceil(((maxY - minY + 1) / sampleHeight) * height)
        ),
      },
    };
  }

  function cropCanvasForOcr(canvas, analysis) {
    const bounds = analysis?.bounds;
    if (!bounds) return canvas;

    const coverage =
      (bounds.width * bounds.height) /
      Math.max(1, canvas.width * canvas.height);

    if (coverage > 0.9) return canvas;

    const cropped = document.createElement("canvas");
    cropped.width = bounds.width;
    cropped.height = bounds.height;
    const context = cropped.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, cropped.width, cropped.height);
    context.drawImage(
      canvas,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );
    state.adaptive.croppedPages += 1;
    return cropped;
  }

  function nativeTextIsUseful(text) {
    const visible = String(text || "").replace(/\s/gu, "");
    const lettersOrNumbers =
      visible.match(/[\p{L}\p{N}]/gu)?.length || 0;
    return lettersOrNumbers >= NATIVE_TEXT_MINIMUM;
  }

  function rasterContentMayContainEditableText(metrics = {}) {
    const imageOperations = Math.max(0, Number(metrics?.imageOperations) || 0);
    const totalCoverage = Math.max(0, Number(metrics?.imageCoverageRatio) || 0);
    const maxCoverage = Math.max(0, Number(metrics?.maxImageCoverageRatio) || 0);
    if (!imageOperations) return false;
    // Una imagen diminuta suele ser un logo o icono y debe permanecer como
    // gráfico. A partir de esta cobertura ya puede ser una captura, un recorte
    // escaneado o una región de documento con texto que el usuario espera poder
    // editar. El OCR posterior y la deduplicación deciden si realmente aporta
    // contenido adicional.
    return maxCoverage >= 0.10 || totalCoverage >= 0.16;
  }

  async function inspectRasterContentForHybridOcr(page, pageRecord = {}) {
    try {
      const operatorList = await page.getOperatorList();
      const metrics = docxOperatorMetrics(operatorList, pageRecord);
      return {
        metrics,
        needsHybridOcr: rasterContentMayContainEditableText(metrics),
      };
    } catch (error) {
      console.warn("[PDF→Word] No se pudo inspeccionar contenido raster híbrido.", error);
      return { metrics: null, needsHybridOcr: false };
    }
  }

  function buildHybridPageContent({
    nativeText = "",
    nativeLayout = [],
    ocrRecord = null,
    width = 595.28,
    height = 841.89,
  } = {}) {
    if (!ocrRecord?.text) {
      return {
        source: nativeTextIsUseful(nativeText) ? "native" : "empty",
        text: nativeText,
        layout: nativeLayout,
        extraOcrLines: 0,
      };
    }
    const ocrLayout = ocrRecordToLayout(ocrRecord, width, height);
    const mergedLayout = mergeNativeAndOcrLayouts(nativeLayout, ocrLayout, {
      pageHeight: height,
    });
    const extraOcrLines = mergedLayout.filter(
      (line) => String(line?.source || "").toLocaleLowerCase() === "ocr"
    ).length;
    if (!extraOcrLines) {
      return {
        source: nativeTextIsUseful(nativeText) ? "native" : "empty",
        text: nativeText,
        layout: nativeLayout,
        extraOcrLines: 0,
      };
    }
    return {
      source: "hybrid",
      text: layoutToStructuredText(mergedLayout, { pageHeight: height }),
      layout: mergedLayout,
      extraOcrLines,
    };
  }

  async function recognizePageWithOcr(
    page,
    pageNumber,
    pageIndex,
    pageTotal,
    workerPool,
    profile,
    languageCodes = ["spa"],
    externalModels = null
  ) {
    let rendered = null;
    let preparedCanvas = null;
    let renderTask = null;

    try {
      rendered = await renderPageForOcr(
        page,
        { rotation: 0 },
        {
          ...profile.render,
          onRenderTask(task) {
            if (renderTask) state.renderTasks.delete(renderTask);
            renderTask = task;
            if (task) state.renderTasks.add(task);
          },
          isCancelled() {
            return state.cancelled;
          },
        }
      );

      const ink = analyzeCanvasInk(rendered.canvas);
      if (ink.blank) {
        state.adaptive.blankSkipped += 1;
        return {
          record: buildOcrRecord(
            { text: "", blocks: [], confidence: null },
            {
              imageWidth: rendered.width,
              imageHeight: rendered.height,
              language: languageCodes.join("+"),
              languageLabel: "OCR automático",
              rotation: rendered.rotation,
              effectiveDpi: rendered.effectiveDpi,
            }
          ),
          blank: true,
        };
      }

      preparedCanvas = cropCanvasForOcr(rendered.canvas, ink);

      const recognize = externalModels
        ? (image, options) =>
            recognizeExternalOcrImage(
              image,
              languageCodes,
              externalModels,
              {
                parameters: profile.tesseract,
                ...options,
              }
            )
        : workerPool
          ? (image, options) => workerPool.recognize(image, options)
          : (image, options) =>
              recognizeOcrImage(image, languageCodes, {
                parameters: profile.tesseract,
                ...options,
              });

      const result = await recognize(preparedCanvas, {
        onProgress(message) {
          if (state.cancelled) return;
          const local = Math.max(
            0,
            Math.min(1, Number(message?.progress) || 0)
          );
          const overall = Math.round(
            ((pageIndex + local) / pageTotal) * 100
          );
          els.progress.value = overall;
          els.progressText.textContent =
            `${overall}% · OCR página ${pageNumber}`;
        },
      });

      const record = buildOcrRecord(result?.data, {
        imageWidth: preparedCanvas.width,
        imageHeight: preparedCanvas.height,
        language: languageCodes.join("+"),
        languageLabel: "OCR automático",
        rotation: rendered.rotation,
        effectiveDpi: rendered.effectiveDpi,
      });
      record.pageImageWidth = rendered.width;
      record.pageImageHeight = rendered.height;
      record.cropX = preparedCanvas === rendered.canvas ? 0 : (ink.bounds?.x || 0);
      record.cropY = preparedCanvas === rendered.canvas ? 0 : (ink.bounds?.y || 0);
      return { record, blank: false };
    } finally {
      if (renderTask) state.renderTasks.delete(renderTask);

      if (
        preparedCanvas &&
        preparedCanvas !== rendered?.canvas
      ) {
        preparedCanvas.width = 1;
        preparedCanvas.height = 1;
      }

      if (rendered?.canvas) {
        rendered.canvas.width = 1;
        rendered.canvas.height = 1;
      }
    }
  }

  /* PDFPRIVADO_CONVERT_EXPORT_DOCUMENT_PREVIEW_V1 */
  function cancelDocumentPreviewRender({ release = false } = {}) {
    state.documentPreviewSerial += 1;
    try {
      state.documentPreviewTask?.cancel?.();
    } catch {}
    state.documentPreviewTask = null;

    if (release && els.documentCanvas) {
      els.documentCanvas.width = 1;
      els.documentCanvas.height = 1;
      els.documentCanvas.style.width = "1px";
      els.documentCanvas.style.height = "1px";
    }
  }

  function clampDocumentPreviewPage(value) {
    const total = Math.max(0, Number(state.pageCount) || 0);
    if (!total) return 1;
    return Math.max(1, Math.min(Math.trunc(Number(value) || 1), total));
  }

  function updateDocumentPreviewControls() {
    const hasPdf = Boolean(state.pdf && state.pageCount);
    const page = clampDocumentPreviewPage(state.documentPreviewPage);
    state.documentPreviewPage = page;

    if (els.documentPage) {
      els.documentPage.disabled = !hasPdf;
      els.documentPage.min = "1";
      els.documentPage.max = String(Math.max(1, state.pageCount || 1));
      els.documentPage.value = String(page);
    }
    if (els.documentCounter) {
      els.documentCounter.textContent = `/ ${hasPdf ? state.pageCount : 0}`;
    }
    if (els.documentPrev) {
      els.documentPrev.disabled = !hasPdf || page <= 1;
    }
    if (els.documentNext) {
      els.documentNext.disabled = !hasPdf || page >= state.pageCount;
    }
    for (const control of [
      els.documentZoomOut,
      els.documentZoomIn,
      els.documentFit,
    ]) {
      if (control) control.disabled = !hasPdf;
    }
    if (els.documentZoom) {
      els.documentZoom.textContent = state.documentPreviewFitWidth
        ? "Ajustar"
        : `${Math.round(state.documentPreviewScale * 100)}%`;
    }
  }

  async function renderDocumentPreview() {
    updateDocumentPreviewControls();
    cancelDocumentPreviewRender();

    if (
      state.documentPreviewMode !== "document" ||
      !state.pdf ||
      !state.pageCount ||
      !els.documentCanvas ||
      !els.documentStage
    ) {
      if (els.documentEmpty) {
        els.documentEmpty.hidden = Boolean(state.pdf && state.pageCount);
      }
      return;
    }

    const serial = ++state.documentPreviewSerial;
    const pageNumber = clampDocumentPreviewPage(state.documentPreviewPage);
    state.documentPreviewPage = pageNumber;
    if (els.documentEmpty) els.documentEmpty.hidden = true;

    let page = null;
    try {
      page = await state.pdf.getPage(pageNumber);
      if (serial !== state.documentPreviewSerial) return;

      const rotation = Number(page.rotate) || 0;
      const base = page.getViewport({ scale: 1, rotation });
      const stageWidth = Math.max(
        120,
        els.documentStage.clientWidth - 32
      );
      const scale = state.documentPreviewFitWidth
        ? Math.max(0.05, stageWidth / Math.max(1, base.width))
        : Math.max(0.25, Math.min(4, state.documentPreviewScale));
      const viewport = page.getViewport({ scale, rotation });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = els.documentCanvas;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("No se pudo preparar el lienzo del documento.");

      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      canvas.style.width = `${Math.max(1, Math.round(viewport.width))}px`;
      canvas.style.height = `${Math.max(1, Math.round(viewport.height))}px`;

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      const task = page.render({
        canvasContext: context,
        viewport,
        transform:
          outputScale === 1
            ? null
            : [outputScale, 0, 0, outputScale, 0, 0],
      });
      state.documentPreviewTask = task;
      await task.promise;

      if (serial !== state.documentPreviewSerial) return;
      state.documentPreviewTask = null;
      updateDocumentPreviewControls();
    } catch (error) {
      if (error?.name !== "RenderingCancelledException") {
        console.warn("No se pudo renderizar la vista previa del documento.", error);
        if (els.documentEmpty) {
          els.documentEmpty.hidden = false;
          els.documentEmpty.textContent =
            "No se pudo mostrar esta página del PDF.";
        }
      }
    } finally {
      try {
        page?.cleanup?.();
      } catch {}
    }
  }

  function setDocumentPreviewMode(mode) {
    state.documentPreviewMode = mode === "text" ? "text" : "document";

    for (const tab of els.previewTabs || []) {
      const active = tab.dataset.previewMode === state.documentPreviewMode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }

    if (els.documentPane) {
      els.documentPane.hidden = state.documentPreviewMode !== "document";
    }
    if (els.textPane) {
      els.textPane.hidden = state.documentPreviewMode !== "text";
    }

    if (state.documentPreviewMode === "document") {
      requestAnimationFrame(() => {
        void renderDocumentPreview();
      });
    } else {
      cancelDocumentPreviewRender();
    }
  }

  function resetDocumentPreviewForPdf() {
    cancelDocumentPreviewRender({ release: true });
    state.documentPreviewPage = 1;
    state.documentPreviewScale = 1;
    state.documentPreviewFitWidth = true;
    if (els.documentEmpty) {
      els.documentEmpty.hidden = Boolean(state.pdf && state.pageCount);
      els.documentEmpty.textContent = state.pdf
        ? "Preparando la vista visual del documento…"
        : "Selecciona un PDF para mostrar el documento.";
    }
    updateDocumentPreviewControls();
    if (state.documentPreviewMode === "document" && state.pdf) {
      requestAnimationFrame(() => {
        void renderDocumentPreview();
      });
    }
  }

  function renderStats(exportDocument) {
    const stats = exportDocument.statistics;
    const items = [
      ["Páginas", `${stats.processedPages}/${stats.requestedPages}`],
      ["PDF", String(stats.nativePages)],
      ["OCR", String(stats.ocrPages)],
      ["Híbridas", String(stats.hybridPages || 0)],
      ["Vacías", String(stats.emptyPages)],
      ["Palabras", stats.words.toLocaleString("es-ES")],
      ["Rápidas", String(state.adaptive.fastAccepted)],
      ["Repetidas", String(state.adaptive.balancedRetried)],
      ["Caché", String(state.cacheHits)],
      ["Tiempo", `${stats.elapsedMs} ms`],
    ];

    els.stats.replaceChildren(
      ...items.map(([label, value]) => {
        const card = window.document.createElement("div");
        card.className = "convert-export-stat";

        const strong = window.document.createElement("strong");
        strong.textContent = value;

        const span = window.document.createElement("span");
        span.textContent = label;

        card.append(strong, span);
        return card;
      })
    );
  }

  function refreshSerializedPreview() {
    if (!state.document) return;

    state.serialized = serializeExportDocument(
      state.document,
      els.format.value,
      {
        includePageHeadings: els.headings.checked,
        layoutMode: selectedLayoutMode(),
      }
    );

    const previewLimit = 30000;
    const preview = state.serialized.content;
    els.preview.textContent =
      preview.length > previewLimit
        ? `${preview.slice(0, previewLimit)}\n\n[… vista previa recortada …]`
        : preview;

    els.exportButton.disabled = false;
  }

  async function analyze() {
    if (!state.pdf || state.busy) return;

    const resolved = resolveExportPages({
      mode: els.scope.value,
      pageCount: state.pageCount,
      currentPage: 1,
      expression: els.range.value,
    });

    if (resolved.errors.length) {
      setStatus(resolved.errors[0], "error");
      return;
    }

    state.cancelled = false;
    resetAdaptiveStats();
    setBusy(true);
    setStatus("OCR adaptativo: primera pasada rápida…");

    const started = performance.now();
    const textMode = els.textMode.value;
    const languageCodes = selectedOcrLanguages();
    const languageKey = languageCodes.join("+");
    const usesExternalOcr = languageCodes.some(
      (code) => !languageDefinition(code)?.installed
    );
    state.usesExternalOcr = usesExternalOcr;
    state.externalOcrModels = usesExternalOcr
      ? await prepareExternalOcrModels(languageCodes)
      : [];
    const fastProfile = resolveOcrProfile("fast");
    const balancedProfile = resolveOcrProfile("balanced");
    const preciseProfile = resolveOcrProfile("precise");
    const records = new Array(resolved.pages.length);
    const structuredPages = new Array(resolved.pages.length);
    state.cacheHits = 0;
    state.persistentCache = await readCachedPages({
      documentHash: state.documentHash,
      pages: resolved.pages,
      languageKey,
      profileKey: "fast",
      rotation: 0,
      engineVersion: "tesseract-local-v1",
    });
    const retryQueue = [];
    let completed = 0;
    let reusedOcr = 0;

    try {
      const workerCount = resolveAdaptiveWorkerCount(
        resolved.pages.length
      );

      if (textMode !== "native" && !usesExternalOcr) {
        state.ocrPool = await createOcrBenchmarkWorkerPool({
          languages: languageCodes,
          parameters: fastProfile.tesseract,
          size: workerCount,
        });
      }

      let cursor = 0;

      async function processFastPass() {
        while (!state.cancelled) {
          const index = cursor;
          cursor += 1;
          if (index >= resolved.pages.length) return;

          const pageNumber = resolved.pages[index];
          const page = await state.pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });

          try {
            let nativeText = "";
            let nativeLayout = null;
            let text = "";
            let source = "empty";
            let layout = null;
            let activeOcrRecord = null;
            let visualMetrics = null;
            let hybridRequested = false;

            if (textMode !== "ocr") {
              const content = await page.getTextContent({
                includeMarkedContent: false,
                disableNormalization: false,
              });
              nativeText = textItemsToStructuredText(
                content.items || []
              );
              nativeLayout = textItemsToLayout(
                content.items || [],
                content.styles || {},
                viewport.width,
                viewport.height
              );
            }

            const nativeStrong =
              textMode === "auto" &&
              nativeTextIsUseful(nativeText) &&
              (
                String(nativeText || "").replace(/\s+/gu, "").length >= 160 ||
                (Array.isArray(nativeLayout) && nativeLayout.length >= 8)
              );

            // En automático, una capa de texto nativa ya no implica que todo
            // el texto visible sea nativo. Una captura o un escaneado parcial
            // incrustado puede contener texto adicional. Solo activamos OCR
            // híbrido cuando la página presenta una región raster relevante.
            if (nativeStrong) {
              const rasterInspection = await inspectRasterContentForHybridOcr(
                page,
                { width: viewport.width, height: viewport.height }
              );
              visualMetrics = rasterInspection.metrics;
              hybridRequested = rasterInspection.needsHybridOcr;
            }

            const cachedOcr =
              state.ocrRecords.get(pageNumber) ||
              state.persistentCache.get(pageNumber);

            if (
              !state.ocrRecords.has(pageNumber) &&
              state.persistentCache.has(pageNumber)
            ) {
              state.cacheHits += 1;
            }

            if (textMode === "native") {
              text = nativeText;
              source = nativeTextIsUseful(text)
                ? "native"
                : "empty";
              layout = source === "native" ? nativeLayout : null;
            } else if (nativeStrong && !hybridRequested) {
              text = nativeText;
              source = "native";
              layout = nativeLayout;
            } else if (cachedOcr?.text) {
              activeOcrRecord = cachedOcr;
              reusedOcr += 1;
              if (nativeStrong && hybridRequested) {
                const hybrid = buildHybridPageContent({
                  nativeText,
                  nativeLayout,
                  ocrRecord: cachedOcr,
                  width: viewport.width,
                  height: viewport.height,
                });
                ({ text, source, layout } = hybrid);
              } else {
                text = reconstructOcrText(
                  cachedOcr,
                  selectedLayoutMode()
                );
                source = "ocr";
                layout = ocrRecordToLayout(
                  cachedOcr,
                  viewport.width,
                  viewport.height
                );
              }
            } else {
              const fast = await recognizePageWithOcr(
                page,
                pageNumber,
                index,
                resolved.pages.length,
                state.ocrPool,
                fastProfile,
                languageCodes,
                usesExternalOcr
                  ? state.externalOcrModels
                  : null
              );

              const quality = ocrRecordQuality(fast.record);
              activeOcrRecord = fast.record;

              if (fast.blank) {
                if (nativeStrong && hybridRequested) {
                  text = nativeText;
                  source = "native";
                  layout = nativeLayout;
                } else {
                  text = "";
                  source = "empty";
                  layout = null;
                }
              } else if (quality.accepted) {
                if (nativeStrong && hybridRequested) {
                  const hybrid = buildHybridPageContent({
                    nativeText,
                    nativeLayout,
                    ocrRecord: fast.record,
                    width: viewport.width,
                    height: viewport.height,
                  });
                  ({ text, source, layout } = hybrid);
                } else {
                  text = reconstructOcrText(
                    fast.record,
                    selectedLayoutMode()
                  );
                  source = "ocr";
                  layout = ocrRecordToLayout(
                    fast.record,
                    viewport.width,
                    viewport.height
                  );
                }
                state.adaptive.fastAccepted += 1;
                void writeOcrCacheRecord(
                  {
                    documentHash: state.documentHash,
                    pageNumber,
                    languageKey,
                    profileKey: "fast",
                    rotation: 0,
                    engineVersion: "tesseract-local-v1",
                  },
                  fast.record
                );
              } else {
                retryQueue.push({
                  index,
                  pageNumber,
                  width: viewport.width,
                  height: viewport.height,
                  nativeText,
                  nativeLayout,
                  hybridRequested,
                  visualMetrics,
                });
                return;
              }
            }

            const language = source === "ocr" || source === "hybrid"
              ? languageKey
              : null;
            records[index] = buildPageRecord({
              pageNumber,
              text,
              source,
              width: viewport.width,
              height: viewport.height,
              language,
              layout,
            });
            if (visualMetrics) records[index].docxVisualMetrics = visualMetrics;

            structuredPages[index] = {
              pageNumber,
              source,
              nativeText,
              ocrRecord:
                source === "ocr" || source === "hybrid"
                  ? (
                      state.ocrRecords.get(pageNumber) ||
                      state.persistentCache.get(pageNumber) ||
                      activeOcrRecord ||
                      null
                    )
                  : null,
              width: viewport.width,
              height: viewport.height,
              language,
              layout,
              docxVisualMetrics: visualMetrics,
            };
          } finally {
            page.cleanup();
          }

          completed += 1;
          const percent = Math.round(
            (completed / resolved.pages.length) * 82
          );
          els.progress.value = percent;
          els.progressText.textContent =
            `${percent}% · primera pasada ${completed}/${resolved.pages.length}`;
        }
      }

      const fastWorkers = textMode === "native"
        ? Math.min(2, resolved.pages.length)
        : usesExternalOcr
          ? 1
          : resolveAdaptiveWorkerCount(resolved.pages.length);

      await Promise.all(
        Array.from(
          { length: Math.max(1, fastWorkers) },
          () => processFastPass()
        )
      );

      if (state.cancelled) {
        throw new DOMException(
          "Operación cancelada",
          "AbortError"
        );
      }

      if (retryQueue.length) {
        setStatus(
          `Revisando ${retryQueue.length} páginas de baja confianza…`
        );

        if (!usesExternalOcr) {
          state.balancedOcrPool =
            await createOcrBenchmarkWorkerPool({
              languages: languageCodes,
              parameters: balancedProfile.tesseract,
              size: Math.min(2, retryQueue.length),
            });
          // El pool preciso se crea con un único worker: solo se usa cuando
          // la segunda pasada sigue dejando evidencia de OCR dudoso. Así la
          // calidad máxima no penaliza las páginas que ya quedaron bien.
          state.preciseOcrPool =
            await createOcrBenchmarkWorkerPool({
              languages: languageCodes,
              parameters: preciseProfile.tesseract,
              size: 1,
            });
        }

        let retryCursor = 0;

        async function processRetry() {
          while (!state.cancelled) {
            const retryIndex = retryCursor;
            retryCursor += 1;
            if (retryIndex >= retryQueue.length) return;

            const retry = retryQueue[retryIndex];
            const page = await state.pdf.getPage(retry.pageNumber);

            try {
              const balanced = await recognizePageWithOcr(
                page,
                retry.pageNumber,
                retry.index,
                resolved.pages.length,
                state.balancedOcrPool,
                balancedProfile,
                languageCodes,
                usesExternalOcr
                  ? state.externalOcrModels
                  : null
              );

              state.adaptive.balancedRetried += 1;
              let selectedRecord = balanced.record;
              const balancedQuality = ocrRecordQuality(balanced.record);

              if (shouldTryPreciseOcr(balancedQuality)) {
                const precise = await recognizePageWithOcr(
                  page,
                  retry.pageNumber,
                  retry.index,
                  resolved.pages.length,
                  state.preciseOcrPool,
                  preciseProfile,
                  languageCodes,
                  usesExternalOcr
                    ? state.externalOcrModels
                    : null
                );
                selectedRecord = chooseBetterOcrRecord(
                  balanced.record,
                  precise.record
                );
                state.adaptive.preciseRetried += 1;
              }

              let selectedText = reconstructOcrText(
                selectedRecord,
                selectedLayoutMode()
              );
              let selectedSource = selectedText ? "ocr" : "empty";
              let selectedLayout = selectedText
                ? ocrRecordToLayout(selectedRecord, retry.width, retry.height)
                : null;

              if (retry.hybridRequested && nativeTextIsUseful(retry.nativeText)) {
                const hybrid = buildHybridPageContent({
                  nativeText: retry.nativeText,
                  nativeLayout: retry.nativeLayout,
                  ocrRecord: selectedRecord,
                  width: retry.width,
                  height: retry.height,
                });
                selectedText = hybrid.text;
                selectedSource = hybrid.source;
                selectedLayout = hybrid.layout;
              }

              const selectedLanguage =
                selectedSource === "ocr" || selectedSource === "hybrid"
                  ? languageKey
                  : null;
              records[retry.index] = buildPageRecord({
                pageNumber: retry.pageNumber,
                text: selectedText,
                source: selectedSource,
                width: retry.width,
                height: retry.height,
                language: selectedLanguage,
                layout: selectedLayout,
              });
              if (retry.visualMetrics) {
                records[retry.index].docxVisualMetrics = retry.visualMetrics;
              }

              if (selectedRecord.text) {
                void writeOcrCacheRecord(
                  {
                    documentHash: state.documentHash,
                    pageNumber: retry.pageNumber,
                    languageKey,
                    profileKey: "fast",
                    rotation: 0,
                    engineVersion: "tesseract-local-v1",
                  },
                  selectedRecord
                );
              }

              structuredPages[retry.index] = {
                pageNumber: retry.pageNumber,
                source: selectedSource,
                nativeText: retry.nativeText || "",
                ocrRecord:
                  selectedSource === "ocr" || selectedSource === "hybrid"
                    ? selectedRecord
                    : null,
                width: retry.width,
                height: retry.height,
                language: selectedLanguage,
                layout: selectedLayout,
                docxVisualMetrics: retry.visualMetrics || null,
              };
              completed += 1;
              const percent = 82 + Math.round(
                ((retryIndex + 1) / retryQueue.length) * 18
              );
              els.progress.value = percent;
              els.progressText.textContent =
                `${percent}% · revisión ${retryIndex + 1}/${retryQueue.length}`;
            } finally {
              page.cleanup();
            }
          }
        }

        await Promise.all(
          Array.from(
            {
              length: usesExternalOcr
                ? 1
                : Math.min(2, retryQueue.length),
            },
            () => processRetry()
          )
        );
      }

      if (state.cancelled) {
        throw new DOMException(
          "Operación cancelada",
          "AbortError"
        );
      }

      state.structuredPages = structuredPages.filter(Boolean);

      state.document = buildExportDocument({
        sourceName: state.file.name,
        totalPages: state.pageCount,
        exportedPages: resolved.pages,
        textMode,
        readingOrder: "native",
        pages: records.filter(Boolean),
        elapsedMs: performance.now() - started,
      });

      refreshSerializedPreview();
      renderStats(state.document);

      els.progress.value = 100;
      els.progress.dataset.complete = "true";

      if (
        state.cacheHits === resolved.pages.length &&
        resolved.pages.length > 0
      ) {
        els.progressText.textContent =
          `100% · ${resolved.pages.length} páginas recuperadas de caché`;
      } else {
        els.progressText.textContent =
          `100% · ${resolved.pages.length}/${resolved.pages.length} páginas completadas`;
      }

      const ocrPages =
        state.document.statistics.ocrPages +
        (state.document.statistics.hybridPages || 0);
      const details = [
        `${state.adaptive.fastAccepted} rápidas`,
        `${state.adaptive.balancedRetried} revisadas`,
        `${state.adaptive.blankSkipped} vacías omitidas`,
        `${reusedOcr} reutilizadas`,
        `${state.cacheHits} desde caché`,
      ].join(" · ");

      setStatus(
        ocrPages
          ? `OCR adaptativo completado: ${details}.`
          : "Análisis completado con el texto incluido en el PDF.",
        "success"
      );
    } catch (error) {
      if (
        state.cancelled ||
        error?.name === "AbortError" ||
        isOcrCancelledError(error) ||
        isExternalOcrCancelledError(error)
      ) {
        setStatus("Análisis cancelado.", "info");
      } else {
        console.error(error);
        setStatus(
          "No se pudo completar la extracción de texto.",
          "error"
        );
      }
    } finally {
      const pools = [
        state.ocrPool,
        state.balancedOcrPool,
        state.preciseOcrPool,
      ];

      state.ocrPool = null;
      state.balancedOcrPool = null;
      state.preciseOcrPool = null;

      await Promise.all(
        pools.map((pool) => destroyOcrPoolSafely(pool))
      );

      state.externalOcrModels = [];
      state.usesExternalOcr = false;
      setBusy(false);
    }
  }


  const DOCX_PAGE_INSPECTION_TIMEOUT_MS = 5_000;
  const DOCX_PAGE_OPEN_TIMEOUT_MS = 6_000;
  const DOCX_PAGE_RENDER_TIMEOUT_MS = 15_000;
  const DOCX_PAGE_ENCODE_TIMEOUT_MS = 5_000;

  function withTimeout(promise, timeoutMs, message) {
    let timeoutId = null;

    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]).finally(() => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    });
  }

  function docxOperatorMetrics(operatorList, pageRecord = {}) {
    const ops = pdfjsLib.OPS || {};
    const imageOps = new Set([
      ops.paintInlineImageXObject,
      ops.paintImageXObject,
      ops.paintJpegXObject,
      ops.paintImageMaskXObject,
      ops.paintSolidColorImageMask,
      ops.paintImageMaskXObjectGroup,
      ops.paintImageXObjectRepeat,
      ops.paintImageMaskXObjectRepeat,
    ].filter(Number.isInteger));
    const vectorOps = new Set([
      ops.constructPath,
      ops.stroke,
      ops.closeStroke,
      ops.fill,
      ops.eoFill,
      ops.fillStroke,
      ops.eoFillStroke,
      ops.closeFillStroke,
      ops.closeEOFillStroke,
      ops.shadingFill,
    ].filter(Number.isInteger));
    const width = Math.max(1, Number(pageRecord?.width) || 595);
    const height = Math.max(1, Number(pageRecord?.height) || 842);
    const pageArea = width * height;
    const stack = [];
    let areaScale = 1;
    let imageOperations = 0;
    let vectorOperations = 0;
    let imageCoverage = 0;
    let maxImageCoverageRatio = 0;

    for (let index = 0; index < operatorList.fnArray.length; index += 1) {
      const fn = operatorList.fnArray[index];
      const args = operatorList.argsArray[index] || [];

      if (fn === ops.save) {
        stack.push(areaScale);
        continue;
      }
      if (fn === ops.restore) {
        areaScale = stack.length ? stack.pop() : 1;
        continue;
      }
      if (fn === ops.transform && args.length >= 4) {
        const determinant = Math.abs(
          (Number(args[0]) || 0) * (Number(args[3]) || 0) -
          (Number(args[1]) || 0) * (Number(args[2]) || 0)
        );
        if (Number.isFinite(determinant) && determinant > 0) {
          areaScale *= determinant;
        }
        continue;
      }

      if (imageOps.has(fn)) {
        imageOperations += 1;
        const ratio = Math.max(0, Math.min(1, areaScale / pageArea));
        imageCoverage += ratio;
        maxImageCoverageRatio = Math.max(maxImageCoverageRatio, ratio);
      }
      if (vectorOps.has(fn)) vectorOperations += 1;
    }

    return {
      operatorCount: operatorList.fnArray.length,
      imageOperations,
      vectorOperations,
      imageCoverageRatio: Math.max(0, Math.min(1, imageCoverage)),
      maxImageCoverageRatio,
    };
  }

  async function inspectDocxPage(page, pageRecord) {
    try {
      const operatorList = await withTimeout(
        page.getOperatorList(),
        DOCX_PAGE_INSPECTION_TIMEOUT_MS,
        `Tiempo agotado al inspeccionar la página ${pageRecord.pageNumber}.`
      );
      return docxOperatorMetrics(operatorList, pageRecord);
    } catch (error) {
      console.warn(
        `[PDF→Word] No se pudo medir la complejidad visual de la página ${pageRecord.pageNumber}:`,
        error
      );
      return {
        operatorCount: 0,
        imageOperations: 0,
        vectorOperations: 0,
        imageCoverageRatio: 0,
        maxImageCoverageRatio: 0,
        inspectionFailed: true,
      };
    }
  }

  async function renderDocxFullPage(page, pageNumber, {
    suppressText = false,
    maskLayout = null,
  } = {}) {
    const baseViewport = page.getViewport({ scale: 1 });
    const targetPixels = 1_650_000;
    const basePixels = Math.max(1, baseViewport.width * baseViewport.height);
    const scale = Math.max(1, Math.min(1.8, Math.sqrt(targetPixels / basePixels)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error(`No se pudo preparar el lienzo de la página ${pageNumber}.`);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const originalFillText = context.fillText?.bind(context);
    const originalStrokeText = context.strokeText?.bind(context);
    if (suppressText) {
      context.fillText = () => {};
      context.strokeText = () => {};
    }

    const renderTask = page.render({ canvasContext: context, viewport, intent: "display" });
    state.renderTasks.add(renderTask);
    try {
      await withTimeout(
        renderTask.promise,
        DOCX_PAGE_RENDER_TIMEOUT_MS,
        `Tiempo agotado al renderizar la página ${pageNumber}.`
      );

      if (Array.isArray(maskLayout) && maskLayout.length) {
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        suppressRasterTextInImageData(image, {
          layout: maskLayout,
          pageWidth: baseViewport.width,
          pageHeight: baseViewport.height,
        });
        context.putImageData(image, 0, 0);
      }

      const blob = await withTimeout(new Promise((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("No se pudo codificar la página completa.")), "image/png");
      }), DOCX_PAGE_ENCODE_TIMEOUT_MS, `Tiempo agotado al codificar la página ${pageNumber}.`);
      return {
        bytes: new Uint8Array(await blob.arrayBuffer()),
        width: canvas.width,
        height: canvas.height,
        type: "png",
        fullPage: true,
      };
    } finally {
      state.renderTasks.delete(renderTask);
      if (suppressText) {
        if (originalFillText) context.fillText = originalFillText;
        if (originalStrokeText) context.strokeText = originalStrokeText;
      }
      canvas.width = 1;
      canvas.height = 1;
    }
  }

  function pageOcrLayout(pageRecord = {}) {
    const layout = Array.isArray(pageRecord?.layout) ? pageRecord.layout : [];
    const pageSource = String(pageRecord?.source || "").toLocaleLowerCase();
    return layout.filter((line) => {
      const source = String(line?.source || pageSource).toLocaleLowerCase();
      return source === "ocr";
    });
  }

  async function extractDocxPageImages() {
    if (!state.pdf || !state.document?.pages?.length) return new Map();
    const imagesByPage = new Map();
    const pages = state.document.pages;
    const layoutMode = selectedLayoutMode();
    let renderedPages = 0;
    let editablePages = 0;
    let omittedPages = 0;
    const reasonCounts = new Map();

    state.cancelled = false;
    els.cancel.hidden = false;
    els.cancel.disabled = false;

    if (layoutMode !== "original") {
      for (const pageRecord of pages) {
        pageRecord.docxVisualMetrics = null;
        pageRecord.docxPlan = {
          route: "editable",
          reasons: ["modo-editable"],
        };
      }
      els.progress.value = 100;
      els.progressText.textContent =
        `100% · ${pages.length} páginas editables · diseño ${layoutMode}`;
      return imagesByPage;
    }

    for (let index = 0; index < pages.length; index += 1) {
      if (state.cancelled) {
        throw new DOMException("Operación cancelada", "AbortError");
      }

      const pageRecord = pages[index];
      const pageNumber = pageRecord.pageNumber;
      const percent = Math.round((index / pages.length) * 100);
      els.progress.value = percent;
      els.progressText.textContent =
        `${percent}% · analizando diseño de la página ${pageNumber}/${pages.length}`;

      let page = null;
      try {
        page = await withTimeout(
          state.pdf.getPage(pageNumber),
          DOCX_PAGE_OPEN_TIMEOUT_MS,
          `Tiempo agotado al abrir la página ${pageNumber}.`
        );

        pageRecord.docxVisualMetrics =
          pageRecord.docxVisualMetrics ||
          await inspectDocxPage(
            page,
            pageRecord
          );
        // Respetar la clasificación de seguridad. No forzar a editable las
        // páginas OCR: su geometría puede ser válida para búsqueda, pero no
        // necesariamente para reconstrucción visual exacta en Word.
        const plan = classifyDocxPage(pageRecord, { layoutMode });
        pageRecord.docxPlan = {
          route: plan.route,
          reasons: [...plan.reasons],
        };
        for (const reason of plan.reasons) {
          reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
        }

        if (plan.route !== "visual") {
          editablePages += 1;
          els.progressText.textContent =
            `${percent}% · página ${pageNumber}/${pages.length} · reconstrucción editable`;

          const metrics = pageRecord.docxVisualMetrics || {};
          const needsGraphicsLayer =
            Number(metrics.imageOperations || 0) > 0 ||
            Number(metrics.vectorOperations || 0) > 0;

          if (needsGraphicsLayer) {
            try {
              const rasterMaskLayout = pageOcrLayout(pageRecord);
              const sourceForCalibration = rasterMaskLayout.length
                ? await renderDocxFullPage(page, pageNumber)
                : null;
              if (sourceForCalibration) {
                sourceForCalibration.calibrationSource = true;
                sourceForCalibration.fullPage = false;
              }
              const graphicsOnly = await renderDocxFullPage(
                page,
                pageNumber,
                {
                  suppressText: true,
                  // El renderer ya suprime el texto PDF nativo. Enmascarar
                  // también esas líneas dañaba reglas, fondos y gráficos que
                  // pasaban por detrás. El inpainting raster se reserva al
                  // texto OCR realmente incrustado en imágenes.
                  maskLayout: rasterMaskLayout,
                }
              );
              graphicsOnly.graphicsOnly = true;
              imagesByPage.set(
                pageNumber,
                sourceForCalibration
                  ? [graphicsOnly, sourceForCalibration]
                  : [graphicsOnly]
              );
            } catch (graphicsError) {
              console.warn(
                `[PDF→Word] No se pudo crear la capa gráfica editable de la página ${pageNumber}:`,
                graphicsError
              );
            }
          }
          continue;
        }

        els.progressText.textContent =
          `${percent}% · preservando diseño de la página ${pageNumber}/${pages.length}`;
        const rendered = await renderDocxFullPage(page, pageNumber);
        imagesByPage.set(pageNumber, [rendered]);
        renderedPages += 1;
      } catch (error) {
        if (state.cancelled || error?.name === "AbortError") throw error;
        omittedPages += 1;
        pageRecord.docxPlan = {
          route: "editable",
          reasons: ["respaldo-por-error-de-render"],
        };
        console.warn(
          `[PDF→Word] No se pudo preservar visualmente la página ${pageNumber}:`,
          error
        );
      } finally {
        try { page?.cleanup(); } catch {}
      }

      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    els.progress.value = 100;
    els.progressText.textContent =
      `100% · ${renderedPages} páginas visuales · ${editablePages} páginas editables` +
      (omittedPages ? ` · ${omittedPages} páginas con respaldo textual` : "");
    console.info("[PDF→Word] Plan híbrido:", {
      renderedPages,
      editablePages,
      omittedPages,
      reasons: Object.fromEntries(reasonCounts),
    });
    return imagesByPage;
  }

  async function exportCopy() {
    if (!state.serialized || !state.file) return;

    const suggestedName =
      `${safeBaseName(state.file.name)}-exportado.${state.serialized.extension}`;

    const dialog = window.__TAURI__?.dialog;
    const fs = window.__TAURI__?.fs;
    let encoded;

    try {
      if (typeof state.serialized.buildBytes === "function") {
        setStatus("Creando el documento Word con texto editable e imágenes reales…");
        els.exportButton.disabled = true;
        const pageImages = await extractDocxPageImages();
        encoded = await state.serialized.buildBytes({ pageImages });
      } else {
        encoded = new TextEncoder().encode(
          state.serialized.content
        );
      }
    } catch (error) {
      console.error(error);
      setStatus(
        "No se pudo crear el documento Word.",
        "error"
      );
      els.exportButton.disabled = false;
      return;
    }

    if (
      typeof dialog?.save === "function" &&
      typeof fs?.writeFile === "function"
    ) {
      try {
        const chosen = await dialog.save({
          defaultPath: suggestedName,
          title: "Guardar exportación como archivo nuevo",
          filters: [
            {
              name:
                els.format.options[
                  els.format.selectedIndex
                ]?.text || "Documento",
              extensions: [state.serialized.extension],
            },
          ],
        });

        if (!chosen) {
          els.exportButton.disabled = false;
          setStatus(
            "Guardado cancelado. No se creó ningún archivo.",
            "info"
          );
          return;
        }

        await fs.writeFile(String(chosen), encoded);
        els.exportButton.disabled = false;
        setStatus(
          `Copia guardada localmente: ${
            String(chosen).split(/[\\/]/).pop()
          }`,
          "success"
        );
        return;
      } catch (error) {
        console.error(error);
        els.exportButton.disabled = false;
        setStatus(
          "No se pudo guardar el archivo en la ruta elegida.",
          "error"
        );
        return;
      }
    }

    const blob = new Blob([encoded], {
      type: state.serialized.mimeType,
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = suggestedName;
    anchor.hidden = true;
    window.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    els.exportButton.disabled = false;
    setStatus(
      "Copia exportada localmente. El PDF original no se ha modificado.",
      "success"
    );
  }

  async function openConvertExport() {
    closeAppMenus();

    await new Promise((resolve) =>
      requestAnimationFrame(resolve)
    );

    showOnly(els.view);
    document.title =
      "Convertir y exportar | PDFPrivado Pro";

    try {
      await refreshOcrLanguageOptions();
    } catch (error) {
      console.warn(
        "No se pudo actualizar la lista local de idiomas OCR.",
        error
      );
    }

    let reused = false;

    try {
      if (!state.busy) {
        setBusy(true);
        reused = await preloadViewerDocument();
      }
    } catch (error) {
      console.warn(
        "No se pudo comprobar el documento abierto en el visor.",
        error
      );
    } finally {
      setBusy(false);
      els.choose.disabled = false;
      els.cancel.hidden = true;
    }

    if (!reused && !state.pdf) {
      setStatus("Selecciona un PDF para comenzar.");
    }

    els.choose.focus({ preventScroll: true });
  }

  els.openButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void openConvertExport();
    });
  });

  els.back.addEventListener("click", () => {
    const viewer = $("#viewer-view");
    const home = $("#home-view");
    const target =
      state.sourceKind === "viewer" && viewer
        ? viewer
        : home;

    if (target) showOnly(target);

    document.body.classList.toggle(
      "viewer-active",
      target === viewer
    );

    document.title =
      target === viewer
        ? "Lector y editor PDF | PDFPrivado Pro"
        : "PDFPrivado Pro";
  });

  els.choose.addEventListener("click", () => {
    els.fileInput.value = "";
    els.fileInput.click();
  });

  els.fileInput.addEventListener("change", () => {
    void loadFile(els.fileInput.files?.[0]);
  });

  for (const tab of els.previewTabs || []) {
    tab.addEventListener("click", () => {
      setDocumentPreviewMode(tab.dataset.previewMode);
    });
  }

  els.documentPrev?.addEventListener("click", () => {
    state.documentPreviewPage = clampDocumentPreviewPage(
      state.documentPreviewPage - 1
    );
    void renderDocumentPreview();
  });

  els.documentNext?.addEventListener("click", () => {
    state.documentPreviewPage = clampDocumentPreviewPage(
      state.documentPreviewPage + 1
    );
    void renderDocumentPreview();
  });

  const applyDocumentPreviewPage = () => {
    state.documentPreviewPage = clampDocumentPreviewPage(
      els.documentPage?.value
    );
    void renderDocumentPreview();
  };

  els.documentPage?.addEventListener("change", applyDocumentPreviewPage);
  els.documentPage?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyDocumentPreviewPage();
    }
  });

  els.documentZoomOut?.addEventListener("click", () => {
    state.documentPreviewFitWidth = false;
    state.documentPreviewScale = Math.max(
      0.25,
      state.documentPreviewScale - 0.1
    );
    void renderDocumentPreview();
  });

  els.documentZoomIn?.addEventListener("click", () => {
    state.documentPreviewFitWidth = false;
    state.documentPreviewScale = Math.min(
      4,
      state.documentPreviewScale + 0.1
    );
    void renderDocumentPreview();
  });

  els.documentFit?.addEventListener("click", () => {
    state.documentPreviewFitWidth = true;
    void renderDocumentPreview();
  });

  window.addEventListener("resize", () => {
    if (
      state.documentPreviewMode !== "document" ||
      !state.documentPreviewFitWidth ||
      !state.pdf
    ) {
      return;
    }
    window.clearTimeout(state.documentPreviewResizeTimer);
    state.documentPreviewResizeTimer = window.setTimeout(() => {
      void renderDocumentPreview();
    }, 160);
  });

  els.scope.addEventListener("change", updateScopeUi);
  els.textMode.addEventListener("change", () => {
    updateOcrLanguageUi();
    saveSettings();
    resetResult();
  });

  els.ocrPrimary?.addEventListener("change", () => {
    saveGlobalOcrPrimaryLanguagePreference(els.ocrPrimary?.value);
    if (els.ocrSecondary?.value === els.ocrPrimary?.value) {
      els.ocrSecondary.value = "";
    }
    updateOcrLanguageUi();
    saveSettings();
    resetResult();
  });

  els.ocrSecondary?.addEventListener("change", () => {
    if (els.ocrSecondary?.value === els.ocrPrimary?.value) {
      els.ocrSecondary.value = "";
    }
    updateOcrLanguageUi();
    saveSettings();
    resetResult();
  });
  els.layoutMode?.addEventListener("change", () => {
    saveSettings();
    resetResult();
    setStatus("Diseño de texto cambiado. Analiza de nuevo para reconstruir las líneas.");
  });

  els.format.addEventListener("change", () => {
    saveSettings();
    refreshSerializedPreview();
    if (state.document) setStatus("Formato actualizado sin repetir OCR.", "success");
  });

  els.headings.addEventListener("change", () => {
    saveSettings();
    refreshSerializedPreview();
  });

  els.analyze.addEventListener("click", () => {
    void analyze();
  });

  els.exportButton.addEventListener("click", () => {
    void exportCopy();
  });

  els.cancel.addEventListener("click", () => {
    state.cancelled = true;

    for (const task of state.renderTasks) {
      try {
        task.cancel?.();
      } catch {}
    }
    state.renderTasks.clear();

    const cancelledPools = [
      state.ocrPool,
      state.balancedOcrPool,
      state.preciseOcrPool,
    ];

    state.ocrPool = null;
    state.balancedOcrPool = null;
    state.preciseOcrPool = null;

    setBusy(false);
    els.progressText.textContent = "Análisis cancelado";
    setStatus("Análisis cancelado.", "info");

    void Promise.allSettled([
      ...cancelledPools.map((pool) =>
        Promise.resolve(pool?.cancel?.())
      ),
      Promise.resolve(cancelOcrEngine()),
      Promise.resolve(cancelExternalOcrRuntime()),
    ]);
  });

  /* PDFPRIVADO_LAYOUT_REFRESH_CAPTURE_V3 */
  function rebuildLayoutPreviewFromCacheV3() {
    if (
      !state.document ||
      !Array.isArray(state.document.pages) ||
      !state.document.pages.length
    ) {
      return false;
    }

    const mode = selectedLayoutMode();
    const rebuiltPages = [];
    let ocrPages = 0;

    for (let index = 0; index < state.document.pages.length; index += 1) {
      const previous = state.document.pages[index];
      const pageNumber = Number(
        previous?.pageNumber ??
        previous?.number ??
        state.document?.exportedPages?.[index] ??
        index + 1
      );

      const structured = Array.isArray(state.structuredPages)
        ? state.structuredPages.find(
            (candidate) => candidate?.pageNumber === pageNumber
          )
        : null;

      const source = String(
        structured?.source ??
        previous?.source ??
        previous?.textSource ??
        "native"
      );

      const ocrRecord =
        structured?.ocrRecord ||
        state.ocrRecords.get(pageNumber) ||
        state.persistentCache.get(pageNumber) ||
        null;

      let text = String(
        structured?.nativeText ??
        previous?.text ??
        previous?.content ??
        ""
      );

      if (source === "ocr" && ocrRecord) {
        text = reconstructOcrText(ocrRecord, mode);
        ocrPages += 1;
      } else if (source === "hybrid" && Array.isArray(structured?.layout ?? previous?.layout)) {
        text = layoutToStructuredText(
          structured?.layout ?? previous?.layout,
          { pageHeight: structured?.height ?? previous?.height ?? 842 }
        );
        ocrPages += 1;
      }

      rebuiltPages.push(
        buildPageRecord({
          pageNumber,
          text,
          source,
          width: structured?.width ?? previous?.width ?? null,
          height: structured?.height ?? previous?.height ?? null,
          language:
            structured?.language ??
            previous?.language ??
            null,
          layout: structured?.layout ?? previous?.layout ?? null,
        })
      );
    }

    if (!rebuiltPages.length) return false;

    const previousElapsed =
      state.document.statistics?.elapsedMs || 0;

    state.document = buildExportDocument({
      sourceName: state.file.name,
      totalPages: state.pageCount,
      exportedPages: rebuiltPages.map(
        (page) => page.pageNumber
      ),
      textMode: els.textMode.value,
      readingOrder: "native",
      pages: rebuiltPages,
      elapsedMs: previousElapsed,
    });

    refreshSerializedPreview();
    renderStats(state.document);

    els.progress.value = 100;
    els.progress.dataset.complete = "true";
    els.progressText.textContent =
      "100% · diseño actualizado sin repetir OCR";

    setStatus(
      ocrPages
        ? `Diseño actualizado instantáneamente en ${ocrPages} páginas OCR.`
        : "Diseño actualizado instantáneamente.",
      "success"
    );

    return true;
  }

  document.addEventListener(
    "change",
    (event) => {
      const input = event.target;

      if (
        !(input instanceof HTMLInputElement) ||
        input.name !== "convert-export-layout-mode"
      ) {
        return;
      }

      event.stopImmediatePropagation();
      saveSettings();

      if (!rebuildLayoutPreviewFromCacheV3()) {
        setStatus(
          "No hay un análisis disponible. Pulsa Analizar y previsualizar."
        );
      }
    },
    true
  );
  onGlobalOcrLanguagesChanged(() => {
    void refreshOcrLanguageOptions().catch((error) => {
      console.warn(
        "No se pudo actualizar la lista global de idiomas OCR.",
        error
      );
    });
  });

  void refreshOcrLanguageOptions()
    .catch((error) => {
      console.warn(
        "No se pudo cargar la lista local de idiomas OCR.",
        error
      );
    })
    .finally(() => {
      restoreSettings();
      resetResult();
      setDocumentPreviewMode("document");
      resetDocumentPreviewForPdf();
      setBusy(false);
    });
}
