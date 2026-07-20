import * as pdfjsLib from "./vendor/pdfjs/pdf.mjs";
import {
  buildExportDocument,
  buildPageRecord,
  resolveExportPages,
  safeBaseName,
  textItemsToStructuredText,
} from "./convert-export-core.js";
import { serializeExportDocument } from "./convert-export-formats.js";
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
  layoutModes: $$('[name="convert-export-layout-mode"]'),
  headings: $("#convert-export-page-headings"),
  analyze: $("#convert-export-analyze"),
  exportButton: $("#convert-export-save"),
  cancel: $("#convert-export-cancel"),
  status: $("#convert-export-status"),
  progress: $("#convert-export-progress"),
  progressText: $("#convert-export-progress-text"),
  preview: $("#convert-export-preview"),
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
    sourceKind: "standalone",
    ocrRecords: new Map(),
    ocrPool: null,
    documentHash: "",
    persistentCache: new Map(),
    cacheHits: 0,
    balancedOcrPool: null,
    adaptive: {
      fastAccepted: 0,
      balancedRetried: 0,
      blankSkipped: 0,
      croppedPages: 0,
    },
  };

  const SETTINGS_KEY = "pdfprivado.convertExport.v3";
  const NATIVE_TEXT_MINIMUM = 8;

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
    for (const input of els.layoutModes) input.disabled = busy;
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        format: els.format.value,
        scope: els.scope.value,
        textMode: els.textMode.value,
        headings: els.headings.checked,
        layoutMode: selectedLayoutMode(),
      }));
    } catch {}
  }

  function restoreSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (["txt", "json", "html", "markdown"].includes(value.format)) {
        els.format.value = value.format;
      }
      if (["all", "current", "range"].includes(value.scope)) {
        els.scope.value = value.scope;
      }
      if (["auto", "native", "ocr"].includes(value.textMode)) {
        els.textMode.value = value.textMode;
      }
      if (typeof value.headings === "boolean") {
        els.headings.checked = value.headings;
      }
    } catch {}
    updateScopeUi();
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
      }

      return buildPageRecord({
        pageNumber: page.pageNumber,
        text,
        source: page.source,
        width: page.width,
        height: page.height,
        language: page.language,
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

  async function recognizePageWithOcr(
    page,
    pageNumber,
    pageIndex,
    pageTotal,
    workerPool,
    profile,
    languageCodes = ["spa"]
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

      const recognize = workerPool
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

      return {
        record: buildOcrRecord(result?.data, {
          imageWidth: preparedCanvas.width,
          imageHeight: preparedCanvas.height,
          language: languageCodes.join("+"),
          languageLabel: "OCR automático",
          rotation: rendered.rotation,
          effectiveDpi: rendered.effectiveDpi,
        }),
        blank: false,
      };
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

  function renderStats(exportDocument) {
    const stats = exportDocument.statistics;
    const items = [
      ["Páginas", `${stats.processedPages}/${stats.requestedPages}`],
      ["PDF", String(stats.nativePages)],
      ["OCR", String(stats.ocrPages)],
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
    const fastProfile = resolveOcrProfile("fast");
    const balancedProfile = resolveOcrProfile("balanced");
    const records = new Array(resolved.pages.length);
    const structuredPages = new Array(resolved.pages.length);
    state.cacheHits = 0;
    state.persistentCache = await readCachedPages({
      documentHash: state.documentHash,
      pages: resolved.pages,
      languageKey: "spa",
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

      if (textMode !== "native") {
        state.ocrPool = await createOcrBenchmarkWorkerPool({
          languages: ["spa"],
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
            let text = "";
            let source = "empty";
            let activeOcrRecord = null;

            if (textMode !== "ocr") {
              const content = await page.getTextContent({
                includeMarkedContent: false,
                disableNormalization: false,
              });
              nativeText = textItemsToStructuredText(
                content.items || []
              );
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
            } else if (
              textMode === "auto" &&
              nativeTextIsUseful(nativeText)
            ) {
              text = nativeText;
              source = "native";
            } else if (cachedOcr?.text) {
              text = reconstructOcrText(
                cachedOcr,
                selectedLayoutMode()
              );
              source = "ocr";
              reusedOcr += 1;
            } else {
              const fast = await recognizePageWithOcr(
                page,
                pageNumber,
                index,
                resolved.pages.length,
                state.ocrPool,
                fastProfile,
                ["spa"]
              );

              const quality = ocrRecordQuality(fast.record);

              if (fast.blank) {
                text = "";
                source = "empty";
              } else if (quality.accepted) {
                text = reconstructOcrText(
                  fast.record,
                  selectedLayoutMode()
                );
                source = "ocr";
                state.adaptive.fastAccepted += 1;
                void writeOcrCacheRecord(
                  {
                    documentHash: state.documentHash,
                    pageNumber,
                    languageKey: "spa",
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
                });
                return;
              }
            }

            records[index] = buildPageRecord({
              pageNumber,
              text,
              source,
              width: viewport.width,
              height: viewport.height,
              language: source === "ocr" ? "spa" : null,
            });

            structuredPages[index] = {
              pageNumber,
              source,
              nativeText: source === "native" ? text : "",
              ocrRecord:
                source === "ocr"
                  ? (
                      state.ocrRecords.get(pageNumber) ||
                      state.persistentCache.get(pageNumber) ||
                      activeOcrRecord ||
                      null
                    )
                  : null,
              width: viewport.width,
              height: viewport.height,
              language: source === "ocr" ? "spa" : null,
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

        state.balancedOcrPool =
          await createOcrBenchmarkWorkerPool({
            languages: ["spa"],
            parameters: balancedProfile.tesseract,
            size: Math.min(2, retryQueue.length),
          });

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
                ["spa"]
              );

              const balancedText = reconstructOcrText(
                balanced.record,
                selectedLayoutMode()
              );

              records[retry.index] = buildPageRecord({
                pageNumber: retry.pageNumber,
                text: balancedText,
                source: balancedText ? "ocr" : "empty",
                width: retry.width,
                height: retry.height,
                language: balanced.record.text ? "spa" : null,
              });

              if (balanced.record.text) {
                void writeOcrCacheRecord(
                  {
                    documentHash: state.documentHash,
                    pageNumber: retry.pageNumber,
                    languageKey: "spa",
                    profileKey: "fast",
                    rotation: 0,
                    engineVersion: "tesseract-local-v1",
                  },
                  balanced.record
                );
              }

              structuredPages[retry.index] = {
                pageNumber: retry.pageNumber,
                source: balancedText ? "ocr" : "empty",
                nativeText: "",
                ocrRecord: balanced.record,
                width: retry.width,
                height: retry.height,
                language: balancedText ? "spa" : null,
              };
              state.adaptive.balancedRetried += 1;
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
            { length: Math.min(2, retryQueue.length) },
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
        state.document.statistics.ocrPages;
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
        isOcrCancelledError(error)
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
      for (const poolName of ["ocrPool", "balancedOcrPool"]) {
        const pool = state[poolName];
        if (pool) {
          try {
            await pool.destroy();
          } catch {}
          state[poolName] = null;
        }
      }
      setBusy(false);
    }
  }

  async function exportCopy() {
    if (!state.serialized || !state.file) return;

    const suggestedName =
      `${safeBaseName(state.file.name)}-exportado.${state.serialized.extension}`;

    const dialog = window.__TAURI__?.dialog;
    const fs = window.__TAURI__?.fs;
    const encoded = new TextEncoder().encode(
      state.serialized.content
    );

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
          setStatus(
            "Guardado cancelado. No se creó ningún archivo.",
            "info"
          );
          return;
        }

        await fs.writeFile(String(chosen), encoded);
        setStatus(
          `Copia guardada localmente: ${
            String(chosen).split(/[\\/]/).pop()
          }`,
          "success"
        );
        return;
      } catch (error) {
        console.error(error);
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
    els.choose.focus({ preventScroll: true });

    if (!state.busy) {
      setBusy(true);
      const reused = await preloadViewerDocument();
      setBusy(false);

      if (!reused && !state.pdf) {
        setStatus("Selecciona un PDF para comenzar.");
      }
    }
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

  els.scope.addEventListener("change", updateScopeUi);
  els.textMode.addEventListener("change", saveSettings);
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

    els.cancel.disabled = true;
    void state.ocrPool?.cancel?.();
    void state.balancedOcrPool?.cancel?.();
    void cancelOcrEngine();
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
  restoreSettings();
  resetResult();
  setBusy(false);
}
