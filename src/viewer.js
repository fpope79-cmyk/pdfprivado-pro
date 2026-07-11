import * as pdfjsLib from "./vendor/pdfjs/pdf.mjs";
import {
  normalizeRotation,
  resolvePageScope,
  sanitizePdfName,
} from "./viewer-core.js";
import {
  analyzePlan,
  applyNamePattern,
  buildSplitPlan,
  summarizePages,
} from "./split-core.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.mjs",
  import.meta.url
).href;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const homeView = $("#home-view");
const mergeView = $("#merge-view");
const splitView = $("#split-view");
const viewerView = $("#viewer-view");
const viewerTitle = $("#viewer-title");
const openViewerButtons = $$('[data-open-tool="viewer"], [data-open-tool="rotate"]');
const homeOpenButton = $("#home-open-pdf-button");
const fileInput = $("#viewer-file-input");
const insertFileInput = $("#viewer-insert-file-input");
const openFileButton = $("#viewer-open-file-button");
const closeFileButton = $("#viewer-close-file-button");
const emptyState = $("#viewer-empty-state");
const emptyOpenButton = $("#viewer-empty-open-button");
const viewerShell = $("#viewer-shell");
const fileName = $("#viewer-file-name");
const fileDetails = $("#viewer-file-details");
const feedback = $("#viewer-feedback");
const thumbnailList = $("#viewer-thumbnail-list");
const selectedCount = $("#viewer-selected-count");
const selectAllButton = $("#viewer-select-all-button");
const selectNoneButton = $("#viewer-select-none-button");
const canvasStage = $("#viewer-canvas-stage");
const canvas = $("#viewer-canvas");
const continuousStage = $("#viewer-continuous-stage");
const continuousList = $("#viewer-continuous-list");
const organizeStage = $("#viewer-organize-stage");
const organizeGrid = $("#viewer-organize-grid");
const organizeSummary = $("#viewer-organize-summary");
const loadingOverlay = $("#viewer-loading-overlay");
const loadingTitle = $("#viewer-loading-title");
const loadingDetail = $("#viewer-loading-detail");
const previousButton = $("#viewer-previous-button");
const nextButton = $("#viewer-next-button");
const pageInput = $("#viewer-page-input");
const pageTotal = $("#viewer-page-total");
const zoomOutButton = $("#viewer-zoom-out-button");
const zoomInButton = $("#viewer-zoom-in-button");
const zoomValue = $("#viewer-zoom-value");
const fitWidthButton = $("#viewer-fit-width-button");
const fitPageButton = $("#viewer-fit-page-button");
const pageInfo = $("#viewer-page-info");
const documentStatus = $("#viewer-document-status");
const rotateScope = $("#viewer-rotate-scope");
const rotateRangeRow = $("#viewer-rotate-range-row");
const rotateRange = $("#viewer-rotate-range");
const rotateLeftButton = $("#viewer-rotate-left-button");
const rotateHalfButton = $("#viewer-rotate-half-button");
const rotateRightButton = $("#viewer-rotate-right-button");
const undoButton = $("#viewer-undo-button");
const redoButton = $("#viewer-redo-button");
const resetDocumentButton = $("#viewer-reset-document-button");
const rotationSummary = $("#viewer-rotation-summary");
const cleanMetadataOption = $("#viewer-clean-metadata-option");
const titleNameOption = $("#viewer-title-name-option");
const saveButton = $("#viewer-save-button");
const panelSaveButton = $("#viewer-panel-save-button");
const progressPanel = $("#viewer-progress-panel");
const progress = $("#viewer-progress");
const progressValue = $("#viewer-progress-value");
const progressTitle = $("#viewer-progress-title");
const progressDetail = $("#viewer-progress-detail");
const revealButton = $("#viewer-reveal-button");
const progressCloseButton = $("#viewer-progress-close");
const toolTabs = $$("[data-viewer-tool]");
const toolPanels = $$("[data-viewer-tool-panel]");
const toolLinks = $$("[data-activate-tool]");
const openOrganizeButton = $("#viewer-open-organize-button");
const insertPosition = $("#viewer-insert-position");
const panelInsertPdfButton = $("#viewer-panel-insert-pdf-button");
const panelAddBlankButton = $("#viewer-panel-add-blank-button");
const organizeRotateLeft = $("#viewer-organize-rotate-left");
const organizeRotateRight = $("#viewer-organize-rotate-right");
const organizeDuplicate = $("#viewer-organize-duplicate");
const organizeDelete = $("#viewer-organize-delete");
const organizeAddBlank = $("#viewer-organize-add-blank");
const organizeInsertPdf = $("#viewer-organize-insert-pdf");
const mergePosition = $("#viewer-merge-position");
const mergeAddButton = $("#viewer-merge-add-button");
const mergeSummary = $("#viewer-merge-summary");
const mergeOrganizeButton = $("#viewer-merge-organize-button");
const splitMode = $("#viewer-split-mode");
const splitRangesRow = $("#viewer-split-ranges-row");
const splitRanges = $("#viewer-split-ranges");
const splitNumberRow = $("#viewer-split-number-row");
const splitNumberLabel = $("#viewer-split-number-label");
const splitNumber = $("#viewer-split-number");
const splitCutsRow = $("#viewer-split-cuts-row");
const splitCuts = $("#viewer-split-cuts");
const splitSizeRow = $("#viewer-split-size-row");
const splitSize = $("#viewer-split-size");
const splitBlankRow = $("#viewer-split-blank-row");
const detectBlankButton = $("#viewer-detect-blank-button");
const blankCount = $("#viewer-blank-count");
const splitPattern = $("#viewer-split-pattern");
const splitPreview = $("#viewer-split-preview");
const splitSaveButton = $("#viewer-split-save-button");

const A4 = { width: 595.28, height: 841.89 };

const state = {
  file: null,
  sources: new Map(),
  sourceSequence: 0,
  pageSequence: 0,
  pagePlan: [],
  originalPlan: [],
  pageCount: 0,
  currentPage: 1,
  selectedIds: new Set(),
  lastSelectedId: null,
  undoStack: [],
  redoStack: [],
  viewMode: "continuous",
  activeTool: "overview",
  zoomMode: "fit-width",
  zoom: 1,
  renderTask: null,
  renderSerial: 0,
  thumbObserver: null,
  organizeObserver: null,
  continuousObserver: null,
  thumbnailTasks: new Map(),
  organizeTasks: new Map(),
  continuousTasks: new Map(),
  loading: false,
  saving: false,
  lastSavedPath: null,
  insertionPlacement: "after-current",
  blankPages: new Set(),
  splitPlan: [],
  splitErrors: [],
  pan: null,
  continuousPan: null,
  suppressContinuousClickUntil: 0,
  organizeDrag: null,
  organizePointer: null,
  organizeMarquee: null,
  wheelTimestamp: 0,
};

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

function isPdfFile(file) {
  return Boolean(file && (/\.pdf$/i.test(file.name) || file.type === "application/pdf"));
}

function setFeedback(message, kind = "info") {
  feedback.textContent = message;
  feedback.dataset.kind = kind;
  feedback.hidden = false;
}

function hideFeedback() {
  feedback.hidden = true;
}

function setLoading(visible, title = "Preparando documento", detail = "Todo se procesa localmente.") {
  loadingOverlay.hidden = !visible;
  loadingTitle.textContent = title;
  loadingDetail.textContent = detail;
}

function setProgress(percent, title, detail, kind = "normal") {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  progressPanel.hidden = false;
  progressPanel.dataset.kind = kind;
  progress.value = value;
  progress.textContent = `${value} %`;
  progressValue.textContent = `${value} %`;
  progressTitle.textContent = title;
  progressDetail.textContent = detail;
  progressCloseButton.hidden = kind === "normal";
}

function resetProgress() {
  progressPanel.hidden = true;
  progressPanel.dataset.kind = "normal";
  progress.value = 0;
  progressValue.textContent = "0 %";
  progressTitle.textContent = "Preparando copia";
  progressDetail.textContent = "Esperando para comenzar.";
  progressCloseButton.hidden = true;
  revealButton.hidden = true;
  state.lastSavedPath = null;
}

function showWorkspace(openPicker = false) {
  homeView.hidden = true;
  mergeView.hidden = true;
  splitView.hidden = true;
  viewerView.hidden = false;
  document.body.classList.add("viewer-active");
  document.title = state.file ? `${state.file.name} | PDFPrivado Pro` : "PDFPrivado Pro";
  window.scrollTo({ top: 0, behavior: "auto" });
  requestAnimationFrame(() => {
    viewerTitle?.focus({ preventScroll: true });
    if (openPicker && !state.file) openFilePicker();
  });
}

function openFilePicker() {
  if (state.loading || state.saving) return;
  fileInput.value = "";
  fileInput.click();
}

function openInsertPicker(placement = null) {
  if (!state.file || state.loading || state.saving) return;
  state.insertionPlacement = placement || insertPosition?.value || mergePosition?.value || "after-current";
  insertFileInput.value = "";
  insertFileInput.click();
}

function clonePlan(plan = state.pagePlan) {
  return plan.map((entry) => ({ ...entry }));
}

function planSignature(plan = state.pagePlan) {
  return plan
    .map((entry) => `${entry.kind}:${entry.sourceId || "blank"}:${entry.sourcePage || 0}:${normalizeRotation(entry.rotation || 0)}:${entry.id}`)
    .join("|");
}

function isDocumentChanged() {
  return planSignature(state.pagePlan) !== planSignature(state.originalPlan);
}

function entryAt(pageNumber) {
  return state.pagePlan[Number(pageNumber) - 1] || null;
}

function positionOfId(id) {
  const index = state.pagePlan.findIndex((entry) => entry.id === id);
  return index >= 0 ? index + 1 : 0;
}

function selectedPositions() {
  return state.pagePlan
    .map((entry, index) => (state.selectedIds.has(entry.id) ? index + 1 : 0))
    .filter(Boolean);
}

function selectedEntries() {
  return state.pagePlan.filter((entry) => state.selectedIds.has(entry.id));
}

function changedRotationCount() {
  return state.pagePlan.filter((entry) => normalizeRotation(entry.rotation || 0) !== 0).length;
}

function sourceCountInPlan() {
  return new Set(state.pagePlan.filter((entry) => entry.kind === "pdf").map((entry) => entry.sourceId)).size;
}

function sourceLabel(entry) {
  if (entry.kind === "blank") return "Página en blanco";
  const source = state.sources.get(entry.sourceId);
  return `${source?.file?.name || "PDF"} · original ${entry.sourcePage}`;
}

async function cancelTaskMap(map) {
  for (const task of map.values()) {
    try {
      task.cancel?.();
    } catch {
      // La tarea puede haber finalizado.
    }
  }
  map.clear();
}

function disconnectObservers() {
  state.thumbObserver?.disconnect();
  state.organizeObserver?.disconnect();
  state.continuousObserver?.disconnect();
  state.thumbObserver = null;
  state.organizeObserver = null;
  state.continuousObserver = null;
}

async function destroySources() {
  try {
    state.renderTask?.cancel?.();
  } catch {
    // La tarea puede haber finalizado.
  }
  state.renderTask = null;
  await Promise.all([
    cancelTaskMap(state.thumbnailTasks),
    cancelTaskMap(state.organizeTasks),
    cancelTaskMap(state.continuousTasks),
  ]);
  disconnectObservers();
  for (const source of state.sources.values()) {
    try {
      await source.pdfDocument?.destroy?.();
    } catch {
      // PDF.js puede haber destruido ya el documento.
    }
  }
  state.sources.clear();
}

async function resetDocument() {
  await destroySources();
  state.file = null;
  state.sourceSequence = 0;
  state.pageSequence = 0;
  state.pagePlan = [];
  state.originalPlan = [];
  state.pageCount = 0;
  state.currentPage = 1;
  state.selectedIds.clear();
  state.lastSelectedId = null;
  state.undoStack.length = 0;
  state.redoStack.length = 0;
  state.viewMode = "continuous";
  state.zoomMode = "fit-width";
  state.zoom = 1;
  state.renderSerial += 1;
  state.blankPages.clear();
  state.splitPlan = [];
  state.splitErrors = [];
  thumbnailList.replaceChildren();
  continuousList.replaceChildren();
  organizeGrid.replaceChildren();
  viewerShell.hidden = true;
  emptyState.hidden = false;
  fileName.textContent = "Ningún PDF abierto";
  fileDetails.textContent = "Abre un documento o arrástralo para comenzar.";
  fileInput.value = "";
  insertFileInput.value = "";
  canvas.width = 1;
  canvas.height = 1;
  canvas.style.width = "1px";
  canvas.style.height = "1px";
  pageTotal.textContent = "/ 0";
  pageInput.value = "1";
  pageInput.max = "1";
  blankCount.textContent = "Sin analizar";
  document.title = "PDFPrivado Pro";
  hideFeedback();
  resetProgress();
  activateTool("overview");
  setViewMode("continuous", false);
  updateControls();
  updateSplitPlan();
}

async function closeCurrentPdf() {
  if (!state.file || state.loading || state.saving) return;
  if (isDocumentChanged()) {
    const confirmed = window.confirm("Hay cambios pendientes que todavía no se han guardado. ¿Quieres cerrar el PDF y descartarlos?");
    if (!confirmed) return;
  }
  const previousName = state.file.name;
  await resetDocument();
  setFeedback(`${previousName} se cerró. Ya puedes abrir otro documento.`, "info");
}

async function createSource(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdfDocument = await loadingTask.promise;
  if (!pdfDocument.numPages) {
    await pdfDocument.destroy();
    throw new Error(`${file.name} no contiene páginas.`);
  }
  const id = `source-${++state.sourceSequence}`;
  const source = { id, file, bytes, pdfDocument };
  state.sources.set(id, source);
  return source;
}

function entriesForSource(source) {
  return Array.from({ length: source.pdfDocument.numPages }, (_, index) => ({
    id: `page-${++state.pageSequence}`,
    kind: "pdf",
    sourceId: source.id,
    sourcePage: index + 1,
    rotation: 0,
  }));
}

function blankEntry() {
  return {
    id: `page-${++state.pageSequence}`,
    kind: "blank",
    width: A4.width,
    height: A4.height,
    rotation: 0,
  };
}

function insertionIndex(placement = state.insertionPlacement) {
  if (placement === "end") return state.pagePlan.length;
  if (placement === "before-current") return Math.max(0, state.currentPage - 1);
  return Math.min(state.pagePlan.length, state.currentPage);
}

function commitPlan(nextPlan, label, options = {}) {
  const before = clonePlan();
  const after = clonePlan(nextPlan);
  if (planSignature(before) === planSignature(after)) return false;
  state.pagePlan = after;
  state.undoStack.push({ before, after: clonePlan(after), label });
  if (state.undoStack.length > 80) state.undoStack.shift();
  state.redoStack.length = 0;
  afterPlanChanged(options);
  setFeedback(`${label}. El original continúa intacto.`, "success");
  return true;
}

function restorePlanSnapshot(plan, message) {
  state.pagePlan = clonePlan(plan);
  afterPlanChanged();
  setFeedback(message, "info");
}

function undoDocumentChange() {
  const action = state.undoStack.pop();
  if (!action) return;
  state.redoStack.push({ before: clonePlan(action.before), after: clonePlan(action.after), label: action.label });
  restorePlanSnapshot(action.before, `Deshecho: ${action.label}.`);
}

function redoDocumentChange() {
  const action = state.redoStack.pop();
  if (!action) return;
  state.undoStack.push({ before: clonePlan(action.before), after: clonePlan(action.after), label: action.label });
  restorePlanSnapshot(action.after, `Rehecho: ${action.label}.`);
}

function resetDocumentPlan() {
  if (!isDocumentChanged()) return;
  commitPlan(state.originalPlan, "Documento restablecido a su estado inicial");
  state.undoStack.length = 0;
  state.redoStack.length = 0;
  updateControls();
}

function afterPlanChanged(options = {}) {
  state.pageCount = state.pagePlan.length;
  state.currentPage = Math.max(1, Math.min(state.currentPage, state.pageCount || 1));
  const validIds = new Set(state.pagePlan.map((entry) => entry.id));
  state.selectedIds = new Set([...state.selectedIds].filter((id) => validIds.has(id)));
  state.lastSelectedId = validIds.has(state.lastSelectedId) ? state.lastSelectedId : null;
  state.blankPages.clear();
  blankCount.textContent = "Sin analizar";
  resetProgress();
  buildThumbnailList();
  if (state.viewMode === "continuous") buildContinuousList();
  if (state.viewMode === "organize") buildOrganizeGrid();
  if (!options.skipRender && state.viewMode === "page") renderCurrentPage();
  updateDocumentIdentity();
  updateControls();
  updateSplitPlan();
}

function updateDocumentIdentity() {
  if (!state.file) return;
  const sources = sourceCountInPlan();
  const added = Math.max(0, sources - 1);
  fileName.textContent = state.file.name;
  fileDetails.textContent = `${state.pageCount} ${state.pageCount === 1 ? "página" : "páginas"} · ${formatBytes(state.file.size)}${added ? ` · ${added} ${added === 1 ? "PDF añadido" : "PDF añadidos"}` : ""}`;
  mergeSummary.textContent = added
    ? `${sources} PDF de origen combinados en ${state.pageCount} páginas.`
    : "El documento contiene un único PDF de origen.";
}

async function loadPdf(file, sourceText = "el selector de archivos") {
  if (state.loading || state.saving) return;
  if (!isPdfFile(file)) {
    setFeedback("Selecciona un archivo PDF válido.", "error");
    return;
  }
  if (state.file && isDocumentChanged()) {
    const confirmed = window.confirm("Hay cambios pendientes que todavía no se han guardado. ¿Quieres abrir otro PDF y descartarlos?");
    if (!confirmed) return;
  }

  state.loading = true;
  showWorkspace(false);
  await resetDocument();
  state.loading = true;
  state.file = file;
  emptyState.hidden = true;
  viewerShell.hidden = false;
  fileName.textContent = file.name;
  fileDetails.textContent = `${formatBytes(file.size)} · preparando páginas`;
  setLoading(true, "Abriendo el PDF", "El archivo permanece en este equipo.");
  hideFeedback();

  try {
    const source = await createSource(file);
    state.pagePlan = entriesForSource(source);
    state.originalPlan = clonePlan();
    state.pageCount = state.pagePlan.length;
    state.currentPage = 1;
    pageInput.max = String(state.pageCount);
    updateDocumentIdentity();
    buildThumbnailList();
    scrollCurrentThumbnail(false);
    state.zoomMode = "fit-width";
    setViewMode("continuous", false);
    buildContinuousList();
    goToPage(1, { scroll: false });
    continuousStage.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setFeedback(`${file.name} abierto desde ${sourceText}. El documento ya es el inicio de tu espacio de trabajo.`, "success");
    document.title = `${file.name} | PDFPrivado Pro`;
  } catch (error) {
    const detail = String(error?.message || error);
    const message = /password|encrypt/i.test(detail)
      ? "El PDF está protegido con contraseña o cifrado y no puede abrirse en esta versión."
      : `No se pudo abrir ${file.name}. Puede estar dañado o usar una estructura no compatible.`;
    setLoading(true, "No se pudo abrir el PDF", message);
    setFeedback(message, "error");
    await destroySources();
    state.file = null;
    state.pagePlan = [];
    state.pageCount = 0;
    viewerShell.hidden = true;
    emptyState.hidden = false;
  } finally {
    state.loading = false;
    setLoading(false);
    updateControls();
    updateSplitPlan();
  }
}

async function insertPdfFiles(files, placement = state.insertionPlacement) {
  const valid = [...files].filter(isPdfFile);
  if (!valid.length || state.loading || state.saving) return;
  state.loading = true;
  setLoading(true, "Insertando páginas", "Los PDF se leen localmente y se incorporan a la sesión.");
  try {
    const inserted = [];
    for (let index = 0; index < valid.length; index += 1) {
      loadingDetail.textContent = `Preparando ${valid[index].name} (${index + 1} de ${valid.length}).`;
      const source = await createSource(valid[index]);
      inserted.push(...entriesForSource(source));
    }
    const at = insertionIndex(placement);
    const next = clonePlan();
    next.splice(at, 0, ...inserted);
    state.currentPage = at + 1;
    commitPlan(next, `${inserted.length} ${inserted.length === 1 ? "página insertada" : "páginas insertadas"}`);
    setViewMode("organize");
    activateTool("organize");
  } catch (error) {
    setFeedback(`No se pudieron insertar los PDF: ${error?.message || error}.`, "error");
  } finally {
    state.loading = false;
    setLoading(false);
    updateControls();
  }
}

function addBlankPage(placement = null) {
  if (!state.file) return;
  const at = insertionIndex(placement || insertPosition.value || "after-current");
  const next = clonePlan();
  const blank = blankEntry();
  next.splice(at, 0, blank);
  state.currentPage = at + 1;
  state.selectedIds = new Set([blank.id]);
  commitPlan(next, "Página A4 en blanco añadida");
  setViewMode("organize");
}

function duplicateSelectedPages() {
  const positions = selectedPositions();
  if (!positions.length) return;
  const next = clonePlan();
  let offset = 0;
  const duplicatedIds = [];
  for (const position of positions) {
    const original = next[position - 1 + offset];
    const copy = { ...original, id: `page-${++state.pageSequence}` };
    next.splice(position + offset, 0, copy);
    duplicatedIds.push(copy.id);
    offset += 1;
  }
  state.selectedIds = new Set(duplicatedIds);
  commitPlan(next, `${duplicatedIds.length} ${duplicatedIds.length === 1 ? "página duplicada" : "páginas duplicadas"}`);
}

function deleteSelectedPages() {
  const count = state.selectedIds.size;
  if (!count) return;
  if (count >= state.pagePlan.length) {
    setFeedback("El resultado debe conservar al menos una página.", "error");
    return;
  }
  const next = state.pagePlan.filter((entry) => !state.selectedIds.has(entry.id));
  state.selectedIds.clear();
  commitPlan(next, `${count} ${count === 1 ? "página eliminada" : "páginas eliminadas"}`);
}

function reorderEntry(draggedId, targetId, placement = "before") {
  if (!draggedId || !targetId || draggedId === targetId) return;
  const next = clonePlan();
  const from = next.findIndex((entry) => entry.id === draggedId);
  if (from < 0) return;
  const [moved] = next.splice(from, 1);
  const targetIndex = next.findIndex((entry) => entry.id === targetId);
  if (targetIndex < 0) return;
  const to = placement === "after" ? targetIndex + 1 : targetIndex;
  next.splice(to, 0, moved);
  state.currentPage = to + 1;
  commitPlan(next, `Página movida a la posición ${to + 1}`);
}

async function getPdfPage(entry) {
  if (entry.kind !== "pdf") return null;
  const source = state.sources.get(entry.sourceId);
  if (!source) throw new Error("No se encuentra el PDF de origen de esta página.");
  return source.pdfDocument.getPage(entry.sourcePage);
}

async function renderEntryToCanvas(entry, targetCanvas, options = {}) {
  const maxWidth = Math.max(20, Number(options.maxWidth) || 600);
  const maxHeight = Math.max(20, Number(options.maxHeight) || 900);
  const outputScale = Math.min(window.devicePixelRatio || 1, Number(options.outputScale) || 2);
  const explicitScale = Number(options.scale) || 0;

  if (entry.kind === "blank") {
    const baseWidth = entry.width || A4.width;
    const baseHeight = entry.height || A4.height;
    const rotated = normalizeRotation(entry.rotation || 0) % 180 !== 0;
    const width = rotated ? baseHeight : baseWidth;
    const height = rotated ? baseWidth : baseHeight;
    const scale = explicitScale || Math.min(maxWidth / width, maxHeight / height);
    const cssWidth = Math.max(1, Math.round(width * scale));
    const cssHeight = Math.max(1, Math.round(height * scale));
    targetCanvas.width = Math.max(1, Math.floor(cssWidth * outputScale));
    targetCanvas.height = Math.max(1, Math.floor(cssHeight * outputScale));
    targetCanvas.style.width = `${cssWidth}px`;
    targetCanvas.style.height = `${cssHeight}px`;
    const context = targetCanvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    return { width, height, scale, task: null };
  }

  const page = await getPdfPage(entry);
  const rotation = normalizeRotation((page.rotate || 0) + (entry.rotation || 0));
  const base = page.getViewport({ scale: 1, rotation });
  const scale = explicitScale || Math.max(0.05, Math.min(maxWidth / base.width, maxHeight / base.height));
  const viewport = page.getViewport({ scale, rotation });
  targetCanvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
  targetCanvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
  targetCanvas.style.width = `${Math.round(viewport.width)}px`;
  targetCanvas.style.height = `${Math.round(viewport.height)}px`;
  const context = targetCanvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("No se pudo preparar el lienzo de la página.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
  const task = page.render({
    canvasContext: context,
    viewport,
    transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
  });
  options.onTask?.(task);
  try {
    await task.promise;
  } finally {
    page.cleanup();
  }
  return { width: base.width, height: base.height, scale, task };
}

function createThumbnailCard(entry, position) {
  const item = document.createElement("li");
  item.className = "viewer-thumbnail-item";
  item.dataset.entryId = entry.id;
  item.dataset.page = String(position);

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.className = "viewer-thumbnail-select";
  selectButton.setAttribute("aria-label", `Seleccionar página ${position}`);
  selectButton.setAttribute("aria-pressed", "false");
  selectButton.textContent = "✓";
  selectButton.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePageSelection(entry.id, event.shiftKey);
  });

  const pageButton = document.createElement("button");
  pageButton.type = "button";
  pageButton.className = "viewer-thumbnail-page";
  pageButton.setAttribute("aria-label", `Ver página ${position}`);
  const thumbWrap = document.createElement("span");
  thumbWrap.className = "viewer-thumbnail-canvas-wrap";
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = 1;
  thumbCanvas.height = 1;
  thumbCanvas.dataset.renderedSignature = "";
  thumbWrap.append(thumbCanvas);
  const label = document.createElement("span");
  label.className = "viewer-thumbnail-label";
  label.innerHTML = `<strong>Página ${position}</strong><small>${sourceLabel(entry)}</small>`;
  pageButton.append(thumbWrap, label);
  pageButton.addEventListener("click", () => goToPage(position));

  item.append(selectButton, pageButton);
  return item;
}

function buildThumbnailList() {
  state.thumbObserver?.disconnect();
  cancelTaskMap(state.thumbnailTasks);
  thumbnailList.replaceChildren();
  const fragment = document.createDocumentFragment();
  state.pagePlan.forEach((entry, index) => fragment.append(createThumbnailCard(entry, index + 1)));
  thumbnailList.append(fragment);

  const renderVisible = (entryId) => renderThumbnail(entryId).catch(() => {});
  if ("IntersectionObserver" in window) {
    state.thumbObserver = new IntersectionObserver(
      (entries) => entries.forEach((observed) => observed.isIntersecting && renderVisible(observed.target.dataset.entryId)),
      { root: thumbnailList, rootMargin: "320px 0px" }
    );
    thumbnailList.querySelectorAll(".viewer-thumbnail-item").forEach((item) => state.thumbObserver.observe(item));
  } else {
    state.pagePlan.slice(0, 30).forEach((entry) => renderVisible(entry.id));
  }
  refreshSelectionVisuals();
  scrollCurrentThumbnail(false);
}

async function renderThumbnail(entryId, force = false) {
  const item = thumbnailList.querySelector(`[data-entry-id="${entryId}"]`);
  const target = item?.querySelector("canvas");
  const entry = state.pagePlan.find((candidate) => candidate.id === entryId);
  if (!item || !target || !entry) return;
  const signature = `${entry.kind}:${entry.sourceId || "blank"}:${entry.sourcePage || 0}:${normalizeRotation(entry.rotation || 0)}`;
  if (!force && target.dataset.renderedSignature === signature && target.width > 1) return;
  try {
    const result = await renderEntryToCanvas(entry, target, { maxWidth: 138, maxHeight: 155, outputScale: 1.5 });
    if (result.task) state.thumbnailTasks.set(entryId, result.task);
    target.dataset.renderedSignature = signature;
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") throw error;
  } finally {
    state.thumbnailTasks.delete(entryId);
  }
}

function getFitScale(baseWidth, baseHeight) {
  const availableWidth = Math.max(260, canvasStage.clientWidth - 56);
  const availableHeight = Math.max(260, canvasStage.clientHeight - 56);
  if (state.zoomMode === "fit-page") return Math.max(0.1, Math.min(availableWidth / baseWidth, availableHeight / baseHeight));
  if (state.zoomMode === "fit-width") return Math.max(0.1, availableWidth / baseWidth);
  return Math.max(0.1, state.zoom);
}

async function renderCurrentPage() {
  if (!state.file || !state.pageCount || state.viewMode !== "page") return;
  const entry = entryAt(state.currentPage);
  if (!entry) return;
  const serial = ++state.renderSerial;
  try {
    state.renderTask?.cancel?.();
  } catch {
    // La tarea anterior puede haber terminado.
  }
  setLoading(true, `Mostrando página ${state.currentPage}`, "El PDF se representa localmente con PDF.js.");
  try {
    let baseWidth = entry.width || A4.width;
    let baseHeight = entry.height || A4.height;
    if (entry.kind === "pdf") {
      const page = await getPdfPage(entry);
      const rotation = normalizeRotation((page.rotate || 0) + (entry.rotation || 0));
      const base = page.getViewport({ scale: 1, rotation });
      baseWidth = base.width;
      baseHeight = base.height;
      page.cleanup();
    } else if (normalizeRotation(entry.rotation || 0) % 180 !== 0) {
      [baseWidth, baseHeight] = [baseHeight, baseWidth];
    }
    const scale = getFitScale(baseWidth, baseHeight);
    const result = await renderEntryToCanvas(entry, canvas, {
      scale,
      maxWidth: baseWidth * scale,
      maxHeight: baseHeight * scale,
      outputScale: 2,
      onTask: (task) => { state.renderTask = task; },
    });
    if (serial !== state.renderSerial) return;
    state.renderTask = result.task;
    pageInput.value = String(state.currentPage);
    pageInfo.textContent = `Página ${state.currentPage} · ${Math.round(result.width)} × ${Math.round(result.height)} pt · ${sourceLabel(entry)}`;
    zoomValue.textContent = `${Math.round(result.scale * 100)} %`;
    setLoading(false);
  } catch (error) {
    if (error?.name === "RenderingCancelledException") return;
    setLoading(true, "No se pudo mostrar la página", String(error?.message || error));
  }
}

function scrollCurrentThumbnail(smooth = true) {
  const item = thumbnailList.querySelector(`[data-page="${state.currentPage}"]`);
  thumbnailList.querySelectorAll(".viewer-thumbnail-item.is-current").forEach((node) => node.classList.remove("is-current"));
  item?.classList.add("is-current");
  item?.scrollIntoView({ block: "nearest", behavior: smooth ? "smooth" : "auto" });
}

function updateCurrentVisuals() {
  scrollCurrentThumbnail(false);
  organizeGrid.querySelectorAll(".viewer-organize-card.is-current").forEach((node) => node.classList.remove("is-current"));
  organizeGrid.querySelector(`[data-page="${state.currentPage}"]`)?.classList.add("is-current");
  continuousList.querySelectorAll(".viewer-continuous-page.is-current").forEach((node) => node.classList.remove("is-current"));
  continuousList.querySelector(`[data-page="${state.currentPage}"]`)?.classList.add("is-current");
}

function goToPage(pageNumber, options = {}) {
  if (!state.pageCount) return;
  const page = Math.max(1, Math.min(state.pageCount, Number(pageNumber) || 1));
  state.currentPage = page;
  pageInput.value = String(page);
  const currentEntry = entryAt(page);
  pageInfo.textContent = currentEntry ? `Página ${page} · ${sourceLabel(currentEntry)}` : `Página ${page}`;
  updateCurrentVisuals();
  if (state.viewMode === "page") renderCurrentPage();
  if (state.viewMode === "continuous" && options.scroll !== false) {
    continuousList.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (state.viewMode === "organize" && options.scroll !== false) {
    organizeGrid.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  updateControls();
}

function togglePageSelection(entryId, range = false) {
  const position = positionOfId(entryId);
  if (!position) return;
  if (range && state.lastSelectedId && positionOfId(state.lastSelectedId)) {
    const previous = positionOfId(state.lastSelectedId);
    const start = Math.min(position, previous);
    const end = Math.max(position, previous);
    for (let index = start; index <= end; index += 1) {
      const id = entryAt(index)?.id;
      if (id) state.selectedIds.add(id);
    }
  } else if (state.selectedIds.has(entryId)) {
    state.selectedIds.delete(entryId);
  } else {
    state.selectedIds.add(entryId);
  }
  state.lastSelectedId = entryId;
  refreshSelectionVisuals();
  updateControls();
  updateSplitPlan();
}

function replaceSelection(ids) {
  state.selectedIds = new Set(ids);
  state.lastSelectedId = null;
  refreshSelectionVisuals();
  updateControls();
  updateSplitPlan();
}

function refreshSelectionVisuals() {
  for (const item of thumbnailList.querySelectorAll(".viewer-thumbnail-item")) {
    const selected = state.selectedIds.has(item.dataset.entryId);
    item.classList.toggle("is-selected", selected);
    const button = item.querySelector(".viewer-thumbnail-select");
    button?.setAttribute("aria-pressed", String(selected));
  }
  for (const card of organizeGrid.querySelectorAll(".viewer-organize-card")) {
    const selected = state.selectedIds.has(card.dataset.entryId);
    card.classList.toggle("is-selected", selected);
    card.querySelector(".viewer-organize-check")?.setAttribute("aria-pressed", String(selected));
  }
}

function createContinuousItem(entry, position) {
  const article = document.createElement("article");
  article.className = "viewer-continuous-page";
  article.dataset.entryId = entry.id;
  article.dataset.page = String(position);
  article.tabIndex = 0;
  const label = document.createElement("span");
  label.className = "viewer-continuous-label";
  label.textContent = `Página ${position}`;
  const target = document.createElement("canvas");
  target.width = 1;
  target.height = 1;
  target.dataset.renderedSignature = "";
  article.append(label, target);
  article.addEventListener("click", () => {
    if (Date.now() < state.suppressContinuousClickUntil) return;
    goToPage(position, { scroll: false });
  });
  article.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToPage(position, { scroll: false });
    }
  });
  return article;
}

function buildContinuousList() {
  state.continuousObserver?.disconnect();
  cancelTaskMap(state.continuousTasks);
  continuousList.replaceChildren();
  const fragment = document.createDocumentFragment();
  state.pagePlan.forEach((entry, index) => fragment.append(createContinuousItem(entry, index + 1)));
  continuousList.append(fragment);
  if ("IntersectionObserver" in window) {
    state.continuousObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        visible.forEach((observed) => renderContinuousPage(observed.target.dataset.entryId).catch(() => {}));
        const main = visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (main?.intersectionRatio > 0.35) {
          const page = Number(main.target.dataset.page);
          if (page && page !== state.currentPage) {
            goToPage(page, { scroll: false });
          }
        }
      },
      { root: continuousStage, rootMargin: "600px 0px", threshold: [0.1, 0.35, 0.65] }
    );
    continuousList.querySelectorAll(".viewer-continuous-page").forEach((item) => state.continuousObserver.observe(item));
  }
  updateCurrentVisuals();
}

async function renderContinuousPage(entryId) {
  const item = continuousList.querySelector(`[data-entry-id="${entryId}"]`);
  const target = item?.querySelector("canvas");
  const entry = state.pagePlan.find((candidate) => candidate.id === entryId);
  if (!item || !target || !entry) return;
  const signature = `${entry.id}:${normalizeRotation(entry.rotation || 0)}:${state.zoomMode}:${state.zoom}:${continuousStage.clientWidth}:${continuousStage.clientHeight}`;
  if (target.dataset.renderedSignature === signature && target.width > 1) return;

  const availableWidth = Math.max(320, continuousStage.clientWidth - 96);
  const availableHeight = Math.max(300, continuousStage.clientHeight - 86);
  const options = state.zoomMode === "custom"
    ? { scale: state.zoom, maxWidth: 100000, maxHeight: 100000, outputScale: 1.5 }
    : state.zoomMode === "fit-page"
      ? { maxWidth: availableWidth, maxHeight: availableHeight, outputScale: 1.5 }
      : { maxWidth: availableWidth, maxHeight: 100000, outputScale: 1.5 };

  try {
    const result = await renderEntryToCanvas(entry, target, options);
    if (result.task) state.continuousTasks.set(entryId, result.task);
    target.dataset.renderedSignature = signature;
    if (Number(item.dataset.page) === state.currentPage || state.zoomMode === "custom") {
      zoomValue.textContent = `${Math.round(result.scale * 100)} %`;
    }
  } finally {
    state.continuousTasks.delete(entryId);
  }
}

function selectOrganizeRange(entryId, additive = true) {
  const position = positionOfId(entryId);
  if (!position) return;
  const anchor = state.lastSelectedId && positionOfId(state.lastSelectedId)
    ? positionOfId(state.lastSelectedId)
    : position;
  const next = additive ? new Set(state.selectedIds) : new Set();
  const start = Math.min(anchor, position);
  const end = Math.max(anchor, position);
  for (let index = start; index <= end; index += 1) {
    const id = entryAt(index)?.id;
    if (id) next.add(id);
  }
  state.selectedIds = next;
  state.lastSelectedId = entryId;
  refreshSelectionVisuals();
  updateControls();
  updateSplitPlan();
}

function applyOrganizeClickSelection(entryId, event = {}) {
  if (event.shiftKey) {
    selectOrganizeRange(entryId, true);
    return;
  }
  togglePageSelection(entryId, false);
}

function organizeCardOrder() {
  return [...organizeGrid.querySelectorAll(":scope > .viewer-organize-card")]
    .map((card) => card.dataset.entryId)
    .filter(Boolean);
}

function createOrganizeDragGhost(ids) {
  const ghost = document.createElement("div");
  ghost.className = "viewer-organize-drag-ghost";
  const positions = ids.map(positionOfId).filter(Boolean);
  const description = positions.length <= 4
    ? positions.map((page) => `Pág. ${page}`).join(" · ")
    : `${positions.length} páginas seleccionadas`;
  ghost.innerHTML = `<strong>${ids.length === 1 ? "Moviendo 1 página" : `Moviendo ${ids.length} páginas`}</strong><span>${description}</span>`;
  document.body.append(ghost);
  return ghost;
}

function positionOrganizeDragGhost(ghost, clientX, clientY) {
  if (!ghost) return;
  ghost.style.transform = `translate3d(${Math.round(clientX + 18)}px, ${Math.round(clientY + 18)}px, 0)`;
}

function animateOrganizeReflow(beforeRects, excludedIds = new Set()) {
  requestAnimationFrame(() => {
    for (const card of organizeGrid.querySelectorAll(":scope > .viewer-organize-card")) {
      if (excludedIds.has(card.dataset.entryId)) continue;
      const before = beforeRects.get(card.dataset.entryId);
      if (!before) continue;
      const after = card.getBoundingClientRect();
      const deltaX = before.left - after.left;
      const deltaY = before.top - after.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) continue;
      card.getAnimations?.().forEach((animation) => animation.cancel());
      card.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 155, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
    }
  });
}

function nearestOrganizeDropTarget(clientX, clientY, draggedIds) {
  const candidates = [...organizeGrid.querySelectorAll(":scope > .viewer-organize-card")]
    .filter((card) => !draggedIds.has(card.dataset.entryId));
  if (!candidates.length) return { candidate: null, placement: "after" };

  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const card of candidates) {
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(clientX - centerX, clientY - centerY);
    if (distance < nearestDistance) {
      nearest = card;
      nearestDistance = distance;
    }
  }

  const rect = nearest.getBoundingClientRect();
  const rowDifference = Math.abs(clientY - (rect.top + rect.height / 2));
  const placement = rowDifference > rect.height * 0.3
    ? (clientY < rect.top + rect.height / 2 ? "before" : "after")
    : (clientX < rect.left + rect.width / 2 ? "before" : "after");
  return { candidate: nearest, placement };
}

function moveOrganizeCardsLive(cards, candidate, placement) {
  const draggedIds = new Set(cards.map((card) => card.dataset.entryId));
  const beforeRects = new Map(
    [...organizeGrid.querySelectorAll(":scope > .viewer-organize-card")]
      .filter((card) => !draggedIds.has(card.dataset.entryId))
      .map((card) => [card.dataset.entryId, card.getBoundingClientRect()])
  );

  const fragment = document.createDocumentFragment();
  cards.forEach((card) => fragment.append(card));
  if (!candidate) {
    organizeGrid.append(fragment);
  } else {
    const reference = placement === "before" ? candidate : candidate.nextSibling;
    organizeGrid.insertBefore(fragment, reference);
  }
  animateOrganizeReflow(beforeRects, draggedIds);
}

function startOrganizeCardDrag(pointer, event) {
  if (!state.selectedIds.has(pointer.entryId)) {
    state.selectedIds = new Set([pointer.entryId]);
    state.lastSelectedId = pointer.entryId;
    refreshSelectionVisuals();
    updateControls();
    updateSplitPlan();
  }

  const orderedIds = state.pagePlan
    .map((entry) => entry.id)
    .filter((id) => state.selectedIds.has(id));
  const cards = orderedIds
    .map((id) => organizeGrid.querySelector(`[data-entry-id="${id}"]`))
    .filter(Boolean);
  if (!cards.length) return;

  const ghost = createOrganizeDragGhost(orderedIds);
  cards.forEach((card) => {
    card.classList.add("is-dragging");
    card.setAttribute("aria-grabbed", "true");
  });
  organizeGrid.classList.add("is-reordering");
  state.organizeDrag = {
    pointerId: pointer.pointerId,
    ids: orderedIds,
    cards,
    originalOrder: state.pagePlan.map((entry) => entry.id),
    ghost,
  };
  positionOrganizeDragGhost(ghost, event.clientX, event.clientY);
}

function beginOrganizeCardPointer(event, entryId, card) {
  if (event.button !== 0 || state.loading || state.saving) return;
  if (event.target.closest?.(".viewer-organize-check")) return;
  event.preventDefault();
  state.organizePointer = {
    pointerId: event.pointerId,
    entryId,
    card,
    startX: event.clientX,
    startY: event.clientY,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey || event.metaKey,
    dragging: false,
  };
  organizeStage.setPointerCapture?.(event.pointerId);
}

function moveOrganizeCardPointer(event) {
  const pointer = state.organizePointer;
  if (!pointer || pointer.pointerId !== event.pointerId) return;
  const distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
  if (!pointer.dragging && distance > 6) {
    pointer.dragging = true;
    if (pointer.shiftKey) selectOrganizeRange(pointer.entryId, true);
    startOrganizeCardDrag(pointer, event);
  }
  if (!pointer.dragging || !state.organizeDrag) return;
  event.preventDefault();

  const dragState = state.organizeDrag;
  positionOrganizeDragGhost(dragState.ghost, event.clientX, event.clientY);
  const gridRect = organizeGrid.getBoundingClientRect();
  const edge = 72;
  if (event.clientY < gridRect.top + edge) organizeGrid.scrollBy({ top: -26, behavior: "auto" });
  else if (event.clientY > gridRect.bottom - edge) organizeGrid.scrollBy({ top: 26, behavior: "auto" });

  const target = nearestOrganizeDropTarget(event.clientX, event.clientY, new Set(dragState.ids));
  moveOrganizeCardsLive(dragState.cards, target.candidate, target.placement);
}

function finishOrganizeCardPointer(event, cancelled = false) {
  const pointer = state.organizePointer;
  if (!pointer || pointer.pointerId !== event.pointerId) return;
  organizeStage.releasePointerCapture?.(event.pointerId);
  state.organizePointer = null;

  const dragState = state.organizeDrag;
  if (!pointer.dragging || !dragState) {
    if (!cancelled) applyOrganizeClickSelection(pointer.entryId, pointer);
    return;
  }

  dragState.ghost?.remove();
  dragState.cards.forEach((card) => {
    card.classList.remove("is-dragging");
    card.removeAttribute("aria-grabbed");
  });
  organizeGrid.classList.remove("is-reordering");
  state.organizeDrag = null;

  if (cancelled) {
    buildOrganizeGrid();
    return;
  }

  const order = organizeCardOrder();
  if (order.join("|") === dragState.originalOrder.join("|")) {
    refreshSelectionVisuals();
    return;
  }
  const byId = new Map(state.pagePlan.map((entry) => [entry.id, entry]));
  const next = order.map((id) => byId.get(id)).filter(Boolean).map((entry) => ({ ...entry }));
  const firstMovedId = dragState.ids.find((id) => order.includes(id));
  state.currentPage = Math.max(1, order.indexOf(firstMovedId) + 1);
  commitPlan(next, dragState.ids.length === 1 ? "Página movida" : `${dragState.ids.length} páginas movidas`);
}

function marqueeIntersection(rect, cardRect) {
  return !(
    cardRect.right < rect.left ||
    cardRect.left > rect.right ||
    cardRect.bottom < rect.top ||
    cardRect.top > rect.bottom
  );
}

function beginOrganizeMarquee(event) {
  if (event.button !== 0 || state.loading || state.saving || event.target !== organizeGrid) return;
  event.preventDefault();
  const marquee = document.createElement("div");
  marquee.className = "viewer-organize-marquee";
  document.body.append(marquee);
  state.organizeMarquee = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    baseSelection: event.ctrlKey || event.metaKey ? new Set(state.selectedIds) : new Set(),
    marquee,
    moved: false,
  };
  organizeGrid.setPointerCapture?.(event.pointerId);
}

function moveOrganizeMarquee(event) {
  const drag = state.organizeMarquee;
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  const left = Math.min(drag.startX, event.clientX);
  const top = Math.min(drag.startY, event.clientY);
  const right = Math.max(drag.startX, event.clientX);
  const bottom = Math.max(drag.startY, event.clientY);
  drag.moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4;
  Object.assign(drag.marquee.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${right - left}px`,
    height: `${bottom - top}px`,
  });

  const selectionRect = { left, top, right, bottom };
  const next = new Set(drag.baseSelection);
  for (const card of organizeGrid.querySelectorAll(":scope > .viewer-organize-card")) {
    if (marqueeIntersection(selectionRect, card.getBoundingClientRect())) next.add(card.dataset.entryId);
  }
  state.selectedIds = next;
  refreshSelectionVisuals();
  selectedCount.textContent = String(state.selectedIds.size);
  organizeSummary.textContent = `${state.pageCount} ${state.pageCount === 1 ? "página" : "páginas"} · ${state.selectedIds.size} seleccionadas`;
}

function finishOrganizeMarquee(event, cancelled = false) {
  const drag = state.organizeMarquee;
  if (!drag || drag.pointerId !== event.pointerId) return;
  organizeGrid.releasePointerCapture?.(event.pointerId);
  drag.marquee.remove();
  state.organizeMarquee = null;
  if (cancelled) {
    state.selectedIds = new Set(drag.baseSelection);
  } else if (!drag.moved && drag.baseSelection.size === 0) {
    state.selectedIds.clear();
  }
  const last = [...state.selectedIds].at(-1);
  if (last) state.lastSelectedId = last;
  refreshSelectionVisuals();
  updateControls();
  updateSplitPlan();
}

function createOrganizeCard(entry, position) {
  const card = document.createElement("article");
  card.className = "viewer-organize-card";
  card.dataset.entryId = entry.id;
  card.dataset.page = String(position);
  card.tabIndex = 0;
  card.title = "Haz clic para seleccionar o mantén pulsado y arrastra para mover";
  card.addEventListener("pointerdown", (event) => beginOrganizeCardPointer(event, entry.id, card));
  card.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    applyOrganizeClickSelection(entry.id, event);
  });

  const top = document.createElement("div");
  top.className = "viewer-organize-card-top";
  const dragHint = document.createElement("span");
  dragHint.className = "viewer-organize-drag-hint";
  dragHint.textContent = "⋮⋮ Arrastra";
  dragHint.setAttribute("aria-hidden", "true");

  const check = document.createElement("button");
  check.type = "button";
  check.className = "viewer-organize-check";
  check.textContent = "✓";
  check.setAttribute("aria-label", `Seleccionar página ${position}`);
  check.setAttribute("aria-pressed", "false");
  check.addEventListener("click", (event) => {
    event.stopPropagation();
    applyOrganizeClickSelection(entry.id, event);
  });
  top.append(dragHint, check);

  const preview = document.createElement("div");
  preview.className = "viewer-organize-preview";
  preview.setAttribute("aria-hidden", "true");
  const target = document.createElement("canvas");
  target.width = 1;
  target.height = 1;
  target.dataset.renderedSignature = "";
  preview.append(target);

  const footer = document.createElement("div");
  footer.className = "viewer-organize-card-footer";
  footer.innerHTML = `<strong>Página ${position}</strong><span>${sourceLabel(entry)}</span>`;
  card.append(top, preview, footer);
  return card;
}

function buildOrganizeGrid() {
  state.organizeObserver?.disconnect();
  cancelTaskMap(state.organizeTasks);
  organizeGrid.replaceChildren();
  const fragment = document.createDocumentFragment();
  state.pagePlan.forEach((entry, index) => fragment.append(createOrganizeCard(entry, index + 1)));
  organizeGrid.append(fragment);
  organizeSummary.textContent = `${state.pageCount} ${state.pageCount === 1 ? "página" : "páginas"} · ${state.selectedIds.size} seleccionadas`;
  if ("IntersectionObserver" in window) {
    state.organizeObserver = new IntersectionObserver(
      (entries) => entries.forEach((observed) => observed.isIntersecting && renderOrganizeCard(observed.target.dataset.entryId).catch(() => {})),
      { root: organizeStage, rootMargin: "400px 0px" }
    );
    organizeGrid.querySelectorAll(".viewer-organize-card").forEach((item) => state.organizeObserver.observe(item));
  }
  refreshSelectionVisuals();
  updateCurrentVisuals();
}

async function renderOrganizeCard(entryId) {
  const card = organizeGrid.querySelector(`[data-entry-id="${entryId}"]`);
  const target = card?.querySelector("canvas");
  const entry = state.pagePlan.find((candidate) => candidate.id === entryId);
  if (!card || !target || !entry) return;
  const signature = `${entry.id}:${normalizeRotation(entry.rotation || 0)}`;
  if (target.dataset.renderedSignature === signature && target.width > 1) return;
  try {
    const result = await renderEntryToCanvas(entry, target, { maxWidth: 190, maxHeight: 230, outputScale: 1.4 });
    if (result.task) state.organizeTasks.set(entryId, result.task);
    target.dataset.renderedSignature = signature;
  } finally {
    state.organizeTasks.delete(entryId);
  }
}

function setViewMode(mode, rebuild = true) {
  const resolvedMode = mode === "organize" ? "organize" : "continuous";
  state.viewMode = resolvedMode;
  canvasStage.hidden = true;
  continuousStage.hidden = resolvedMode !== "continuous";
  organizeStage.hidden = resolvedMode !== "organize";
  document.body.classList.toggle("viewer-organize-active", resolvedMode === "organize");
  if (rebuild && state.file) {
    if (resolvedMode === "continuous") {
      const page = state.currentPage;
      buildContinuousList();
      requestAnimationFrame(() => {
        continuousList.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ block: "start", behavior: "auto" });
      });
    }
    if (resolvedMode === "organize") buildOrganizeGrid();
  }
  updateControls();
}

function activateTool(name) {
  state.activeTool = name;
  toolTabs.forEach((button) => button.classList.toggle("is-active", button.dataset.viewerTool === name));
  toolPanels.forEach((panel) => {
    const active = panel.dataset.viewerToolPanel === name;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });

  // La herramienta activa y la vista central son estados independientes.
  // Entrar en Organizar abre su cuadrícula, pero cambiar a Dividir, Añadir,
  // Rotar o Guardar no debe sacar al usuario de ella ni perder la selección.
  if (state.file && name === "organize" && state.viewMode !== "organize") {
    setViewMode("organize");
  }

  if (name === "split") updateSplitPlan();
  document.querySelector(`.viewer-tool-panel[data-viewer-tool-panel="${name}"]`)?.scrollTo?.({ top: 0 });
}

function targetPagesForRotation() {
  return resolvePageScope({
    scope: rotateScope.value,
    pageCount: state.pageCount,
    currentPage: state.currentPage,
    selectedPages: new Set(selectedPositions()),
    expression: rotateRange.value,
  });
}

function applyRotation(delta, positions = null) {
  if (!state.file || state.loading || state.saving) return;
  try {
    const pages = positions || targetPagesForRotation();
    const next = clonePlan();
    for (const page of pages) {
      const entry = next[page - 1];
      if (entry) entry.rotation = normalizeRotation((entry.rotation || 0) + delta);
    }
    commitPlan(next, `${pages.length === 1 ? "Página girada" : `${pages.length} páginas giradas`}`);
  } catch (error) {
    setFeedback(String(error?.message || error), "error");
  }
}

function updateScopeControls() {
  rotateRangeRow.hidden = rotateScope.value !== "range";
}

function updateControls() {
  const ready = Boolean(state.file && state.pageCount);
  const selected = state.selectedIds.size;
  const dirty = isDocumentChanged();
  const rotations = changedRotationCount();
  selectedCount.textContent = `${selected} ${selected === 1 ? "seleccionada" : "seleccionadas"}`;
  organizeSummary.textContent = `${state.pageCount} ${state.pageCount === 1 ? "página" : "páginas"} · ${selected} seleccionadas`;
  pageTotal.textContent = `/ ${state.pageCount || 0}`;
  pageInput.max = String(state.pageCount || 1);
  previousButton.disabled = !ready || state.currentPage <= 1;
  nextButton.disabled = !ready || state.currentPage >= state.pageCount;
  pageInput.disabled = !ready;
  const readingView = ready && state.viewMode === "continuous";
  zoomOutButton.disabled = !readingView;
  zoomInButton.disabled = !readingView;
  fitWidthButton.disabled = !readingView;
  fitPageButton.disabled = !readingView;
  selectAllButton.disabled = !ready;
  selectNoneButton.disabled = !ready || !selected;
  rotateScope.disabled = !ready;
  rotateLeftButton.disabled = !ready;
  rotateHalfButton.disabled = !ready;
  rotateRightButton.disabled = !ready;
  undoButton.disabled = !state.undoStack.length || state.saving;
  redoButton.disabled = !state.redoStack.length || state.saving;
  resetDocumentButton.disabled = !dirty || state.saving;
  saveButton.disabled = !ready || state.saving;
  panelSaveButton.disabled = !ready || state.saving;
  closeFileButton.hidden = !ready;
  closeFileButton.disabled = state.loading || state.saving;
  openFileButton.textContent = ready ? "Abrir otro PDF" : "Abrir PDF";
  openOrganizeButton.disabled = !ready;
  openOrganizeButton.textContent = state.viewMode === "organize" ? "Volver a lectura" : "Abrir vista Organizar";
  openOrganizeButton.setAttribute("aria-pressed", String(state.viewMode === "organize"));
  insertPosition.disabled = !ready;
  panelInsertPdfButton.disabled = !ready;
  panelAddBlankButton.disabled = !ready;
  organizeRotateLeft.disabled = !ready || !selected;
  organizeRotateRight.disabled = !ready || !selected;
  organizeDuplicate.disabled = !ready || !selected;
  organizeDelete.disabled = !ready || !selected;
  organizeAddBlank.disabled = !ready;
  organizeInsertPdf.disabled = !ready;
  mergePosition.disabled = !ready;
  mergeAddButton.disabled = !ready;
  mergeOrganizeButton.disabled = !ready;
  splitMode.disabled = !ready;
  splitSaveButton.disabled = !ready || !state.splitPlan.length || state.splitErrors.length > 0 || state.saving;
  documentStatus.textContent = ready
    ? dirty
      ? `${state.pageCount} páginas · cambios pendientes de guardar como copia`
      : "Documento abierto sin cambios"
    : "Ningún documento abierto";
  rotationSummary.textContent = rotations
    ? `${rotations} ${rotations === 1 ? "página tiene" : "páginas tienen"} giros pendientes.`
    : "Todavía no hay giros pendientes.";
  if (rotateScope.value === "selected" && !selected) rotationSummary.textContent = "Selecciona páginas en las miniaturas para girarlas juntas.";
  fitWidthButton.classList.toggle("is-active", state.zoomMode === "fit-width");
  fitPageButton.classList.toggle("is-active", state.zoomMode === "fit-page");
}

function refreshReadingView() {
  if (!state.file) return;
  if (state.viewMode === "continuous") {
    const page = state.currentPage;
    buildContinuousList();
    requestAnimationFrame(() => {
      continuousList.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  } else if (state.viewMode === "page") {
    renderCurrentPage();
  }
}

function setCustomZoom(nextZoom) {
  state.zoomMode = "custom";
  state.zoom = Math.max(0.2, Math.min(4, nextZoom));
  zoomValue.textContent = `${Math.round(state.zoom * 100)} %`;
  refreshReadingView();
  updateControls();
}

async function buildPdfBytesForEntries(entries, outputName = null) {
  if (!window.PDFLib?.PDFDocument) throw new Error("El motor PDF local no está disponible.");
  const { PDFDocument, degrees } = window.PDFLib;
  const output = await PDFDocument.create();
  const loaded = new Map();

  for (const entry of entries) {
    if (entry.kind === "blank") {
      const rotated = normalizeRotation(entry.rotation || 0) % 180 !== 0;
      const width = rotated ? entry.height || A4.height : entry.width || A4.width;
      const height = rotated ? entry.width || A4.width : entry.height || A4.height;
      output.addPage([width, height]);
      continue;
    }
    const source = state.sources.get(entry.sourceId);
    if (!source) throw new Error("Falta un PDF de origen necesario para guardar.");
    let sourceDocument = loaded.get(source.id);
    if (!sourceDocument) {
      sourceDocument = await PDFDocument.load(source.bytes.slice(), { updateMetadata: false });
      loaded.set(source.id, sourceDocument);
    }
    const [copied] = await output.copyPages(sourceDocument, [entry.sourcePage - 1]);
    const original = copied.getRotation()?.angle || 0;
    copied.setRotation(degrees(normalizeRotation(original + (entry.rotation || 0))));
    output.addPage(copied);
  }

  if (cleanMetadataOption.checked) {
    output.setTitle(titleNameOption.checked && outputName ? outputName.replace(/\.pdf$/i, "") : "");
    output.setAuthor("");
    output.setSubject("");
    output.setKeywords([]);
  } else if (titleNameOption.checked && outputName) {
    output.setTitle(outputName.replace(/\.pdf$/i, ""));
  }

  return output.save({ useObjectStreams: true });
}

function pathFileName(path) {
  return String(path || "documento.pdf").split(/[\\/]/).pop() || "documento.pdf";
}

function pathJoin(directory, name) {
  const separator = String(directory).includes("\\") ? "\\" : "/";
  return `${String(directory).replace(/[\\/]+$/g, "")}${separator}${name}`;
}

function splitPath(path) {
  const text = String(path || "");
  const match = text.match(/^(.*[\\/])([^\\/]+)$/);
  return match ? { directory: match[1].replace(/[\\/]$/, ""), name: match[2] } : { directory: "", name: text };
}

async function uniqueTauriPath(path) {
  const exists = window.__TAURI__?.fs?.exists;
  if (typeof exists !== "function" || !(await exists(path))) return path;
  const { directory, name } = splitPath(path);
  const stem = name.replace(/\.pdf$/i, "");
  for (let index = 2; index < 10000; index += 1) {
    const candidate = pathJoin(directory, `${stem} (${index}).pdf`);
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("No se encontró un nombre libre para la copia.");
}

async function chooseSaveTarget(suggestedName) {
  const dialog = window.__TAURI__?.dialog;
  const fs = window.__TAURI__?.fs;
  if (typeof dialog?.save === "function" && typeof fs?.writeFile === "function") {
    const chosen = await dialog.save({
      defaultPath: suggestedName,
      title: "Guardar una copia nueva del PDF",
      filters: [{ name: "Documento PDF", extensions: ["pdf"] }],
    });
    if (!chosen) return null;
    const uniquePath = await uniqueTauriPath(String(chosen));
    return { kind: "tauri", path: uniquePath, name: pathFileName(uniquePath), fs };
  }
  return { kind: "download", name: suggestedName };
}

async function writeSaveTarget(target, bytes) {
  if (target.kind === "tauri") {
    await target.fs.writeFile(target.path, bytes);
    return target.path;
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = target.name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1800);
  return null;
}

function outputBaseName() {
  return state.file?.name?.replace(/\.pdf$/i, "") || "documento";
}

async function saveCopy() {
  if (!state.file || state.saving) return;
  state.saving = true;
  updateControls();
  hideFeedback();
  resetProgress();
  try {
    const suffix = sourceCountInPlan() > 1 ? "combinado" : isDocumentChanged() ? "editado" : "copia";
    const suggested = sanitizePdfName(state.file.name, suffix);
    const target = await chooseSaveTarget(suggested);
    if (!target) {
      setFeedback("Guardado cancelado. No se creó ningún archivo.", "info");
      return;
    }
    setProgress(12, "Preparando la copia", "Aplicando el orden, inserciones y giros localmente.");
    const bytes = await buildPdfBytesForEntries(state.pagePlan, target.name);
    setProgress(78, "Guardando la copia", target.name);
    const savedPath = await writeSaveTarget(target, bytes);
    state.lastSavedPath = savedPath;
    revealButton.hidden = !savedPath || typeof window.__TAURI__?.opener?.revealItemInDir !== "function";
    setProgress(100, "Copia guardada", `${target.name} se creó sin modificar el original.`, "success");
    setFeedback(`${target.name} guardado correctamente. El documento original permanece intacto.`, "success");
  } catch (error) {
    const message = `No se pudo guardar la copia: ${error?.message || error}.`;
    setProgress(0, "No se pudo guardar", message, "error");
    setFeedback(message, "error");
  } finally {
    state.saving = false;
    updateControls();
  }
}

function updateSplitModeRows() {
  const mode = splitMode.value;
  splitRangesRow.hidden = mode !== "ranges";
  splitNumberRow.hidden = !(mode === "every-n" || mode === "balanced");
  splitCutsRow.hidden = !(mode === "before" || mode === "after");
  splitSizeRow.hidden = mode !== "size-approx";
  splitBlankRow.hidden = !(mode === "blank-before" || mode === "blank-after");
  splitNumberLabel.textContent = mode === "balanced" ? "Número de partes" : "Páginas por archivo";
}

function updateSplitPlan() {
  updateSplitModeRows();
  if (!state.file || !state.pageCount) {
    state.splitPlan = [];
    state.splitErrors = [];
    splitPreview.innerHTML = "<strong>Abre un PDF para preparar la división.</strong>";
    updateControls();
    return;
  }
  const selected = selectedPositions();
  const result = buildSplitPlan({
    mode: splitMode.value,
    pageCount: state.pageCount,
    selectedPages: selected,
    rangesText: splitRanges.value,
    every: splitNumber.value,
    parts: splitNumber.value,
    cutExpression: splitCuts.value,
    blankPages: [...state.blankPages],
    sourceBytes: [...state.sources.values()].reduce((sum, source) => sum + source.bytes.length, 0),
    targetMegabytes: splitSize.value,
  });
  const selectionModes = new Set(["selected-one", "selected-each", "selected-and-rest", "remove-selected"]);
  const blankModes = new Set(["blank-before", "blank-after"]);
  if (selectionModes.has(splitMode.value) && !selected.length) result.groups = [];
  if (blankModes.has(splitMode.value) && !state.blankPages.size) result.groups = [];
  state.splitPlan = result.groups;
  state.splitErrors = result.errors;
  const analysis = analyzePlan(result.groups, state.pageCount);

  if (result.errors.length) {
    splitPreview.innerHTML = `<strong>Revisa la configuración.</strong><span>Hay rangos o páginas no válidos.</span>`;
  } else if (!result.groups.length) {
    const needsSelection = ["selected-one", "selected-each", "selected-and-rest", "remove-selected"].includes(splitMode.value);
    splitPreview.innerHTML = `<strong>No hay resultados preparados.</strong><span>${needsSelection ? "Selecciona páginas en las miniaturas." : "Completa las opciones de este modo."}</span>`;
  } else {
    const samples = result.groups.slice(0, 5).map((group, index) => `<li><b>${String(index + 1).padStart(2, "0")}</b><span>${group.length} páginas · ${summarizePages(group)}</span></li>`).join("");
    const extra = result.groups.length > 5 ? `<small>Y ${result.groups.length - 5} resultados más.</small>` : "";
    const warnings = [
      analysis.missingPages.length ? `No incluidas: ${summarizePages(analysis.missingPages)}.` : "",
      analysis.duplicatedPages.length ? `Repetidas: ${summarizePages(analysis.duplicatedPages)}.` : "",
    ].filter(Boolean).join(" ");
    splitPreview.innerHTML = `<strong>${result.groups.length} ${result.groups.length === 1 ? "archivo preparado" : "archivos preparados"}</strong><ul>${samples}</ul>${extra}${warnings ? `<em>${warnings}</em>` : ""}`;
  }
  updateControls();
}

function approximateBlankPage(targetCanvas, hasText) {
  if (hasText) return false;
  const context = targetCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  const { width, height } = targetCanvas;
  const image = context.getImageData(0, 0, width, height).data;
  const pixelStep = Math.max(1, Math.floor(Math.sqrt((width * height) / 6000)));
  let checked = 0;
  let nonWhite = 0;
  for (let y = 0; y < height; y += pixelStep) {
    for (let x = 0; x < width; x += pixelStep) {
      const index = (y * width + x) * 4;
      checked += 1;
      if (image[index] < 246 || image[index + 1] < 246 || image[index + 2] < 246) nonWhite += 1;
    }
  }
  return checked > 0 && nonWhite / checked < 0.0015;
}

async function detectBlankPages() {
  if (!state.file || state.loading) return;
  state.loading = true;
  state.blankPages.clear();
  detectBlankButton.disabled = true;
  try {
    for (let index = 0; index < state.pagePlan.length; index += 1) {
      setProgress((index / state.pagePlan.length) * 95, "Buscando páginas blancas", `Analizando página ${index + 1} de ${state.pagePlan.length}.`);
      const entry = state.pagePlan[index];
      if (entry.kind === "blank") {
        state.blankPages.add(index + 1);
        continue;
      }
      const page = await getPdfPage(entry);
      let hasText = false;
      try {
        const text = await page.getTextContent();
        hasText = text.items.some((item) => String(item.str || "").trim().length > 0);
      } catch {
        hasText = false;
      }
      page.cleanup();
      const testCanvas = document.createElement("canvas");
      await renderEntryToCanvas(entry, testCanvas, { maxWidth: 110, maxHeight: 150, outputScale: 1 });
      if (approximateBlankPage(testCanvas, hasText)) state.blankPages.add(index + 1);
    }
    blankCount.textContent = `${state.blankPages.size} posibles blancas`;
    setProgress(100, "Análisis terminado", `${state.blankPages.size} posibles páginas blancas detectadas.`, "success");
    updateSplitPlan();
  } catch (error) {
    const message = `No se pudo completar la detección: ${error?.message || error}.`;
    setProgress(0, "No se pudo analizar", message, "error");
    setFeedback(message, "error");
  } finally {
    state.loading = false;
    detectBlankButton.disabled = false;
  }
}

async function chooseOutputDirectory() {
  const dialog = window.__TAURI__?.dialog;
  const fs = window.__TAURI__?.fs;
  if (typeof dialog?.open !== "function" || typeof fs?.writeFile !== "function") {
    throw new Error("El guardado múltiple necesita la aplicación de escritorio.");
  }
  const selected = await dialog.open({ directory: true, multiple: false, title: "Elegir carpeta para los PDF divididos" });
  if (!selected) return null;
  return { directory: String(selected), fs };
}

async function saveSplitResults() {
  if (!state.splitPlan.length || state.splitErrors.length || state.saving) return;
  state.saving = true;
  updateControls();
  try {
    const target = await chooseOutputDirectory();
    if (!target) {
      setFeedback("Guardado cancelado. No se creó ningún resultado.", "info");
      return;
    }
    const total = state.splitPlan.length;
    let firstPath = null;
    for (let index = 0; index < total; index += 1) {
      const positions = state.splitPlan[index];
      const entries = positions.map((position) => entryAt(position)).filter(Boolean);
      const context = {
        nombre: outputBaseName(),
        parte: index + 1,
        partes: total,
        pagina: positions[0],
        desde: Math.min(...positions),
        hasta: Math.max(...positions),
        paginas: positions.length,
      };
      const name = applyNamePattern(splitPattern.value, context);
      let path = await uniqueTauriPath(pathJoin(target.directory, name));
      setProgress((index / total) * 90, `Creando archivo ${index + 1} de ${total}`, name);
      const bytes = await buildPdfBytesForEntries(entries, pathFileName(path));
      await target.fs.writeFile(path, bytes);
      if (!firstPath) firstPath = path;
    }
    state.lastSavedPath = firstPath;
    revealButton.hidden = !firstPath || typeof window.__TAURI__?.opener?.revealItemInDir !== "function";
    setProgress(100, "División completada", `${total} ${total === 1 ? "archivo creado" : "archivos creados"} sin modificar el original.`, "success");
    setFeedback(`${total} ${total === 1 ? "PDF guardado" : "PDF guardados"} correctamente.`, "success");
  } catch (error) {
    const message = `No se pudieron guardar los resultados: ${error?.message || error}.`;
    setProgress(0, "No se pudo completar la división", message, "error");
    setFeedback(message, "error");
  } finally {
    state.saving = false;
    updateControls();
  }
}

async function revealSavedFile() {
  const reveal = window.__TAURI__?.opener?.revealItemInDir;
  if (!state.lastSavedPath || typeof reveal !== "function") return;
  try {
    await reveal(state.lastSavedPath);
  } catch (error) {
    setFeedback(`No se pudo abrir la carpeta: ${error?.message || error}.`, "error");
  }
}

function pathFileNameFromNative(path) {
  return String(path || "documento.pdf").split(/[\\/]/).pop() || "documento.pdf";
}

async function loadPdfFromPath(path, sourceText = "Windows") {
  const invoke = window.__TAURI__?.core?.invoke;
  const readFile = window.__TAURI__?.fs?.readFile;
  if (typeof invoke !== "function" || typeof readFile !== "function") {
    setFeedback("Esta apertura necesita ejecutarse dentro de la aplicación de escritorio.", "error");
    return;
  }
  try {
    showWorkspace(false);
    const info = await invoke("authorize_pdf_path", { path: String(path) });
    const bytes = await readFile(info.path);
    const nativeFile = new File([bytes], info.name || pathFileNameFromNative(path), { type: "application/pdf", lastModified: Date.now() });
    await loadPdf(nativeFile, sourceText);
  } catch (error) {
    setFeedback(`No se pudo abrir el PDF indicado: ${error?.message || error}.`, "error");
  }
}

async function initializeNativeOpenHandling() {
  showWorkspace(false);
  const invoke = window.__TAURI__?.core?.invoke;
  if (typeof invoke === "function") {
    try {
      const startupPath = await invoke("startup_pdf_path");
      if (startupPath) await loadPdfFromPath(startupPath, "el Explorador de Windows");
    } catch {
      // El inicio normal no contiene un PDF.
    }
  }

  let currentWindow = null;
  try {
    if (typeof window.__TAURI__?.webviewWindow?.getCurrentWebviewWindow === "function") currentWindow = window.__TAURI__.webviewWindow.getCurrentWebviewWindow();
    else if (typeof window.__TAURI__?.window?.getCurrentWindow === "function") currentWindow = window.__TAURI__.window.getCurrentWindow();
  } catch {
    currentWindow = null;
  }
  if (currentWindow && typeof currentWindow.onDragDropEvent === "function") {
    try {
      await currentWindow.onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const paths = event.payload.paths?.filter((candidate) => /\.pdf$/i.test(candidate)) || [];
        if (!paths.length) return;
        if (!state.file) loadPdfFromPath(paths[0], "un archivo arrastrado");
        else if (paths.length === 1) loadPdfFromPath(paths[0], "un archivo arrastrado");
      });
    } catch {
      // El selector HTML continúa disponible.
    }
  }
}

function handlePagePanStart(event) {
  if (state.viewMode !== "page" || event.button !== 0 || !state.file) return;
  state.pan = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: canvasStage.scrollLeft,
    scrollTop: canvasStage.scrollTop,
  };
  canvasStage.setPointerCapture?.(event.pointerId);
  canvasStage.classList.add("is-panning");
}

function handlePagePanMove(event) {
  if (!state.pan || state.pan.pointerId !== event.pointerId) return;
  canvasStage.scrollLeft = state.pan.scrollLeft - (event.clientX - state.pan.startX);
  canvasStage.scrollTop = state.pan.scrollTop - (event.clientY - state.pan.startY);
}

function handlePagePanEnd(event) {
  if (!state.pan || state.pan.pointerId !== event.pointerId) return;
  state.pan = null;
  canvasStage.releasePointerCapture?.(event.pointerId);
  canvasStage.classList.remove("is-panning");
}

function handleContinuousPanStart(event) {
  if (state.viewMode !== "continuous" || event.button !== 0 || !state.file) return;
  state.continuousPan = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: continuousStage.scrollLeft,
    scrollTop: continuousStage.scrollTop,
    moved: false,
  };
  continuousStage.setPointerCapture?.(event.pointerId);
}

function handleContinuousPanMove(event) {
  const pan = state.continuousPan;
  if (!pan || pan.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - pan.startX;
  const deltaY = event.clientY - pan.startY;
  if (!pan.moved && Math.hypot(deltaX, deltaY) > 5) {
    pan.moved = true;
    continuousStage.classList.add("is-panning");
  }
  if (!pan.moved) return;
  event.preventDefault();
  continuousStage.scrollLeft = pan.scrollLeft - deltaX;
  continuousStage.scrollTop = pan.scrollTop - deltaY;
}

function handleContinuousPanEnd(event) {
  const pan = state.continuousPan;
  if (!pan || pan.pointerId !== event.pointerId) return;
  continuousStage.releasePointerCapture?.(event.pointerId);
  continuousStage.classList.remove("is-panning");
  if (pan.moved) state.suppressContinuousClickUntil = Date.now() + 250;
  state.continuousPan = null;
}

openViewerButtons.forEach((button) => button.addEventListener("click", () => showWorkspace(false)));
homeOpenButton?.addEventListener("click", () => showWorkspace(true));
openFileButton?.addEventListener("click", openFilePicker);
closeFileButton?.addEventListener("click", closeCurrentPdf);
emptyOpenButton?.addEventListener("click", (event) => { event.stopPropagation(); openFilePicker(); });
emptyState?.addEventListener("click", (event) => { if (!(event.target instanceof HTMLButtonElement)) openFilePicker(); });
emptyState?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openFilePicker(); }
});
["dragenter", "dragover"].forEach((type) => emptyState?.addEventListener(type, (event) => { event.preventDefault(); emptyState.classList.add("is-dragover"); }));
["dragleave", "drop"].forEach((type) => emptyState?.addEventListener(type, (event) => { event.preventDefault(); emptyState.classList.remove("is-dragover"); }));
emptyState?.addEventListener("drop", (event) => {
  const files = [...(event.dataTransfer?.files || [])].filter(isPdfFile);
  if (files[0]) loadPdf(files[0], "un archivo arrastrado");
});
fileInput?.addEventListener("change", () => { const selected = fileInput.files?.[0]; if (selected) loadPdf(selected, "el selector de archivos"); });
insertFileInput?.addEventListener("change", () => insertPdfFiles(insertFileInput.files || [], state.insertionPlacement));
previousButton?.addEventListener("click", () => goToPage(state.currentPage - 1));
nextButton?.addEventListener("click", () => goToPage(state.currentPage + 1));
pageInput?.addEventListener("change", () => goToPage(pageInput.value));
pageInput?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); goToPage(pageInput.value); } });
zoomOutButton?.addEventListener("click", () => setCustomZoom((state.zoomMode === "custom" ? state.zoom : parseInt(zoomValue.textContent, 10) / 100) - 0.15));
zoomInButton?.addEventListener("click", () => setCustomZoom((state.zoomMode === "custom" ? state.zoom : parseInt(zoomValue.textContent, 10) / 100) + 0.15));
fitWidthButton?.addEventListener("click", () => { state.zoomMode = "fit-width"; refreshReadingView(); updateControls(); });
fitPageButton?.addEventListener("click", () => { state.zoomMode = "fit-page"; refreshReadingView(); updateControls(); });
selectAllButton?.addEventListener("click", () => replaceSelection(state.pagePlan.map((entry) => entry.id)));
selectNoneButton?.addEventListener("click", () => replaceSelection([]));
rotateScope?.addEventListener("change", () => { updateScopeControls(); updateControls(); });
rotateLeftButton?.addEventListener("click", () => applyRotation(-90));
rotateHalfButton?.addEventListener("click", () => applyRotation(180));
rotateRightButton?.addEventListener("click", () => applyRotation(90));
undoButton?.addEventListener("click", undoDocumentChange);
redoButton?.addEventListener("click", redoDocumentChange);
resetDocumentButton?.addEventListener("click", resetDocumentPlan);
saveButton?.addEventListener("click", saveCopy);
panelSaveButton?.addEventListener("click", saveCopy);
revealButton?.addEventListener("click", revealSavedFile);
progressCloseButton?.addEventListener("click", resetProgress);
toolTabs.forEach((button) => button.addEventListener("click", () => activateTool(button.dataset.viewerTool)));
toolLinks.forEach((button) => button.addEventListener("click", () => activateTool(button.dataset.activateTool)));
openOrganizeButton?.addEventListener("click", () => {
  setViewMode(state.viewMode === "organize" ? "continuous" : "organize");
});
panelInsertPdfButton?.addEventListener("click", () => openInsertPicker(insertPosition.value));
panelAddBlankButton?.addEventListener("click", () => addBlankPage(insertPosition.value));
organizeRotateLeft?.addEventListener("click", () => applyRotation(-90, selectedPositions()));
organizeRotateRight?.addEventListener("click", () => applyRotation(90, selectedPositions()));
organizeDuplicate?.addEventListener("click", duplicateSelectedPages);
organizeDelete?.addEventListener("click", deleteSelectedPages);
organizeAddBlank?.addEventListener("click", () => addBlankPage(insertPosition.value));
organizeInsertPdf?.addEventListener("click", () => openInsertPicker(insertPosition.value));
mergeAddButton?.addEventListener("click", () => openInsertPicker(mergePosition.value));
mergeOrganizeButton?.addEventListener("click", () => { setViewMode("organize"); activateTool("organize"); });
[splitMode, splitRanges, splitNumber, splitCuts, splitSize, splitPattern].forEach((control) => {
  control?.addEventListener(control instanceof HTMLSelectElement ? "change" : "input", updateSplitPlan);
});
detectBlankButton?.addEventListener("click", detectBlankPages);
splitSaveButton?.addEventListener("click", saveSplitResults);
canvasStage?.addEventListener("pointerdown", handlePagePanStart);
canvasStage?.addEventListener("pointermove", handlePagePanMove);
canvasStage?.addEventListener("pointerup", handlePagePanEnd);
canvasStage?.addEventListener("pointercancel", handlePagePanEnd);
continuousStage?.addEventListener("pointerdown", handleContinuousPanStart);
continuousStage?.addEventListener("pointermove", handleContinuousPanMove);
continuousStage?.addEventListener("pointerup", handleContinuousPanEnd);
continuousStage?.addEventListener("pointercancel", handleContinuousPanEnd);
organizeStage?.addEventListener("pointermove", moveOrganizeCardPointer);
organizeStage?.addEventListener("pointerup", (event) => finishOrganizeCardPointer(event, false));
organizeStage?.addEventListener("pointercancel", (event) => finishOrganizeCardPointer(event, true));
organizeGrid?.addEventListener("pointerdown", beginOrganizeMarquee);
organizeGrid?.addEventListener("pointermove", moveOrganizeMarquee);
organizeGrid?.addEventListener("pointerup", (event) => finishOrganizeMarquee(event, false));
organizeGrid?.addEventListener("pointercancel", (event) => finishOrganizeMarquee(event, true));
continuousStage?.addEventListener("wheel", (event) => {
  if (!state.file || state.viewMode !== "continuous" || !event.ctrlKey) return;
  event.preventDefault();
  const current = state.zoomMode === "custom" ? state.zoom : parseInt(zoomValue.textContent, 10) / 100;
  setCustomZoom(current + (event.deltaY < 0 ? 0.12 : -0.12));
}, { passive: false });
continuousStage?.addEventListener("dblclick", (event) => {
  if (!state.file || event.target.closest?.(".viewer-continuous-label")) return;
  if (state.zoomMode === "fit-page") setCustomZoom(1.35);
  else {
    state.zoomMode = "fit-page";
    refreshReadingView();
    updateControls();
  }
});
canvasStage?.addEventListener("dblclick", () => {
  if (!state.file) return;
  if (state.zoomMode === "fit-page") setCustomZoom(1.35);
  else { state.zoomMode = "fit-page"; renderCurrentPage(); updateControls(); }
});
canvasStage?.addEventListener("wheel", (event) => {
  if (!state.file || state.viewMode !== "page") return;
  if (event.ctrlKey) {
    event.preventDefault();
    const current = state.zoomMode === "custom" ? state.zoom : parseInt(zoomValue.textContent, 10) / 100;
    setCustomZoom(current + (event.deltaY < 0 ? 0.12 : -0.12));
    return;
  }
  const now = Date.now();
  if (now - state.wheelTimestamp < 260) return;
  const atBottom = canvasStage.scrollTop + canvasStage.clientHeight >= canvasStage.scrollHeight - 3;
  const atTop = canvasStage.scrollTop <= 3;
  const noVerticalScroll = canvasStage.scrollHeight <= canvasStage.clientHeight + 3;
  if ((event.deltaY > 0 && (atBottom || noVerticalScroll)) || (event.deltaY < 0 && (atTop || noVerticalScroll))) {
    event.preventDefault();
    state.wheelTimestamp = now;
    goToPage(state.currentPage + (event.deltaY > 0 ? 1 : -1));
  }
}, { passive: false });

window.addEventListener("resize", () => {
  if (!viewerView.hidden && state.file) {
    window.clearTimeout(window.__pdfPrivadoViewerResizeTimer);
    window.__pdfPrivadoViewerResizeTimer = window.setTimeout(() => {
      if (state.viewMode === "page" && (state.zoomMode === "fit-width" || state.zoomMode === "fit-page")) renderCurrentPage();
      if (state.viewMode === "continuous") buildContinuousList();
    }, 160);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === "o") {
    event.preventDefault();
    showWorkspace(false);
    openFilePicker();
    return;
  }
  if (viewerView.hidden || !state.file) return;
  const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if (event.ctrlKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveCopy();
  } else if (event.ctrlKey && event.key.toLowerCase() === "z" && !event.shiftKey) {
    event.preventDefault();
    undoDocumentChange();
  } else if ((event.ctrlKey && event.key.toLowerCase() === "y") || (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z")) {
    event.preventDefault();
    redoDocumentChange();
  } else if (event.ctrlKey && (event.key === "+" || event.key === "=")) {
    event.preventDefault();
    const current = state.zoomMode === "custom" ? state.zoom : parseInt(zoomValue.textContent, 10) / 100;
    setCustomZoom(current + 0.15);
  } else if (event.ctrlKey && event.key === "-") {
    event.preventDefault();
    const current = state.zoomMode === "custom" ? state.zoom : parseInt(zoomValue.textContent, 10) / 100;
    setCustomZoom(current - 0.15);
  } else if (event.ctrlKey && event.key === "0") {
    event.preventDefault();
    state.zoomMode = "fit-page";
    setViewMode("continuous");
  } else if (!editing && (event.key === "ArrowRight" || event.key === "PageDown")) {
    event.preventDefault();
    goToPage(state.currentPage + 1);
  } else if (!editing && (event.key === "ArrowLeft" || event.key === "PageUp")) {
    event.preventDefault();
    goToPage(state.currentPage - 1);
  } else if (!editing && event.key === "Home") {
    event.preventDefault();
    goToPage(1);
  } else if (!editing && event.key === "End") {
    event.preventDefault();
    goToPage(state.pageCount);
  } else if (!editing && event.key === "Escape") {
    activateTool("overview");
  }
});

updateScopeControls();
activateTool("overview");
setViewMode("continuous", false);
updateControls();
updateSplitPlan();
initializeNativeOpenHandling();
