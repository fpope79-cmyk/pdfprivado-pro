import * as pdfjsLib from "./vendor/pdfjs/pdf.mjs";
import {
  analyzePlan,
  applyNamePattern,
  buildSplitPlan,
  parsePageExpression,
  sanitizeFilename,
  summarizePages,
} from "./split-core.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.mjs",
  import.meta.url
).href;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const homeView = $("#home-view");
const mergeView = $("#merge-view");
const splitView = $("#split-view");
const viewerView = $("#viewer-view");
const splitTitle = $("#split-title");
const openSplitButtons = $$('[data-open-tool="split"]');
const backHomeButton = $("#split-back-home-button");
const fileInput = $("#split-file-input");
const dropZone = $("#split-drop-zone");
const chooseFileButton = $("#split-choose-file-button");
const changeFileButton = $("#split-change-file-button");
const clearFileButton = $("#split-clear-file-button");
const fileCard = $("#split-file-card");
const fileName = $("#split-file-name");
const fileDetails = $("#split-file-details");
const sourceSummary = $("#split-source-summary");
const dropTitle = $("#split-drop-title");
const dropHelp = $("#split-drop-help");
const feedback = $("#split-feedback");
const pagesSection = $("#split-pages-section");
const plannerSection = $("#split-planner-section");
const outputSection = $("#split-output-section");
const thumbnailGrid = $("#split-thumbnail-grid");
const selectionSummary = $("#split-selection-summary");
const loadingPanel = $("#split-loading-panel");
const loadingProgress = $("#split-loading-progress");
const loadingValue = $("#split-loading-value");
const loadingTitle = $("#split-loading-title");
const loadingDetail = $("#split-loading-detail");
const selectAllButton = $("#split-select-all-button");
const selectNoneButton = $("#split-select-none-button");
const selectEvenButton = $("#split-select-even-button");
const selectOddButton = $("#split-select-odd-button");
const invertSelectionButton = $("#split-invert-selection-button");
const selectBlankButton = $("#split-select-blank-button");
const selectionExpression = $("#split-selection-expression");
const applySelectionButton = $("#split-apply-selection-button");
const pageJumpInput = $("#split-page-jump");
const jumpButton = $("#split-jump-button");
const modeSelect = $("#split-mode-select");
const rangesInput = $("#split-ranges-input");
const everyInput = $("#split-every-input");
const partsInput = $("#split-parts-input");
const cutsInput = $("#split-cuts-input");
const cutsHelp = $("#split-cuts-help");
const sizeInput = $("#split-size-input");
const excludeBlankOption = $("#split-exclude-blank-option");
const excludeBlankRow = $("#split-exclude-blank-row");
const buildPlanButton = $("#split-build-plan-button");
const stickySummary = $("#split-sticky-summary");
const stickyDocument = $("#split-sticky-document");
const stickySelection = $("#split-sticky-selection");
const stickyResults = $("#split-sticky-results");
const resetConfigButton = $("#split-reset-config-button");
const modeHelp = $("#split-mode-help");
const outputCount = $("#split-output-count");
const outputList = $("#split-output-list");
const emptyPlan = $("#split-empty-plan");
const planAlerts = $("#split-plan-alerts");
const namePattern = $("#split-name-pattern");
const cleanMetadataOption = $("#split-clean-metadata-option");
const titleNameOption = $("#split-title-name-option");
const subfolderOption = $("#split-subfolder-option");
const saveSummary = $("#split-save-summary");
const saveButton = $("#split-save-button");
const saveProgressPanel = $("#split-save-progress-panel");
const saveProgress = $("#split-save-progress");
const saveProgressValue = $("#split-save-progress-value");
const saveProgressTitle = $("#split-save-progress-title");
const saveProgressDetail = $("#split-save-progress-detail");
const saveResultActions = $("#split-save-result-actions");
const openFolderButton = $("#split-open-folder-button");
const pageDialog = $("#split-page-dialog");
const dialogTitle = $("#split-dialog-title");
const dialogCanvasWrap = $("#split-dialog-canvas-wrap");
const dialogClose = $("#split-dialog-close");
const dialogPrev = $("#split-dialog-prev");
const dialogNext = $("#split-dialog-next");
const dialogToggle = $("#split-dialog-toggle");

const modeMessages = {
  "selected-one": "Las páginas seleccionadas se reunirán en un único PDF nuevo.",
  "selected-each": "Cada página seleccionada se guardará como un PDF independiente.",
  "selected-and-rest": "Se crearán dos PDF: uno con la selección y otro con todas las páginas restantes.",
  "remove-selected": "Se guardará una copia nueva excluyendo las páginas seleccionadas.",
  "all-each": "Se creará un archivo PDF por cada página del documento.",
  ranges: "Cada línea define las páginas de un archivo de salida diferente.",
  "every-n": "El documento se dividirá en bloques consecutivos del tamaño indicado.",
  balanced: "Las páginas se repartirán entre el número de partes indicado con la máxima igualdad posible.",
  before: "Cada página indicada comenzará un nuevo archivo.",
  after: "Cada página indicada cerrará un archivo y la siguiente iniciará otro.",
  "blank-before": "Cada posible página blanca iniciará una nueva parte. Revisa siempre la detección visual.",
  "blank-after": "Cada posible página blanca cerrará una parte. Revisa siempre la detección visual.",
  "size-approx": "El número de páginas por archivo se estima desde el tamaño medio del documento; el tamaño final puede variar.",
};

const state = {
  file: null,
  sourceBytes: null,
  pdfDocument: null,
  pageCount: 0,
  thumbnails: [],
  pageSizes: [],
  blankPages: new Set(),
  selectedPages: new Set(),
  plan: [],
  planAnalysis: null,
  planErrors: [],
  loading: false,
  saving: false,
  cancelRequested: false,
  lastSelectedPage: null,
  dialogPage: 1,
  lastOpenTrigger: null,
  lastSavedRevealPath: null,
  lastSavedFolderLabel: "",
};

let planUpdateTimer = null;
let previewUpdateTimer = null;

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "Tamaño no disponible";
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  const decimals = index === 0 || amount >= 100 ? 0 : 1;
  return `${amount.toFixed(decimals)} ${units[index]}`;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function setFeedback(message, kind = "info") {
  if (!feedback) return;
  feedback.textContent = message;
  feedback.dataset.kind = kind;
  feedback.hidden = false;
}

function hideFeedback() {
  if (feedback) feedback.hidden = true;
}

function showSplitView(trigger = null) {
  state.lastOpenTrigger = trigger instanceof HTMLElement ? trigger : null;
  if (homeView) homeView.hidden = true;
  if (mergeView) mergeView.hidden = true;
  if (viewerView) viewerView.hidden = true;
  document.body.classList.remove("viewer-active");
  if (splitView) splitView.hidden = false;
  document.title = "Dividir PDF | PDFPrivado Pro";
  window.scrollTo({ top: 0, behavior: "auto" });
  requestAnimationFrame(() => splitTitle?.focus({ preventScroll: true }));
}

function showHomeView() {
  if (splitView) splitView.hidden = true;
  if (viewerView) viewerView.hidden = true;
  document.body.classList.remove("viewer-active");
  if (homeView) homeView.hidden = false;
  document.title = "PDFPrivado Pro";
  window.scrollTo({ top: 0, behavior: "auto" });
  requestAnimationFrame(() => state.lastOpenTrigger?.focus({ preventScroll: true }));
}

function hasLocalPdfEngine() {
  return Boolean(
    window.PDFLib?.PDFDocument &&
      typeof window.PDFLib.PDFDocument.load === "function" &&
      typeof window.PDFLib.PDFDocument.create === "function"
  );
}

function describePdfError(error, name = "El documento") {
  const detail = String(error?.message ?? error ?? "");
  if (/encrypt|password/i.test(detail)) {
    return `${name} está protegido con contraseña o cifrado y no puede dividirse en esta versión.`;
  }
  return `No se pudo leer ${name}. Puede estar dañado o usar una estructura PDF no compatible.`;
}

function openFilePicker() {
  if (state.loading || state.saving) return;
  fileInput.value = "";
  fileInput.click();
}

function isPdfFile(file) {
  return Boolean(file && (/\.pdf$/i.test(file.name) || file.type === "application/pdf"));
}

async function destroyPdfDocument() {
  if (state.pdfDocument) {
    try {
      await state.pdfDocument.destroy();
    } catch {
      // El documento ya puede estar destruido por PDF.js.
    }
  }
  state.pdfDocument = null;
}

function clearScheduledUpdates() {
  if (planUpdateTimer) window.clearTimeout(planUpdateTimer);
  if (previewUpdateTimer) window.clearTimeout(previewUpdateTimer);
  planUpdateTimer = null;
  previewUpdateTimer = null;
}

function setDefaultConfigurationValues() {
  modeSelect.value = "selected-one";
  rangesInput.value = "";
  everyInput.value = "5";
  partsInput.value = "2";
  cutsInput.value = "";
  sizeInput.value = "5";
  excludeBlankOption.checked = false;
  namePattern.value = "{nombre}_parte_{parte}";
  cleanMetadataOption.checked = true;
  titleNameOption.checked = true;
  subfolderOption.checked = false;
  selectionExpression.value = "";
  pageJumpInput.value = "";
}

function updateSessionSummary() {
  const ready = Boolean(state.file && state.pageCount);
  if (stickySummary) stickySummary.hidden = !ready;
  if (!ready) return;

  const selected = state.selectedPages.size;
  const results = state.plan.length;
  stickyDocument.textContent = `${state.pageCount} ${state.pageCount === 1 ? "página" : "páginas"} · ${formatBytes(state.file.size)}`;
  stickySelection.textContent = `${selected} ${selected === 1 ? "seleccionada" : "seleccionadas"}`;
  stickyResults.textContent = `${results} ${results === 1 ? "archivo preparado" : "archivos preparados"}`;
}

function updateBlankOptionVisibility() {
  const blankMode = modeSelect.value === "blank-before" || modeSelect.value === "blank-after";
  const hasCandidates = state.blankPages.size > 0;
  excludeBlankRow.hidden = !(blankMode || hasCandidates);
  excludeBlankOption.disabled = !hasCandidates;
  if (!hasCandidates) excludeBlankOption.checked = false;
}

function schedulePlanUpdate(delay = 280) {
  if (!state.file || state.loading || state.saving) return;
  if (planUpdateTimer) window.clearTimeout(planUpdateTimer);
  buildPlanButton.textContent = "Actualizando…";
  planUpdateTimer = window.setTimeout(() => {
    planUpdateTimer = null;
    buildCurrentPlan();
  }, delay);
}

function schedulePreviewUpdate(delay = 180) {
  if (previewUpdateTimer) window.clearTimeout(previewUpdateTimer);
  previewUpdateTimer = window.setTimeout(() => {
    previewUpdateTimer = null;
    updatePlanPreview();
  }, delay);
}

async function resetDocumentState() {
  clearScheduledUpdates();
  await destroyPdfDocument();
  state.file = null;
  state.sourceBytes = null;
  state.pageCount = 0;
  state.thumbnails = [];
  state.pageSizes = [];
  state.blankPages.clear();
  state.selectedPages.clear();
  state.plan = [];
  state.planAnalysis = null;
  state.planErrors = [];
  state.lastSelectedPage = null;
  state.dialogPage = 1;
  state.lastSavedRevealPath = null;
  state.lastSavedFolderLabel = "";
  thumbnailGrid.replaceChildren();
  outputList.replaceChildren();
  fileInput.value = "";
  setDefaultConfigurationValues();
  fileName.textContent = "Documento.pdf";
  fileDetails.textContent = "0 páginas · 0 B";
  fileCard.hidden = true;
  pagesSection.hidden = true;
  plannerSection.hidden = true;
  outputSection.hidden = true;
  loadingPanel.hidden = false;
  emptyPlan.hidden = false;
  planAlerts.hidden = true;
  sourceSummary.textContent = "Ningún archivo";
  stickySummary.hidden = true;
  dropTitle.textContent = "Añadir un archivo PDF";
  dropHelp.textContent = "Haz clic o arrastra aquí un único documento.";
  dropZone.classList.remove("has-file", "is-dragover");
  selectionExpression.value = "";
  pageJumpInput.value = "";
  resetSaveProgress();
  updateBlankOptionVisibility();
  updateSelectionSummary();
  updatePlanPreview();
  updateSessionSummary();
}

function setLoadingProgress(percent, title, detail) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  loadingPanel.hidden = false;
  loadingProgress.value = value;
  loadingProgress.textContent = `${value} %`;
  loadingValue.textContent = `${value} %`;
  loadingTitle.textContent = title;
  loadingDetail.textContent = detail;
}

function approximateBlankPage(canvas, hasText) {
  if (hasText) return false;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  const { width, height } = canvas;
  const image = context.getImageData(0, 0, width, height).data;
  const pixelStep = Math.max(1, Math.floor(Math.sqrt((width * height) / 8000)));
  let checked = 0;
  let nonWhite = 0;

  for (let y = 0; y < height; y += pixelStep) {
    for (let x = 0; x < width; x += pixelStep) {
      const index = (y * width + x) * 4;
      const r = image[index];
      const g = image[index + 1];
      const b = image[index + 2];
      checked += 1;
      if (r < 246 || g < 246 || b < 246) nonWhite += 1;
    }
  }

  return checked > 0 && nonWhite / checked < 0.0015;
}

function createThumbnailCard(pageNumber, imageUrl, size, blankCandidate) {
  const card = document.createElement("article");
  card.className = "split-page-card";
  card.dataset.page = String(pageNumber);
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-pressed", "false");
  card.setAttribute("aria-label", `Página ${pageNumber}. Pulsa para seleccionar.`);

  const selectionMark = document.createElement("span");
  selectionMark.className = "split-page-check";
  selectionMark.setAttribute("aria-hidden", "true");
  selectionMark.textContent = "✓";

  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.className = "split-page-preview-button";
  previewButton.title = `Ampliar página ${pageNumber}`;
  previewButton.setAttribute("aria-label", `Ampliar página ${pageNumber}`);
  previewButton.textContent = "⌕";
  previewButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openPageDialog(pageNumber);
  });

  const imageWrap = document.createElement("div");
  imageWrap.className = "split-page-image-wrap";
  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = `Miniatura de la página ${pageNumber}`;
  image.draggable = false;
  imageWrap.append(image);

  const meta = document.createElement("div");
  meta.className = "split-page-meta";
  const title = document.createElement("strong");
  title.textContent = `Página ${pageNumber}`;
  const dimensions = document.createElement("span");
  const orientation = size.width >= size.height ? "Horizontal" : "Vertical";
  dimensions.textContent = `${orientation} · ${Math.round(size.width)} × ${Math.round(size.height)} pt`;
  meta.append(title, dimensions);

  card.append(selectionMark, previewButton, imageWrap, meta);

  if (blankCandidate) {
    const blankBadge = document.createElement("span");
    blankBadge.className = "split-blank-badge";
    blankBadge.textContent = "Posible página blanca";
    card.append(blankBadge);
  }

  card.addEventListener("click", (event) => togglePageSelection(pageNumber, event.shiftKey));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      togglePageSelection(pageNumber, event.shiftKey);
    }
  });

  return card;
}

async function loadPdf(file) {
  if (state.loading || state.saving) return;
  if (!isPdfFile(file)) {
    setFeedback("Selecciona un archivo PDF válido.", "error");
    return;
  }

  state.loading = true;
  hideFeedback();
  await resetDocumentState();
  state.loading = true;
  state.file = file;
  fileCard.hidden = false;
  pagesSection.hidden = false;
  fileName.textContent = file.name;
  fileDetails.textContent = `${formatBytes(file.size)} · preparando páginas`;
  sourceSummary.textContent = `${file.name} · ${formatBytes(file.size)}`;
  dropTitle.textContent = "Documento preparado localmente";
  dropHelp.textContent = "Puedes cambiarlo o quitarlo sin modificar el archivo original.";
  dropZone.classList.add("has-file");
  setLoadingProgress(2, "Leyendo el PDF", file.name);

  try {
    const arrayBuffer = await file.arrayBuffer();
    state.sourceBytes = new Uint8Array(arrayBuffer);
    const loadingTask = pdfjsLib.getDocument({
      data: state.sourceBytes.slice(),
      wasmUrl: new URL("./vendor/pdfjs/wasm/", import.meta.url).href,
    });
    state.pdfDocument = await loadingTask.promise;
    state.pageCount = state.pdfDocument.numPages;

    if (!state.pageCount) throw new Error("El PDF no contiene páginas.");

    fileDetails.textContent = `${state.pageCount} ${state.pageCount === 1 ? "página" : "páginas"} · ${formatBytes(file.size)}`;
    sourceSummary.textContent = `${state.pageCount} ${state.pageCount === 1 ? "página" : "páginas"} · ${formatBytes(file.size)}`;
    pageJumpInput.max = String(state.pageCount);

    for (let pageNumber = 1; pageNumber <= state.pageCount; pageNumber += 1) {
      setLoadingProgress(
        5 + (pageNumber / state.pageCount) * 90,
        `Generando miniatura ${pageNumber} de ${state.pageCount}`,
        "PDF.js trabaja localmente; no se envía ningún dato a Internet."
      );

      const page = await state.pdfDocument.getPage(pageNumber);
      const initialViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(1.25, 190 / Math.max(initialViewport.width, initialViewport.height));
      const viewport = page.getViewport({ scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 1.5);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("No se pudo preparar el lienzo de miniaturas.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      }).promise;

      let hasText = false;
      try {
        const text = await page.getTextContent();
        hasText = text.items.some((item) => String(item.str || "").trim().length > 0);
      } catch {
        hasText = false;
      }

      const blankCandidate = approximateBlankPage(canvas, hasText);
      if (blankCandidate) state.blankPages.add(pageNumber);
      const imageUrl = canvas.toDataURL("image/jpeg", 0.82);
      const size = { width: initialViewport.width, height: initialViewport.height };
      state.thumbnails[pageNumber - 1] = imageUrl;
      state.pageSizes[pageNumber - 1] = size;
      thumbnailGrid.append(createThumbnailCard(pageNumber, imageUrl, size, blankCandidate));
      page.cleanup();
      await nextPaint();
    }

    plannerSection.hidden = false;
    outputSection.hidden = false;
    loadingPanel.hidden = true;
    updateBlankOptionVisibility();
    updateSessionSummary();
    setFeedback(
      `${file.name} preparado: ${state.pageCount} páginas y ${state.blankPages.size} posibles páginas blancas detectadas.`,
      "success"
    );
    updateSelectionSummary();
    updateModeControls();
    buildCurrentPlan();
  } catch (error) {
    const message = error instanceof Error && error.message === "El PDF no contiene páginas."
      ? error.message
      : describePdfError(error, file.name);
    setLoadingProgress(0, "No se pudo preparar el PDF", message);
    setFeedback(message, "error");
    await destroyPdfDocument();
    state.file = null;
    state.sourceBytes = null;
    state.pageCount = 0;
    state.thumbnails = [];
    state.pageSizes = [];
    state.blankPages.clear();
    state.selectedPages.clear();
    thumbnailGrid.replaceChildren();
    fileCard.hidden = true;
    plannerSection.hidden = true;
    outputSection.hidden = true;
  } finally {
    state.loading = false;
  }
}

function updatePageCardSelection(pageNumber) {
  const card = thumbnailGrid.querySelector(`[data-page="${pageNumber}"]`);
  if (!card) return;
  const selected = state.selectedPages.has(pageNumber);
  card.classList.toggle("is-selected", selected);
  card.setAttribute("aria-pressed", String(selected));
  card.setAttribute(
    "aria-label",
    `Página ${pageNumber}. ${selected ? "Seleccionada" : "No seleccionada"}. Pulsa para cambiar.`
  );
}

function togglePageSelection(pageNumber, useRange = false) {
  if (state.loading || state.saving) return;

  if (useRange && state.lastSelectedPage) {
    const start = Math.min(state.lastSelectedPage, pageNumber);
    const end = Math.max(state.lastSelectedPage, pageNumber);
    const shouldSelect = !state.selectedPages.has(pageNumber);
    for (let page = start; page <= end; page += 1) {
      if (shouldSelect) state.selectedPages.add(page);
      else state.selectedPages.delete(page);
      updatePageCardSelection(page);
    }
  } else {
    if (state.selectedPages.has(pageNumber)) state.selectedPages.delete(pageNumber);
    else state.selectedPages.add(pageNumber);
    updatePageCardSelection(pageNumber);
  }

  state.lastSelectedPage = pageNumber;
  updateSelectionSummary();
  buildCurrentPlan();
  if (pageDialog?.open) updateDialogControls();
}

function replaceSelection(pages) {
  state.selectedPages = new Set(pages);
  for (let page = 1; page <= state.pageCount; page += 1) updatePageCardSelection(page);
  state.lastSelectedPage = pages.at(-1) || null;
  updateSelectionSummary();
  buildCurrentPlan();
}

function updateSelectionSummary() {
  const count = state.selectedPages.size;
  const blankCount = [...state.selectedPages].filter((page) => state.blankPages.has(page)).length;
  selectionSummary.textContent = `${count} ${count === 1 ? "seleccionada" : "seleccionadas"}${blankCount ? ` · ${blankCount} posibles blancas` : ""}`;
  selectBlankButton.disabled = state.blankPages.size === 0;
  updateSessionSummary();
}

function applySelectionExpression() {
  const parsed = parsePageExpression(selectionExpression.value, state.pageCount);
  if (parsed.invalidTokens.length || parsed.outOfRange.length) {
    const details = [];
    if (parsed.invalidTokens.length) details.push(`no reconocidos: ${parsed.invalidTokens.join(", ")}`);
    if (parsed.outOfRange.length) details.push(`fuera del documento: ${parsed.outOfRange.join(", ")}`);
    setFeedback(`Revisa la selección por páginas (${details.join("; ")}).`, "error");
    return;
  }
  replaceSelection(parsed.pages);
  setFeedback(`${parsed.pages.length} páginas seleccionadas mediante el intervalo escrito.`, "success");
}

function jumpToPage() {
  const page = Number(pageJumpInput.value);
  if (!Number.isInteger(page) || page < 1 || page > state.pageCount) {
    setFeedback(`Escribe un número entre 1 y ${state.pageCount}.`, "error");
    return;
  }
  const card = thumbnailGrid.querySelector(`[data-page="${page}"]`);
  card?.scrollIntoView({ behavior: "smooth", block: "center" });
  requestAnimationFrame(() => card?.focus({ preventScroll: true }));
}

function updateModeControls() {
  const mode = modeSelect.value;
  $$(".split-mode-control").forEach((control) => {
    const kind = control.dataset.splitControl;
    const visible =
      kind === mode ||
      (kind === "cuts" && (mode === "before" || mode === "after"));
    control.hidden = !visible;
  });
  cutsHelp.textContent = mode === "before"
    ? "Cada número indicado será la primera página de una parte nueva."
    : "Cada número indicado será la última página de una parte.";
  modeHelp.textContent = modeMessages[mode] || "Configura el modo y revisa la vista previa.";
  updateBlankOptionVisibility();
  buildCurrentPlan();
}

function baseDocumentName() {
  const name = state.file?.name || "Documento";
  return name.replace(/\.pdf$/i, "").trim() || "Documento";
}

function currentPlanOptions() {
  return {
    mode: modeSelect.value,
    pageCount: state.pageCount,
    selectedPages: [...state.selectedPages],
    rangesText: rangesInput.value,
    every: everyInput.value,
    parts: partsInput.value,
    cutExpression: cutsInput.value,
    blankPages: [...state.blankPages],
    excludeBlankPages: excludeBlankOption.checked,
    sourceBytes: state.file?.size || 0,
    targetMegabytes: sizeInput.value,
  };
}

function planFileName(group, index, total) {
  return applyNamePattern(namePattern.value, {
    nombre: baseDocumentName(),
    parte: index + 1,
    partes: total,
    pagina: group.length === 1 ? group[0] : group[0],
    desde: group[0],
    hasta: group.at(-1),
    paginas: group.length,
    fecha: new Date().toISOString().slice(0, 10),
  });
}

function buildCurrentPlan() {
  if (planUpdateTimer) window.clearTimeout(planUpdateTimer);
  planUpdateTimer = null;
  buildPlanButton.textContent = "Actualizar ahora";
  if (!state.file || state.loading) return;
  const result = buildSplitPlan(currentPlanOptions());
  state.plan = result.groups;
  state.planAnalysis = analyzePlan(state.plan, state.pageCount);
  state.planErrors = result.errors;
  updatePlanPreview();
  updateSessionSummary();
}

function updatePlanPreview(errors = state.planErrors) {
  outputList.replaceChildren();
  const total = state.plan.length;
  outputCount.textContent = `${total} ${total === 1 ? "archivo" : "archivos"}`;
  emptyPlan.hidden = total > 0;

  state.plan.forEach((group, index) => {
    const item = document.createElement("li");
    item.className = "split-output-item";
    const indexBadge = document.createElement("span");
    indexBadge.className = "split-output-index";
    indexBadge.textContent = String(index + 1).padStart(2, "0");
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = planFileName(group, index, total);
    const pages = document.createElement("span");
    pages.textContent = `${group.length} ${group.length === 1 ? "página" : "páginas"} · ${summarizePages(group)}`;
    copy.append(name, pages);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "split-output-remove";
    remove.textContent = "Quitar";
    remove.setAttribute("aria-label", `Quitar resultado ${index + 1}`);
    remove.addEventListener("click", () => {
      state.plan.splice(index, 1);
      state.planAnalysis = analyzePlan(state.plan, state.pageCount);
      updatePlanPreview();
    });
    item.append(indexBadge, copy, remove);
    outputList.append(item);
  });

  const alerts = [];
  if (errors.length) {
    const errorText = errors.map((error) => `línea ${error.line}: ${error.source || "vacía"}`).join("; ");
    alerts.push({ kind: "error", text: `Hay rangos o cortes inválidos (${errorText}).` });
  }
  if (state.planAnalysis?.duplicatedPages.length) {
    alerts.push({
      kind: "warning",
      text: `Páginas repetidas intencionadamente o por solapamiento: ${summarizePages(state.planAnalysis.duplicatedPages)}.`,
    });
  }
  if (state.planAnalysis?.missingPages.length) {
    alerts.push({
      kind: "info",
      text: `Páginas que no aparecerán en ningún resultado: ${summarizePages(state.planAnalysis.missingPages)}.`,
    });
  }
  const previewNames = state.plan.map((group, index) => planFileName(group, index, total).toLocaleLowerCase());
  const repeatedNames = [...new Set(previewNames.filter((name, index) => previewNames.indexOf(name) !== index))];
  if (repeatedNames.length) {
    alerts.push({
      kind: "warning",
      text: "El patrón produce nombres repetidos. Al guardar se añadirán automáticamente (2), (3) y sucesivos.",
    });
  }
  if (total > 500) {
    alerts.push({
      kind: "warning",
      text: `El plan creará ${total} archivos. Puede requerir bastante tiempo y espacio libre.`,
    });
  }
  if ((modeSelect?.value === "blank-before" || modeSelect?.value === "blank-after") && state.blankPages.size === 0) {
    alerts.push({ kind: "warning", text: "No se detectaron posibles páginas blancas para crear cortes." });
  }
  if (modeSelect?.value === "size-approx") {
    alerts.push({ kind: "info", text: "El tamaño es una estimación por promedio de página; no es un límite exacto." });
  }

  planAlerts.replaceChildren();
  planAlerts.hidden = alerts.length === 0;
  for (const alert of alerts) {
    const row = document.createElement("p");
    row.dataset.kind = alert.kind;
    row.textContent = alert.text;
    planAlerts.append(row);
  }

  const valid = total > 0 && !errors.length && hasLocalPdfEngine();
  if (state.saving) {
    saveButton.disabled = state.cancelRequested;
    saveButton.textContent = state.cancelRequested ? "Cancelando…" : "Cancelar tras el archivo actual";
    saveSummary.textContent = state.cancelRequested
      ? "La cancelación se aplicará al terminar el archivo actual."
      : "Guardando los resultados localmente. Puedes cancelar después del archivo actual.";
  } else {
    saveButton.disabled = !valid;
    saveButton.textContent = valid
      ? `Guardar ${total} PDF`
      : "Guardar resultados";
    saveSummary.textContent = valid
      ? `${total} ${total === 1 ? "archivo preparado" : "archivos preparados"} · ${state.planAnalysis.totalPageOccurrences} páginas en total.`
      : hasLocalPdfEngine()
        ? "Prepara al menos un resultado válido."
        : "No se pudo cargar el motor PDF local.";
  }
  updateSessionSummary();
}

function insertPatternToken(token) {
  const start = namePattern.selectionStart ?? namePattern.value.length;
  const end = namePattern.selectionEnd ?? start;
  namePattern.setRangeText(token, start, end, "end");
  namePattern.focus();
  updatePlanPreview();
}

async function renderDialogPage(pageNumber) {
  if (!state.pdfDocument || pageNumber < 1 || pageNumber > state.pageCount) return;
  state.dialogPage = pageNumber;
  dialogTitle.textContent = `Página ${pageNumber}`;
  dialogCanvasWrap.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "split-dialog-loading";
  loading.textContent = "Preparando vista ampliada localmente...";
  dialogCanvasWrap.append(loading);

  try {
    const page = await state.pdfDocument.getPage(pageNumber);
    const viewportBase = page.getViewport({ scale: 1 });
    const maxWidth = Math.min(window.innerWidth * 0.78, 980);
    const maxHeight = Math.min(window.innerHeight * 0.62, 760);
    const scale = Math.min(2, maxWidth / viewportBase.width, maxHeight / viewportBase.height);
    const viewport = page.getViewport({ scale: Math.max(0.3, scale) });
    const outputScale = Math.min(window.devicePixelRatio || 1, 1.5);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
    canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvasContext: context,
      viewport,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
    }).promise;
    dialogCanvasWrap.replaceChildren(canvas);
    page.cleanup();
  } catch {
    loading.textContent = "No se pudo generar la vista ampliada.";
  }
  updateDialogControls();
}

function updateDialogControls() {
  dialogPrev.disabled = state.dialogPage <= 1;
  dialogNext.disabled = state.dialogPage >= state.pageCount;
  const selected = state.selectedPages.has(state.dialogPage);
  dialogToggle.textContent = selected ? "Deseleccionar página" : "Seleccionar página";
  dialogToggle.classList.toggle("is-selected", selected);
}

function openPageDialog(pageNumber) {
  if (!pageDialog || state.loading) return;
  if (typeof pageDialog.showModal === "function") pageDialog.showModal();
  else pageDialog.setAttribute("open", "");
  renderDialogPage(pageNumber);
}

function closePageDialog() {
  if (!pageDialog) return;
  if (typeof pageDialog.close === "function") pageDialog.close();
  else pageDialog.removeAttribute("open");
}

function setSaveProgress(percent, title, detail, kind = "normal") {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  saveProgressPanel.hidden = false;
  saveProgressPanel.dataset.kind = kind;
  saveProgress.value = value;
  saveProgress.textContent = `${value} %`;
  saveProgressValue.textContent = `${value} %`;
  saveProgressTitle.textContent = title;
  saveProgressDetail.textContent = detail;
}

function resetSaveProgress() {
  saveProgressPanel.hidden = true;
  saveProgressPanel.dataset.kind = "normal";
  saveProgress.value = 0;
  saveProgressValue.textContent = "0 %";
  saveProgressTitle.textContent = "Preparando resultados";
  saveProgressDetail.textContent = "Esperando para comenzar.";
  saveResultActions.hidden = true;
  state.lastSavedRevealPath = null;
  state.lastSavedFolderLabel = "";
}

function updateSavedFolderAction() {
  const revealItemInDir = window.__TAURI__?.opener?.revealItemInDir;
  saveResultActions.hidden = !(state.lastSavedRevealPath && typeof revealItemInDir === "function");
}

async function openSavedFolder() {
  const revealItemInDir = window.__TAURI__?.opener?.revealItemInDir;
  if (!state.lastSavedRevealPath || typeof revealItemInDir !== "function") {
    setFeedback(`Los resultados están en ${state.lastSavedFolderLabel || "la carpeta elegida"}.`, "info");
    return;
  }

  try {
    await revealItemInDir(state.lastSavedRevealPath);
  } catch (error) {
    setFeedback(`No se pudo abrir la carpeta: ${error?.message || error}.`, "error");
  }
}

function resetSplitConfiguration() {
  if (!state.file || state.loading || state.saving) return;
  clearScheduledUpdates();
  state.selectedPages.clear();
  state.lastSelectedPage = null;
  for (let page = 1; page <= state.pageCount; page += 1) updatePageCardSelection(page);
  setDefaultConfigurationValues();
  state.plan = [];
  state.planAnalysis = analyzePlan([], state.pageCount);
  state.planErrors = [];
  resetSaveProgress();
  updateSelectionSummary();
  updateModeControls();
  setFeedback("Configuración restablecida. El PDF continúa preparado en esta sesión.", "success");
}

function pathJoin(directory, name) {
  const separator = String(directory).includes("\\") ? "\\" : "/";
  return `${String(directory).replace(/[\\/]+$/g, "")}${separator}${name}`;
}

function folderNameFromSource() {
  return sanitizeFilename(`${baseDocumentName()}_dividido.pdf`)
    .replace(/\.pdf$/i, "")
    .slice(0, 100);
}

async function chooseDestinationFolder() {
  // Dentro de Tauri debe usarse primero el selector nativo. WebView2 expone
  // showDirectoryPicker, pero puede intentar abrir el origen HTTP interno de
  // desarrollo y rechazarlo como carpeta del sistema.
  const dialog = window.__TAURI__?.dialog;
  const fs = window.__TAURI__?.fs;
  if (typeof dialog?.open === "function" && typeof fs?.writeFile === "function") {
    const selected = await dialog.open({
      directory: true,
      multiple: false,
      title: "Elige la carpeta para los PDF divididos",
    });
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (!path) return null;
    return { kind: "tauri", path: String(path), fs, label: String(path) };
  }

  if (typeof window.showDirectoryPicker === "function") {
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      return { kind: "file-system-access", handle, label: handle.name || "carpeta seleccionada" };
    } catch (error) {
      if (error?.name === "AbortError") return null;
      throw error;
    }
  }

  return { kind: "download", label: "Descargas" };
}

async function ensureSubfolder(target) {
  if (!subfolderOption.checked) return target;
  const folderName = folderNameFromSource();

  if (target.kind === "file-system-access") {
    const handle = await target.handle.getDirectoryHandle(folderName, { create: true });
    return { ...target, handle, label: `${target.label}/${folderName}` };
  }

  if (target.kind === "tauri") {
    const nextPath = pathJoin(target.path, folderName);
    if (typeof target.fs.mkdir === "function") {
      try {
        await target.fs.mkdir(nextPath, { recursive: true });
      } catch (error) {
        const detail = String(error?.message ?? error ?? "");
        if (!/exist/i.test(detail)) throw error;
      }
    }
    return { ...target, path: nextPath, label: nextPath };
  }

  return target;
}

async function uniqueTargetName(target, requestedName) {
  const clean = sanitizeFilename(requestedName);
  const stem = clean.replace(/\.pdf$/i, "");

  if (target.kind === "file-system-access") {
    for (let index = 1; index < 10000; index += 1) {
      const name = index === 1 ? clean : `${stem} (${index}).pdf`;
      try {
        await target.handle.getFileHandle(name, { create: false });
      } catch {
        return name;
      }
    }
    throw new Error("No se pudo encontrar un nombre libre en la carpeta elegida.");
  }

  if (target.kind === "tauri" && typeof target.fs.exists === "function") {
    for (let index = 1; index < 10000; index += 1) {
      const name = index === 1 ? clean : `${stem} (${index}).pdf`;
      const exists = await target.fs.exists(pathJoin(target.path, name));
      if (!exists) return name;
    }
    throw new Error("No se pudo encontrar un nombre libre en la carpeta elegida.");
  }

  return clean;
}

async function writeResult(target, name, bytes) {
  if (target.kind === "file-system-access") {
    const handle = await target.handle.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(bytes);
      await writable.close();
    } catch (error) {
      await writable.abort?.().catch(() => {});
      throw error;
    }
    return null;
  }

  if (target.kind === "tauri") {
    const fullPath = pathJoin(target.path, name);
    await target.fs.writeFile(fullPath, bytes);
    return fullPath;
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  await new Promise((resolve) => setTimeout(resolve, 120));
  return null;
}

function copyMetadata(sourcePdf, outputPdf, outputName) {
  if (cleanMetadataOption.checked) {
    outputPdf.setTitle(titleNameOption.checked ? outputName.replace(/\.pdf$/i, "") : "");
    outputPdf.setAuthor("");
    outputPdf.setSubject("");
    outputPdf.setKeywords([]);
  } else {
    outputPdf.setTitle(titleNameOption.checked ? outputName.replace(/\.pdf$/i, "") : sourcePdf.getTitle() || "");
    outputPdf.setAuthor(sourcePdf.getAuthor() || "");
    outputPdf.setSubject(sourcePdf.getSubject() || "");
    outputPdf.setKeywords(sourcePdf.getKeywords() || []);
    const language = sourcePdf.getLanguage?.();
    if (language) outputPdf.setLanguage(language);
  }
  outputPdf.setCreator("PDFPrivado Pro");
  outputPdf.setProducer("PDFPrivado Pro");
}

async function savePlan() {
  if (state.saving) {
    state.cancelRequested = true;
    saveButton.textContent = "Cancelando...";
    saveButton.disabled = true;
    return;
  }
  if (!state.file || !state.sourceBytes || !state.plan.length || !hasLocalPdfEngine()) return;

  let target;
  try {
    target = await chooseDestinationFolder();
    if (!target) {
      setFeedback("Guardado cancelado. No se creó ningún archivo.", "info");
      return;
    }
    target = await ensureSubfolder(target);
  } catch (error) {
    setFeedback(`No se pudo preparar la carpeta de destino: ${error?.message || error}.`, "error");
    return;
  }

  state.saving = true;
  state.cancelRequested = false;
  state.lastSavedRevealPath = null;
  state.lastSavedFolderLabel = "";
  saveResultActions.hidden = true;
  saveButton.disabled = false;
  saveButton.textContent = "Cancelar tras el archivo actual";
  updatePlanPreview();
  setSaveProgress(2, "Leyendo el documento de origen", state.file.name);

  let created = 0;
  let totalBytes = 0;
  const savedPaths = [];

  try {
    const { PDFDocument } = window.PDFLib;
    let sourcePdf;
    try {
      sourcePdf = await PDFDocument.load(state.sourceBytes.slice(), { ignoreEncryption: false });
    } catch (error) {
      throw new Error(describePdfError(error, state.file.name));
    }

    for (let index = 0; index < state.plan.length; index += 1) {
      if (state.cancelRequested) break;
      const group = state.plan[index];
      const requestedName = planFileName(group, index, state.plan.length);
      const finalName = await uniqueTargetName(target, requestedName);
      const progressBase = 5 + (index / state.plan.length) * 88;
      setSaveProgress(
        progressBase,
        `Creando archivo ${index + 1} de ${state.plan.length}`,
        `${finalName} · páginas ${summarizePages(group)}`
      );
      await nextPaint();

      const outputPdf = await PDFDocument.create();
      const pageIndices = group.map((page) => page - 1);
      const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndices);
      copiedPages.forEach((page) => outputPdf.addPage(page));
      copyMetadata(sourcePdf, outputPdf, finalName);
      const bytes = await outputPdf.save({ addDefaultPage: false, useObjectStreams: true });
      const savedPath = await writeResult(target, finalName, bytes);
      if (savedPath) savedPaths.push(savedPath);
      created += 1;
      totalBytes += bytes.length;
      setSaveProgress(
        5 + ((index + 1) / state.plan.length) * 88,
        `Archivo ${index + 1} guardado`,
        `${finalName} · ${formatBytes(bytes.length)}`
      );
      await nextPaint();
    }

    if (created > 0) {
      state.lastSavedRevealPath = savedPaths[0] || null;
      state.lastSavedFolderLabel = target.label;
      updateSavedFolderAction();
    }

    if (state.cancelRequested) {
      const message = `Proceso cancelado después de crear ${created} ${created === 1 ? "archivo" : "archivos"}. Los ya guardados permanecen en ${target.label}.`;
      setSaveProgress((created / state.plan.length) * 100, "Guardado cancelado", message, "warning");
      setFeedback(message, "info");
    } else {
      const message = `${created} ${created === 1 ? "archivo guardado" : "archivos guardados"} correctamente · ${formatBytes(totalBytes)} en total · ${target.label}.`;
      setSaveProgress(100, "División completada", message, "success");
      setFeedback(message, "success");
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "No se pudo completar la división.";
    if (created > 0) {
      state.lastSavedRevealPath = savedPaths[0] || null;
      state.lastSavedFolderLabel = target?.label || "la carpeta elegida";
      updateSavedFolderAction();
    }
    const partial = created > 0
      ? ` Se ${created === 1 ? "creó" : "crearon"} ${created} ${created === 1 ? "archivo" : "archivos"} antes del error.`
      : "";
    const message = `${detail}${partial}`;
    setSaveProgress(created > 0 ? (created / state.plan.length) * 100 : 0, "No se pudo completar la división", message, "error");
    setFeedback(message, "error");
  } finally {
    state.saving = false;
    state.cancelRequested = false;
    updatePlanPreview();
  }
}


window.addEventListener("pdfprivado:open-split-file", (event) => {
  const file = event.detail?.file;
  if (!(file instanceof File)) return;
  showSplitView();
  loadPdf(file);
});

openSplitButtons.forEach((button) => button.addEventListener("click", () => showSplitView(button)));
backHomeButton?.addEventListener("click", showHomeView);
chooseFileButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  openFilePicker();
});
changeFileButton?.addEventListener("click", openFilePicker);
clearFileButton?.addEventListener("click", async () => {
  if (state.loading || state.saving) return;
  await resetDocumentState();
  setFeedback("El documento se retiró de la sesión. El archivo original no se modificó.", "info");
});
fileInput?.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) loadPdf(file);
});
dropZone?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLButtonElement) return;
  openFilePicker();
});
dropZone?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openFilePicker();
  }
});
["dragenter", "dragover"].forEach((type) => dropZone?.addEventListener(type, (event) => {
  event.preventDefault();
  if (!state.loading && !state.saving) dropZone.classList.add("is-dragover");
}));
["dragleave", "drop"].forEach((type) => dropZone?.addEventListener(type, (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragover");
}));
dropZone?.addEventListener("drop", (event) => {
  const files = [...(event.dataTransfer?.files || [])];
  if (files.length > 1) setFeedback("Dividir PDF trabaja con un documento cada vez; se usará el primero.", "info");
  if (files[0]) loadPdf(files[0]);
});

selectAllButton?.addEventListener("click", () => replaceSelection(Array.from({ length: state.pageCount }, (_, index) => index + 1)));
selectNoneButton?.addEventListener("click", () => replaceSelection([]));
selectEvenButton?.addEventListener("click", () => replaceSelection(Array.from({ length: state.pageCount }, (_, index) => index + 1).filter((page) => page % 2 === 0)));
selectOddButton?.addEventListener("click", () => replaceSelection(Array.from({ length: state.pageCount }, (_, index) => index + 1).filter((page) => page % 2 === 1)));
invertSelectionButton?.addEventListener("click", () => replaceSelection(Array.from({ length: state.pageCount }, (_, index) => index + 1).filter((page) => !state.selectedPages.has(page))));
selectBlankButton?.addEventListener("click", () => replaceSelection([...state.blankPages]));
applySelectionButton?.addEventListener("click", applySelectionExpression);
selectionExpression?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applySelectionExpression();
  }
});
jumpButton?.addEventListener("click", jumpToPage);
pageJumpInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    jumpToPage();
  }
});

modeSelect?.addEventListener("change", updateModeControls);
[rangesInput, everyInput, partsInput, cutsInput, sizeInput].forEach((input) => {
  input?.addEventListener("input", () => schedulePlanUpdate());
});
excludeBlankOption?.addEventListener("change", () => schedulePlanUpdate(80));
buildPlanButton?.addEventListener("click", () => {
  buildCurrentPlan();
  outputList?.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
namePattern?.addEventListener("input", () => schedulePreviewUpdate());
$$('[data-pattern-token]').forEach((button) => button.addEventListener("click", () => insertPatternToken(button.dataset.patternToken)));
[cleanMetadataOption, titleNameOption, subfolderOption].forEach((input) => input?.addEventListener("change", updatePlanPreview));
saveButton?.addEventListener("click", savePlan);
resetConfigButton?.addEventListener("click", resetSplitConfiguration);
openFolderButton?.addEventListener("click", openSavedFolder);

dialogClose?.addEventListener("click", closePageDialog);
dialogPrev?.addEventListener("click", () => renderDialogPage(state.dialogPage - 1));
dialogNext?.addEventListener("click", () => renderDialogPage(state.dialogPage + 1));
dialogToggle?.addEventListener("click", () => togglePageSelection(state.dialogPage));
pageDialog?.addEventListener("click", (event) => {
  if (event.target === pageDialog) closePageDialog();
});
pageDialog?.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" && state.dialogPage > 1) renderDialogPage(state.dialogPage - 1);
  if (event.key === "ArrowRight" && state.dialogPage < state.pageCount) renderDialogPage(state.dialogPage + 1);
});

updateModeControls();
updateBlankOptionVisibility();
updateSelectionSummary();
updatePlanPreview();
updateSessionSummary();
