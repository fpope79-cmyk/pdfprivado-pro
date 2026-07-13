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
import {
  buildSearchSnippet,
  findSearchMatches,
  foldSearchText,
  locateSearchItemRanges,
  normalizeExtractedText,
  textItemsToString,
} from "./search-core.js";
import { RenderScheduler } from "./render-scheduler.js";
import {
  OCR_LANGUAGES,
  resolveOcrLanguage,
  resolveOcrLanguageSelection,
  summarizeOcrLanguageCatalog,
} from "./ocr-languages.js";
import {
  OCR_RENDER_LIMITS,
  buildOcrRecord,
  locateOcrWordRanges,
  renderPageForOcr,
} from "./ocr-core.js";
import {
  cancelOcrEngine,
  destroyOcrEngine,
  isOcrCancelledError,
  recognizeOcrImage,
} from "./ocr-worker.js";
import {
  cancelExternalOcrRuntime,
  isExternalOcrCancelledError,
  recognizeExternalOcrImage,
} from "./ocr-external-runtime.js";
import {
  formatOcrPackageSize,
  inspectOcrLanguagePackage,
  ocrLanguagePackageFileName,
} from "./ocr-language-package.js";
import {
  createIndexedDbOcrLanguageDriver,
  createOcrLanguageStorage,
} from "./ocr-language-storage.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.mjs",
  import.meta.url
).href;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function diagnostics() {
  return window.PDFPrivadoDiagnostics;
}

function diagEmit(type, details = {}) {
  diagnostics()?.emit?.(type, details);
}

function diagStart(name, details = {}) {
  return diagnostics()?.start?.(name, details) || null;
}

function diagEnd(token, details = {}, status = "ok") {
  if (token) diagnostics()?.end?.(token, details, status);
}

function diagFail(token, error, details = {}) {
  if (token) diagnostics()?.fail?.(token, error, details);
  else if (error?.name !== "RenderingCancelledException") diagnostics()?.error?.(error, "visor", details);
}

function diagnosticContext() {
  diagnostics()?.context?.({
    documentOpen: Boolean(state.file && state.pageCount),
    fileSizeBytes: Number(state.file?.size) || null,
    pages: state.pageCount,
    currentPage: state.currentPage,
    selectedPages: state.selectedIds.size,
    sourceDocuments: sourceCountInPlan(),
    viewMode: state.viewMode,
    activeTool: state.activeTool,
    zoomMode: state.zoomMode,
    zoomPercent: state.zoomMode === "custom" ? Math.round(state.zoom * 100) : Number.parseInt(zoomValue?.textContent || "0", 10) || null,
    pendingThumbnailTasks: state.thumbnailTasks.size,
    pendingContinuousTasks: state.continuousTasks.size,
    pendingOrganizeTasks: state.organizeTasks.size,
    queuedRenderTasks: renderScheduler.snapshot().queued,
    activeRenderTasks: renderScheduler.snapshot().active,
    searchRunning: Boolean(state.search?.running),
    searchCachedPages: state.search?.cache?.size || 0,
    searchStoredResults: state.search?.results?.length || 0,
    searchMatchesFound: state.search?.totalMatches || 0,
    ocrRunning: Boolean(state.ocr?.running),
    ocrRecognizedPages: state.ocr?.records?.size || 0,
  });
}

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
const toggleThumbnailsButton = $("#viewer-toggle-thumbnails-button");
const toggleToolsButton = $("#viewer-toggle-tools-button");
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
const spreadStage = $("#viewer-spread-stage");
const spreadPages = $("#viewer-spread-pages");
const spreadLeft = $("#viewer-spread-left");
const spreadRight = $("#viewer-spread-right");
const spreadLeftCanvas = $("#viewer-spread-left-canvas");
const spreadRightCanvas = $("#viewer-spread-right-canvas");
const spreadLeftLabel = $("#viewer-spread-left-label");
const spreadRightLabel = $("#viewer-spread-right-label");
const modeContinuousButton = $("#viewer-mode-continuous-button");
const modePageButton = $("#viewer-mode-page-button");
const modeSpreadButton = $("#viewer-mode-spread-button");
const spreadCoverButton = $("#viewer-spread-cover-button");
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
const toolsHeadingTitle = $("#viewer-tools-heading-title");
const toolPanels = $$("[data-viewer-tool-panel]");
const toolLinks = $$("[data-activate-tool]");
const appMenuBar = $("#app-menu-bar");
const appMenus = $$('[data-app-menu]');
const appMenuDocument = $("#app-menu-document");
const appMenuCommands = $$('[data-app-command]');
const appMenuTools = $$('[data-app-tool]');
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
const searchForm = $("#viewer-search-form");
const searchInput = $("#viewer-search-input");
const searchButton = $("#viewer-search-button");
const searchClearButton = $("#viewer-search-clear");
const searchPreviousButton = $("#viewer-search-previous");
const searchNextButton = $("#viewer-search-next");
const searchCounter = $("#viewer-search-counter");
const searchProgressWrap = $("#viewer-search-progress-wrap");
const searchProgress = $("#viewer-search-progress");
const searchProgressValue = $("#viewer-search-progress-value");
const searchCancelButton = $("#viewer-search-cancel");
const searchStatus = $("#viewer-search-status");
const searchWarning = $("#viewer-search-warning");
const searchWarningText = $("#viewer-search-warning-text");
const searchResultSummary = $("#viewer-search-result-summary");
const searchResults = $("#viewer-search-results");
const ocrLanguage = $("#viewer-ocr-language");
const ocrLanguageSecondary = $("#viewer-ocr-language-secondary");
const ocrScope = $("#viewer-ocr-scope");
const ocrReprocess = $("#viewer-ocr-reprocess");
const ocrLanguageAvailability = $("#viewer-ocr-language-availability");
const ocrLanguageAdminSummary = $("#viewer-ocr-language-admin-summary");
const ocrLanguageInstalledList = $("#viewer-ocr-language-installed-list");
const ocrLanguageAvailableList = $("#viewer-ocr-language-available-list");
const ocrLanguageImportPreviewButton = $("#viewer-ocr-language-import-preview");
const ocrLanguagePackagePreview = $("#viewer-ocr-language-package-preview");
const ocrLanguagePackageTitle = $("#viewer-ocr-language-package-title");
const ocrLanguagePackageCode = $("#viewer-ocr-language-package-code");
const ocrLanguagePackageFile = $("#viewer-ocr-language-package-file");
const ocrLanguagePackageSize = $("#viewer-ocr-language-package-size");
const ocrLanguagePackageHash = $("#viewer-ocr-language-package-hash");
const ocrLanguagePackageMessage = $("#viewer-ocr-language-package-message");
const ocrLanguageRuntimeText = $("#viewer-ocr-language-runtime-text");
const ocrLanguageInstallButton = $("#viewer-ocr-language-install");
const ocrPageLabel = $("#viewer-ocr-page-label");
const ocrPagePreviousButton = $("#viewer-ocr-page-previous");
const ocrPageNumberInput = $("#viewer-ocr-page-number");
const ocrPageTotal = $("#viewer-ocr-page-total");
const ocrPageNextButton = $("#viewer-ocr-page-next");
const ocrUseVisibleButton = $("#viewer-ocr-use-visible");
const ocrStartButton = $("#viewer-ocr-start");
const ocrCancelButton = $("#viewer-ocr-cancel");
const ocrClearButton = $("#viewer-ocr-clear");
const ocrProgressWrap = $("#viewer-ocr-progress-wrap");
const ocrProgress = $("#viewer-ocr-progress");
const ocrProgressValue = $("#viewer-ocr-progress-value");
const ocrStatus = $("#viewer-ocr-status");
const ocrSummary = $("#viewer-ocr-summary");
const ocrPreview = $("#viewer-ocr-preview");

const A4 = { width: 595.28, height: 841.89 };
const ORGANIZE_VIRTUALIZATION_VERSION = "organize-virtual-v1";
const MAX_STORED_SEARCH_RESULTS = 1200;

const ocrLanguagePackages = {
  storage: null,
  installed: [],
  pending: null,
  busy: false,
  runtimeCode: "",
};

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
  spreadCoverAlone: true,
  spreadRenderSerial: 0,
  spreadTasks: new Map(),
  zoom: 1,
  renderTask: null,
  renderSerial: 0,
  thumbObserver: null,
  organizeObserver: null,
  continuousObserver: null,
  readingVisibleNodes: new Set(),
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
  thumbnailBuildSerial: 0,
  continuousBuildSerial: 0,
  virtualThreshold: 2000,
  thumbnailVirtual: null,
  continuousVirtual: null,
  organizeVirtual: null,
  readingNavigation: {
    targetPage: 0,
    lockUntil: 0,
    syncFrame: 0,
    settleTimer: 0,
    serial: 0,
    attempts: 0,
  },
  search: {
    cache: new Map(),
    results: [],
    query: "",
    foldedQuery: "",
    currentIndex: -1,
    serial: 0,
    running: false,
    processedPages: 0,
    pagesWithoutText: 0,
    failedPages: 0,
    totalMatches: 0,
    truncated: false,
    refreshTimer: 0,
    highlightSerial: 0,
    navigationLockUntil: 0,
    navigationSerial: 0,
    positioning: false,
    targetPage: 0,
    fitApplied: false,
  },
  ocr: {
    records: new Map(),
    running: false,
    serial: 0,
    renderTask: null,
    activeEntryId: "",
    panelKey: "",
    targetPage: 0,
    batchScope: "current",
    batchReprocess: false,
    batchTotal: 0,
    batchProcessed: 0,
    batchSucceeded: 0,
    batchSkipped: 0,
    batchFailed: 0,
    batchStartedAt: 0,
  },
};

let schedulerDiagnosticTimer = 0;
function refreshSchedulerDiagnostics() {
  if (schedulerDiagnosticTimer) return;
  schedulerDiagnosticTimer = window.setTimeout(() => {
    schedulerDiagnosticTimer = 0;
    diagnosticContext();
  }, 100);
}

const renderScheduler = new RenderScheduler({
  maxConcurrent: 3,
  channelLimits: { thumbnail: 1, continuous: 2, organize: 2 },
  onChange: refreshSchedulerDiagnostics,
});

const VIEWER_LAYOUT_STORAGE_KEY = "pdfprivado-viewer-layout-v1";

function readViewerLayoutPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEWER_LAYOUT_STORAGE_KEY) || "{}");
    return {
      thumbnailsCollapsed: Boolean(saved.thumbnailsCollapsed),
      toolsCollapsed: Boolean(saved.toolsCollapsed),
      spreadCoverAlone: saved.spreadCoverAlone !== false,
      readingMode: ["continuous", "page", "spread"].includes(saved.readingMode) ? saved.readingMode : "continuous",
    };
  } catch {
    return {
      thumbnailsCollapsed: false,
      toolsCollapsed: false,
      spreadCoverAlone: true,
      readingMode: "continuous",
    };
  }
}

const savedViewerLayout = readViewerLayoutPreferences();
const viewerLayoutState = {
  manualThumbnailsCollapsed: savedViewerLayout.thumbnailsCollapsed,
  manualToolsCollapsed: savedViewerLayout.toolsCollapsed,
  compact: false,
  veryCompact: false,
  compactThumbnailsOverride: null,
  compactToolsOverride: null,
  contextualToolsOverride: null,
  organizeThumbnailsOverride: null,
  organizeToolsOverride: null,
  organizeReturnTool: "overview",
  readingModeBeforeOrganize: savedViewerLayout.readingMode,
  lastReadingMode: savedViewerLayout.readingMode,
};

state.spreadCoverAlone = savedViewerLayout.spreadCoverAlone;

function persistViewerLayoutPreferences() {
  try {
    localStorage.setItem(VIEWER_LAYOUT_STORAGE_KEY, JSON.stringify({
      thumbnailsCollapsed: viewerLayoutState.manualThumbnailsCollapsed,
      toolsCollapsed: viewerLayoutState.manualToolsCollapsed,
      spreadCoverAlone: state.spreadCoverAlone,
      readingMode: viewerLayoutState.lastReadingMode,
    }));
  } catch {
    // La preferencia visual no debe bloquear el visor.
  }
}

function effectivePanelCollapsed(panel) {
  if (panel === "thumbnails") {
    if (state.viewMode === "organize") {
      return viewerLayoutState.organizeThumbnailsOverride ?? true;
    }
    if (viewerLayoutState.veryCompact) {
      return viewerLayoutState.compactThumbnailsOverride ?? true;
    }
    return viewerLayoutState.manualThumbnailsCollapsed;
  }

  if (state.viewMode === "organize") {
    return viewerLayoutState.organizeToolsOverride ?? true;
  }

  if (state.file) {
    const defaultCollapsed = state.activeTool === "overview";
    return viewerLayoutState.contextualToolsOverride ?? defaultCollapsed;
  }

  if (viewerLayoutState.compact) {
    return viewerLayoutState.compactToolsOverride ?? true;
  }
  return viewerLayoutState.manualToolsCollapsed;
}

function applyViewerPanelLayout() {
  const thumbnailsCollapsed = effectivePanelCollapsed("thumbnails");
  const toolsCollapsed = effectivePanelCollapsed("tools");
  document.body.classList.toggle("viewer-thumbnails-collapsed", thumbnailsCollapsed);
  document.body.classList.toggle("viewer-tools-collapsed", toolsCollapsed);
  document.body.classList.toggle("viewer-compact-layout", viewerLayoutState.compact);
  document.body.classList.toggle("viewer-page-active", state.viewMode === "page");
  document.body.classList.toggle("viewer-spread-active", state.viewMode === "spread");
  document.body.classList.toggle("viewer-spread-cover-alone", state.viewMode === "spread" && state.spreadCoverAlone);
  document.body.classList.toggle("viewer-custom-zoom", state.zoomMode === "custom");
  document.body.classList.toggle(
    "viewer-reading-clean",
    Boolean(state.file) && ["continuous", "page", "spread"].includes(state.viewMode) && state.activeTool === "overview"
  );
  document.body.dataset.viewerActiveTool = state.activeTool || "overview";

  if (toggleThumbnailsButton) {
    toggleThumbnailsButton.textContent = thumbnailsCollapsed ? "›" : "‹";
    toggleThumbnailsButton.title = thumbnailsCollapsed ? "Mostrar miniaturas" : "Ocultar miniaturas";
    toggleThumbnailsButton.setAttribute("aria-label", toggleThumbnailsButton.title);
    toggleThumbnailsButton.setAttribute("aria-expanded", String(!thumbnailsCollapsed));
  }
  if (toggleToolsButton) {
    toggleToolsButton.textContent = toolsCollapsed ? "‹" : "›";
    toggleToolsButton.title = toolsCollapsed ? "Mostrar herramientas" : "Ocultar herramientas";
    toggleToolsButton.setAttribute("aria-label", toggleToolsButton.title);
    toggleToolsButton.setAttribute("aria-expanded", String(!toolsCollapsed));
  }
}

function updateResponsiveViewerLayout() {
  const compact = window.innerWidth < 1160;
  const veryCompact = window.innerWidth < 1000;
  if (compact !== viewerLayoutState.compact) {
    viewerLayoutState.compact = compact;
    viewerLayoutState.compactToolsOverride = null;
  }
  if (veryCompact !== viewerLayoutState.veryCompact) {
    viewerLayoutState.veryCompact = veryCompact;
    viewerLayoutState.compactThumbnailsOverride = null;
  }
  applyViewerPanelLayout();
}

function toggleViewerPanel(panel) {
  const collapsed = effectivePanelCollapsed(panel);
  if (panel === "thumbnails") {
    if (state.viewMode === "organize") {
      viewerLayoutState.organizeThumbnailsOverride = !collapsed;
    } else if (viewerLayoutState.veryCompact) {
      viewerLayoutState.compactThumbnailsOverride = !collapsed;
    } else {
      viewerLayoutState.manualThumbnailsCollapsed = !collapsed;
      persistViewerLayoutPreferences();
    }
  } else if (state.viewMode === "organize") {
    viewerLayoutState.organizeToolsOverride = !collapsed;
  } else if (state.file) {
    viewerLayoutState.contextualToolsOverride = !collapsed;
  } else if (viewerLayoutState.compact) {
    viewerLayoutState.compactToolsOverride = !collapsed;
  } else {
    viewerLayoutState.manualToolsCollapsed = !collapsed;
    persistViewerLayoutPreferences();
  }
  applyViewerPanelLayout();
  scheduleViewerLayoutRefresh(true);
}

function organizeSummaryLabel(selectedCount = state.selectedIds.size) {
  const pages = state.pageCount;
  const selected = Number(selectedCount) || 0;
  const pageLabel = pages === 1 ? "1 página" : `${pages} páginas`;
  const selectedLabel = selected === 1 ? "1 seleccionada" : `${selected} seleccionadas`;
  return `Organizar páginas · ${pageLabel} · ${selectedLabel}`;
}

function stylePixels(styles, property) {
  const raw = property.startsWith("--") ? styles?.getPropertyValue(property) : styles?.[property];
  return Math.max(0, Number.parseFloat(raw) || 0);
}

function continuousRenderBounds() {
  const stageStyles = getComputedStyle(continuousStage);
  const listStyles = getComputedStyle(continuousList);
  const samplePage = continuousList.querySelector(".viewer-continuous-page");
  const pageStyles = samplePage ? getComputedStyle(samplePage) : null;
  const fallbackHorizontalChrome = stylePixels(stageStyles, "--viewer-page-horizontal-chrome") || 28;
  const fallbackVerticalChrome = stylePixels(stageStyles, "--viewer-page-vertical-chrome") || 48;
  const listHorizontalPadding = stylePixels(listStyles, "paddingLeft") + stylePixels(listStyles, "paddingRight");
  const pageHorizontalChrome = pageStyles
    ? stylePixels(pageStyles, "paddingLeft") + stylePixels(pageStyles, "paddingRight") +
      stylePixels(pageStyles, "borderLeftWidth") + stylePixels(pageStyles, "borderRightWidth")
    : fallbackHorizontalChrome;
  const verticalChrome =
    stylePixels(listStyles, "paddingTop") +
    stylePixels(listStyles, "paddingBottom") +
    (pageStyles
      ? stylePixels(pageStyles, "paddingTop") + stylePixels(pageStyles, "paddingBottom") +
        stylePixels(pageStyles, "borderTopWidth") + stylePixels(pageStyles, "borderBottomWidth")
      : fallbackVerticalChrome);
  const isSpread = state.viewMode === "spread";
  const gap = isSpread ? (stylePixels(listStyles, "columnGap") || stylePixels(listStyles, "gap") || 18) : 0;
  const columns = isSpread ? 2 : 1;
  const usableWidth = Math.max(180, continuousStage.clientWidth - listHorizontalPadding - gap - 4);
  return {
    width: Math.max(160, usableWidth / columns - pageHorizontalChrome),
    height: Math.max(220, continuousStage.clientHeight - verticalChrome - 4),
  };
}

function canvasRenderBounds() {
  const styles = getComputedStyle(canvasStage);
  return {
    width: Math.max(180, canvasStage.clientWidth - stylePixels(styles, "paddingLeft") - stylePixels(styles, "paddingRight") - 2),
    height: Math.max(220, canvasStage.clientHeight - stylePixels(styles, "paddingTop") - stylePixels(styles, "paddingBottom") - 2),
  };
}

function spreadPairForPage(pageNumber = state.currentPage) {
  const page = Math.max(1, Math.min(state.pageCount || 1, Number(pageNumber) || 1));
  if (state.spreadCoverAlone && page === 1) return [1, null];

  let left;
  if (state.spreadCoverAlone) left = page % 2 === 0 ? page : page - 1;
  else left = page % 2 === 1 ? page : page - 1;

  left = Math.max(1, left);
  return [left, left + 1 <= state.pageCount ? left + 1 : null];
}

function readingNavigationTarget(direction) {
  const step = direction < 0 ? -1 : 1;
  if (state.viewMode !== "spread") return state.currentPage + step;
  const [left, right] = spreadPairForPage();
  if (step > 0) return Math.min(state.pageCount, (right || left) + 1);
  return Math.max(1, left - 1);
}

function spreadRenderBounds(pageCount = 2) {
  const styles = getComputedStyle(spreadStage);
  const pagesStyles = getComputedStyle(spreadPages);
  const horizontalPadding =
    stylePixels(styles, "paddingLeft") +
    stylePixels(styles, "paddingRight") +
    stylePixels(pagesStyles, "paddingLeft") +
    stylePixels(pagesStyles, "paddingRight");
  const verticalPadding =
    stylePixels(styles, "paddingTop") +
    stylePixels(styles, "paddingBottom") +
    stylePixels(pagesStyles, "paddingTop") +
    stylePixels(pagesStyles, "paddingBottom");
  const gap = pageCount > 1 ? stylePixels(pagesStyles, "columnGap") || stylePixels(pagesStyles, "gap") || 18 : 0;
  const pageHorizontalChrome = 30;
  const pageVerticalChrome = 46;
  return {
    width: Math.max(
      160,
      (spreadStage.clientWidth - horizontalPadding - gap - 8) / Math.max(1, pageCount) - pageHorizontalChrome
    ),
    height: Math.max(220, spreadStage.clientHeight - verticalPadding - pageVerticalChrome - 8),
  };
}

async function entryBaseDimensions(entry) {
  let width = entry?.width || A4.width;
  let height = entry?.height || A4.height;
  if (!entry) return { width, height };
  if (entry.kind === "pdf") {
    const page = await getPdfPage(entry);
    const rotation = normalizeRotation((page.rotate || 0) + (entry.rotation || 0));
    const viewport = page.getViewport({ scale: 1, rotation });
    width = viewport.width;
    height = viewport.height;
    page.cleanup();
  } else if (normalizeRotation(entry.rotation || 0) % 180 !== 0) {
    [width, height] = [height, width];
  }
  return { width, height };
}

function cancelSpreadRenderTasks() {
  state.spreadRenderSerial += 1;
  for (const holder of state.spreadTasks.values()) {
    try { holder.cancel?.(); } catch { /* cancelación defensiva */ }
  }
  state.spreadTasks.clear();
}

function setSpreadArticle(article, label, pageNumber) {
  const visible = Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= state.pageCount;
  article.hidden = !visible;
  article.dataset.page = visible ? String(pageNumber) : "";
  article.classList.toggle("is-current", visible && pageNumber === state.currentPage);
  label.textContent = visible ? `Página ${pageNumber}` : "";
}

async function renderSpread() {
  if (!state.file || !state.pageCount || state.viewMode !== "spread") return;
  cancelSpreadRenderTasks();
  const serial = state.spreadRenderSerial;
  const [leftPage, rightPage] = spreadPairForPage();
  const pages = [leftPage, rightPage].filter(Boolean);
  const single = pages.length === 1;

  spreadPages.classList.toggle("is-single", single);
  setSpreadArticle(spreadLeft, spreadLeftLabel, leftPage);
  setSpreadArticle(spreadRight, spreadRightLabel, rightPage);

  const entries = pages.map((page) => ({ page, entry: entryAt(page) })).filter((item) => item.entry);
  if (!entries.length) return;

  setLoading(
    true,
    single ? `Mostrando página ${entries[0].page}` : `Mostrando páginas ${entries[0].page}-${entries.at(-1).page}`,
    "Vista doble procesada localmente."
  );

  try {
    const dimensions = await Promise.all(
      entries.map(async (item) => ({ ...item, ...(await entryBaseDimensions(item.entry)) }))
    );
    if (serial !== state.spreadRenderSerial || state.viewMode !== "spread") return;

    const bounds = spreadRenderBounds(dimensions.length);
    let scale = state.zoom;
    if (state.zoomMode === "fit-width") {
      scale = Math.min(...dimensions.map((item) => bounds.width / item.width));
    } else if (state.zoomMode === "fit-page") {
      scale = Math.min(
        ...dimensions.map((item) => Math.min(bounds.width / item.width, bounds.height / item.height))
      );
    }
    scale = Math.max(0.1, Math.min(4, scale));

    const targets = [
      { page: leftPage, canvas: spreadLeftCanvas, side: "left" },
      { page: rightPage, canvas: spreadRightCanvas, side: "right" },
    ].filter((target) => target.page);

    await Promise.all(targets.map(async ({ page, canvas: targetCanvas, side }) => {
      const entry = entryAt(page);
      if (!entry) return;
      const diagnosticToken = diagStart("render-page", { page, mode: "spread" });
      const holder = createRenderTaskHolder();
      state.spreadTasks.set(side, holder);
      try {
        const result = await renderEntryToCanvas(entry, targetCanvas, {
          scale,
          maxWidth: Number.MAX_SAFE_INTEGER,
          maxHeight: Number.MAX_SAFE_INTEGER,
          outputScale: adaptiveOutputScale("page"),
          onTask: (task) => holder.setTask(task),
        });
        if (serial !== state.spreadRenderSerial || state.viewMode !== "spread") return;
        targetCanvas.style.width = `${Math.round(result.width * result.scale)}px`;
        targetCanvas.style.height = `${Math.round(result.height * result.scale)}px`;
        diagEnd(diagnosticToken, { width: targetCanvas.width, height: targetCanvas.height, mode: "spread" });
      } catch (error) {
        diagFail(diagnosticToken, error, { page, mode: "spread" });
        throw error;
      }
    }));

    if (serial !== state.spreadRenderSerial || state.viewMode !== "spread") return;
    zoomValue.textContent = `${Math.round(scale * 100)} %`;
    pageInput.value = String(state.currentPage);
    pageInfo.textContent = single
      ? `Página ${pages[0]} · vista de una página dentro del modo doble`
      : `Páginas ${pages[0]}-${pages.at(-1)} · vista doble`;
    setLoading(false);
    centerReadingStageHorizontal();
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") {
      diagFail(null, error, { mode: "spread", page: state.currentPage });
      setLoading(true, "No se pudo mostrar la vista doble", String(error?.message || error));
    }
  } finally {
    if (serial === state.spreadRenderSerial) state.spreadTasks.clear();
    diagnosticContext();
  }
}

let centerReadingFrame = 0;
function centerReadingStageHorizontal(force = false) {
  if (!force && state.zoomMode === "custom") return;
  window.cancelAnimationFrame(centerReadingFrame);
  centerReadingFrame = window.requestAnimationFrame(() => {
    const stage =
      state.viewMode === "page"
        ? canvasStage
        : state.viewMode === "spread"
          ? spreadStage
          : continuousStage;
    if (!stage || stage.hidden) return;
    const left = Math.max(0, Math.round((stage.scrollWidth - stage.clientWidth) / 2));
    stage.scrollLeft = left;
  });
}

let viewerLayoutRefreshTimer = 0;
function scheduleViewerLayoutRefresh(immediate = false) {
  window.clearTimeout(viewerLayoutRefreshTimer);
  const refresh = () => {
    viewerLayoutRefreshTimer = 0;
    if (viewerView.hidden || !state.file) return;
    const currentPage = state.currentPage;
    if (state.viewMode === "organize") {
      if (state.organizeVirtual) renderVirtualOrganizeWindow(currentPage);
      return;
    }
    if (state.zoomMode === "custom") return;
    if (state.viewMode === "page") {
      renderCurrentPage();
      return;
    }
    if (state.viewMode === "spread") {
      buildContinuousList();
      requestAnimationFrame(() => {
        beginReadingNavigation(currentPage, "auto");
        scrollReadingPageIntoView(currentPage, { behavior: "auto", block: "start" });
        centerReadingStageHorizontal(true);
      });
      return;
    }
    buildContinuousList();
    requestAnimationFrame(() => {
      beginReadingNavigation(currentPage, "auto");
      scrollReadingPageIntoView(currentPage, { behavior: "auto", block: "start" });
      centerReadingStageHorizontal(true);
    });
  };
  if (immediate) refresh();
  else viewerLayoutRefreshTimer = window.setTimeout(refresh, 180);
}

const canvasRenderSlots = new WeakMap();

function createRenderingCancelledError() {
  const error = new Error("El renderizado anterior fue sustituido por una solicitud más reciente.");
  error.name = "RenderingCancelledException";
  return error;
}

function createRenderTaskHolder() {
  return {
    task: null,
    cancelled: false,
    setTask(task) {
      this.task = task;
      if (this.cancelled) {
        try { task.cancel?.(); } catch { /* la tarea puede haber finalizado */ }
      }
    },
    cancel() {
      this.cancelled = true;
      try { this.task?.cancel?.(); } catch { /* la tarea puede haber finalizado */ }
    },
  };
}

async function confirmDiscardChanges(message) {
  const dialog = window.__TAURI__?.dialog;
  if (typeof dialog?.message === "function") {
    try {
      const result = await dialog.message(message, {
        title: "PDFPrivado Pro",
        kind: "warning",
        buttons: { ok: "Descartar cambios", cancel: "Cancelar" },
      });
      return result === "Descartar cambios" || result === "Ok";
    } catch (error) {
      diagnostics()?.error?.(error, "confirmar-cambios-pendientes");
    }
  }

  const fallback = document.createElement("dialog");
  fallback.className = "viewer-confirm-fallback";
  fallback.innerHTML = `
    <form method="dialog">
      <h2>Cambios sin guardar</h2>
      <p></p>
      <div>
        <button type="submit" value="cancel" class="secondary-button">Cancelar</button>
        <button type="submit" value="discard" class="primary-button">Descartar cambios</button>
      </div>
    </form>
  `;
  fallback.querySelector("p").textContent = message;
  document.body.append(fallback);
  return new Promise((resolve) => {
    fallback.addEventListener("close", () => {
      const confirmed = fallback.returnValue === "discard";
      fallback.remove();
      resolve(confirmed);
    }, { once: true });
    fallback.showModal();
  });
}

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

function ocrRecordKey(entry) {
  if (!entry || entry.kind !== "pdf") return "";
  return `ocr:${entry.id}:r${normalizeRotation(entry.rotation || 0)}`;
}

function currentOcrRecord(entry = ocrTargetEntry()) {
  const key = ocrRecordKey(entry);
  return key ? state.ocr.records.get(key) || null : null;
}

function searchCacheKey(entry) {
  if (!entry) return "";
  if (entry.kind === "blank") return `blank:${entry.id}`;
  return `pdf:${entry.id}:${entry.sourceId}:${entry.sourcePage}:r${normalizeRotation(entry.rotation || 0)}`;
}

function setSearchStatus(message, kind = "info") {
  if (!searchStatus) return;
  searchStatus.textContent = message;
  searchStatus.dataset.kind = kind;
}

function setSearchProgress(visible, percent = 0) {
  if (!searchProgressWrap || !searchProgress || !searchProgressValue) return;
  const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  searchProgressWrap.hidden = !visible;
  searchProgress.value = value;
  searchProgress.textContent = `${value} %`;
  searchProgressValue.textContent = `${value} %`;
}

function searchNavigationLocked() {
  return Date.now() < state.search.navigationLockUntil;
}

function clearSearchHighlight() {
  state.search.highlightSerial += 1;
  document.querySelectorAll(".viewer-search-highlight-layer").forEach((node) => node.remove());
}

function activeSearchResult() {
  return state.search.currentIndex >= 0 ? state.search.results[state.search.currentIndex] || null : null;
}

function continuousRenderSignature(entry) {
  if (!entry) return "";
  return `${entry.id}:${normalizeRotation(entry.rotation || 0)}:${state.zoomMode}:${state.zoom}:${continuousStage.clientWidth}:${continuousStage.clientHeight}`;
}

function pageRenderSignature(entry) {
  if (!entry) return "";
  return `${entry.id}:${normalizeRotation(entry.rotation || 0)}:${state.zoomMode}:${state.zoom}:${canvasStage.clientWidth}:${canvasStage.clientHeight}`;
}

function searchCanvasTarget(pageNumber) {
  const page = Number(pageNumber) || 0;
  if (!page) return null;
  const entry = entryAt(page);
  if (!entry) return null;

  if (state.viewMode === "page") {
    if (state.currentPage !== page || canvas.width <= 1) return null;
    if (canvas.dataset.renderedSignature !== pageRenderSignature(entry)) return null;
    return { host: canvasStage, canvas };
  }

  if (["continuous", "spread"].includes(state.viewMode)) {
    const item = continuousList.querySelector(`.viewer-continuous-page[data-page="${page}"]`);
    const target = item?.querySelector("canvas");
    if (!item || !target || target.width <= 1) return null;
    if (target.dataset.renderedSignature !== continuousRenderSignature(entry)) return null;
    return { host: item, canvas: target };
  }

  return null;
}

function waitForAnimationFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(resolve));
}

async function waitForSearchCanvas(pageNumber, serial) {
  const entry = entryAt(pageNumber);
  if (["continuous", "spread"].includes(state.viewMode) && entry) {
    scheduleContinuousPage(entry.id, 100000);
  }
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (serial !== state.search.highlightSerial) return null;
    const target = searchCanvasTarget(pageNumber);
    if (target && target.canvas.clientWidth > 2 && target.canvas.clientHeight > 2) return target;
    if (attempt % 18 === 0 && ["continuous", "spread"].includes(state.viewMode) && entry) {
      scheduleContinuousPage(entry.id, 100000 - attempt);
    }
    await waitForAnimationFrame();
  }
  return null;
}

let searchMeasurementContext = null;

function measuredSearchRatios(value, range, style, fontHeight) {
  const text = String(value || "");
  const characters = Math.max(1, text.length);
  const fallbackStart = Math.max(0, Math.min(1, range.startChar / characters));
  const fallbackEnd = Math.max(fallbackStart, Math.min(1, range.endChar / characters));
  try {
    if (!searchMeasurementContext) {
      searchMeasurementContext = document.createElement("canvas").getContext("2d");
    }
    if (!searchMeasurementContext || !text) {
      return { start: fallbackStart, end: fallbackEnd };
    }
    const family = String(style?.fontFamily || "sans-serif");
    searchMeasurementContext.font = `${Math.max(1, fontHeight)}px ${family}`;
    const total = searchMeasurementContext.measureText(text).width;
    if (!Number.isFinite(total) || total <= 0) {
      return { start: fallbackStart, end: fallbackEnd };
    }
    const prefix = searchMeasurementContext.measureText(text.slice(0, range.startChar)).width;
    const through = searchMeasurementContext.measureText(text.slice(0, range.endChar)).width;
    return {
      start: Math.max(0, Math.min(1, prefix / total)),
      end: Math.max(0, Math.min(1, through / total)),
    };
  } catch {
    return { start: fallbackStart, end: fallbackEnd };
  }
}

function searchTextGeometry(item, style, viewport, range) {
  const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
  let angle = Math.atan2(transform[1], transform[0]);
  if (style?.vertical) angle += Math.PI / 2;

  const fontHeight = Math.max(1, Math.hypot(transform[2], transform[3]));
  let fontAscent = fontHeight;
  if (Number.isFinite(style?.ascent)) fontAscent = style.ascent * fontHeight;
  else if (Number.isFinite(style?.descent)) fontAscent = (1 + style.descent) * fontHeight;

  let left;
  let top;
  if (Math.abs(angle) < 0.0001) {
    left = transform[4];
    top = transform[5] - fontAscent;
  } else {
    left = transform[4] + fontAscent * Math.sin(angle);
    top = transform[5] - fontAscent * Math.cos(angle);
  }

  const value = String(item?.str ?? "");
  const ratios = measuredSearchRatios(value, range, style, fontHeight);
  let fullWidth = Math.abs((style?.vertical ? item.height : item.width) || 0) * viewport.scale;
  if (!Number.isFinite(fullWidth) || fullWidth < 1) {
    fullWidth = fontHeight * Math.max(1, value.length * 0.52);
  }
  const offset = fullWidth * ratios.start;
  const segmentWidth = fullWidth * Math.max(0.02, ratios.end - ratios.start);
  const padding = Math.min(fontHeight * 0.045, Math.max(0.6, segmentWidth * 0.025));

  left += Math.cos(angle) * Math.max(0, offset - padding);
  top += Math.sin(angle) * Math.max(0, offset - padding);

  return {
    left,
    top,
    width: Math.max(3, segmentWidth + padding * 2),
    height: Math.max(3, fontHeight),
    angle,
  };
}


function searchRowPage(pageNumber) {
  const page = Math.max(1, Math.min(state.pageCount || 1, Number(pageNumber) || 1));
  if (state.viewMode !== "spread") return page;
  return spreadRowStartIndex(page - 1) + 1;
}

function searchPageNode(pageNumber) {
  return continuousList?.querySelector?.(`.viewer-continuous-page[data-page="${pageNumber}"]`) || null;
}

async function waitForSearchPageNode(pageNumber, serial) {
  for (let attempt = 0; attempt < 140; attempt += 1) {
    if (serial !== state.search.highlightSerial) return null;
    const node = searchPageNode(pageNumber);
    if (node) return node;
    await waitForAnimationFrame();
  }
  return null;
}

async function positionSearchPage(pageNumber, serial) {
  if (!["continuous", "spread"].includes(state.viewMode)) return;
  const rowPage = searchRowPage(pageNumber);
  if (state.continuousVirtual) {
    scrollVirtualContinuousToPage(rowPage, false);
  }
  const node = await waitForSearchPageNode(pageNumber, serial);
  if (!node || serial !== state.search.highlightSerial) return;

  const stageRect = continuousStage.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  const rowTop = continuousStage.scrollTop + nodeRect.top - stageRect.top;
  const centeredTop = rowTop - Math.max(0, (continuousStage.clientHeight - nodeRect.height) / 2);
  continuousStage.scrollTo({
    top: Math.max(0, centeredTop),
    left: state.viewMode === "spread" ? 0 : continuousStage.scrollLeft,
    behavior: "auto",
  });
  if (state.viewMode === "spread") centerReadingStageHorizontal(true);
  await waitForAnimationFrame();
}

function activeSearchMarker(pageNumber = activeSearchResult()?.page) {
  const page = Number(pageNumber) || 0;
  if (!page) return null;
  return document.querySelector(
    `.viewer-search-highlight-layer[data-page="${page}"] .viewer-search-highlight`
  );
}

function keepSearchMarkerVisible(marker, { force = false } = {}) {
  if (!marker || !["continuous", "page", "spread"].includes(state.viewMode)) return;
  const stage = state.viewMode === "page" ? canvasStage : continuousStage;
  const stageRect = stage.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const margin = 24;
  const alreadyVisible =
    markerRect.top >= stageRect.top + margin &&
    markerRect.bottom <= stageRect.bottom - margin &&
    markerRect.left >= stageRect.left + 8 &&
    markerRect.right <= stageRect.right - 8;
  if (!force && alreadyVisible) return;

  const desiredTop =
    stage.scrollTop +
    markerRect.top -
    stageRect.top -
    Math.max(margin, (stage.clientHeight - markerRect.height) / 2);

  let desiredLeft = stage.scrollLeft;
  if (stage.scrollWidth > stage.clientWidth + 6) {
    desiredLeft =
      stage.scrollLeft +
      markerRect.left -
      stageRect.left -
      Math.max(12, (stage.clientWidth - markerRect.width) / 2);
  }

  stage.scrollTo({
    top: Math.max(0, desiredTop),
    left: Math.max(0, desiredLeft),
    behavior: "auto",
  });
}


function waitForSearchDelay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, milliseconds)));
}

async function stabilizeSearchResultPosition(result, expectedIndex, serial) {
  if (!result || !["continuous", "page", "spread"].includes(state.viewMode)) return;
  const passes = [0, 80, 220, 480, 850, 1350];

  for (const delay of passes) {
    if (delay) await waitForSearchDelay(delay);
    if (
      serial !== state.search.highlightSerial ||
      expectedIndex !== state.search.currentIndex ||
      activeSearchResult()?.page !== result.page
    ) return;

    const marker = activeSearchMarker(result.page);
    if (marker) {
      keepSearchMarkerVisible(marker, { force: state.zoomMode !== "fit-page" });
    }
  }
}


async function renderSearchHighlight(result, expectedIndex = state.search.currentIndex) {
  clearSearchHighlight();
  if (!result || !state.file || result.page !== state.currentPage) return;
  if (!["continuous", "page", "spread"].includes(state.viewMode)) return;

  const serial = state.search.highlightSerial;
  const target = await waitForSearchCanvas(result.page, serial);
  if (!target || serial !== state.search.highlightSerial || expectedIndex !== state.search.currentIndex) return;

  const entry = entryAt(result.page);
  if (!entry || entry.kind !== "pdf") return;

  const layer = document.createElement("div");
  layer.className = "viewer-search-highlight-layer";
  layer.dataset.page = String(result.page);
  Object.assign(layer.style, {
    left: `${target.canvas.offsetLeft}px`,
    top: `${target.canvas.offsetTop}px`,
    width: `${target.canvas.clientWidth}px`,
    height: `${target.canvas.clientHeight}px`,
  });

  let page = null;
  try {
    if (result.source === "ocr") {
      const record = state.ocr.records.get(result.ocrKey || ocrRecordKey(entry));
      if (!record) return;
      const ranges = locateOcrWordRanges(record, result.start, state.search.query.length);
      const scaleX = target.canvas.clientWidth / Math.max(1, record.imageWidth);
      const scaleY = target.canvas.clientHeight / Math.max(1, record.imageHeight);

      for (const range of ranges) {
        const bbox = range.word.bbox;
        const wordWidth = Math.max(1, bbox.x1 - bbox.x0);
        const left = (bbox.x0 + wordWidth * range.startRatio) * scaleX;
        const width = Math.max(3, wordWidth * Math.max(0.03, range.endRatio - range.startRatio) * scaleX);
        const marker = document.createElement("span");
        marker.className = "viewer-search-highlight is-ocr";
        Object.assign(marker.style, {
          left: `${left}px`,
          top: `${bbox.y0 * scaleY}px`,
          width: `${width}px`,
          height: `${Math.max(3, (bbox.y1 - bbox.y0) * scaleY)}px`,
        });
        layer.append(marker);
      }
    } else {
      page = await getPdfPage(entry);
      const content = await page.getTextContent();
      if (serial !== state.search.highlightSerial || expectedIndex !== state.search.currentIndex) return;

      const located = locateSearchItemRanges(content?.items || [], result.start, state.search.query.length);
      if (!located.ranges.length) return;

      const rotation = normalizeRotation((page.rotate || 0) + (entry.rotation || 0));
      const base = page.getViewport({ scale: 1, rotation });
      const cssScale = Math.max(0.01, target.canvas.getBoundingClientRect().width / Math.max(1, base.width));
      const viewport = page.getViewport({ scale: cssScale, rotation });

      for (const range of located.ranges) {
        const item = content.items?.[range.itemIndex];
        if (!item?.transform) continue;
        const geometry = searchTextGeometry(item, content.styles?.[item.fontName], viewport, range);
        const marker = document.createElement("span");
        marker.className = "viewer-search-highlight";
        Object.assign(marker.style, {
          left: `${geometry.left}px`,
          top: `${geometry.top}px`,
          width: `${geometry.width}px`,
          height: `${geometry.height}px`,
          transform: `rotate(${geometry.angle}rad)`,
        });
        layer.append(marker);
      }
    }

    if (!layer.childElementCount) return null;
    target.host.append(layer);
    await waitForAnimationFrame();
    const marker = layer.querySelector(".viewer-search-highlight");
    keepSearchMarkerVisible(marker, { force: state.zoomMode !== "fit-page" });
    state.currentPage = result.page;
    pageInput.value = String(result.page);
    updateCurrentVisuals();
    updateControls();
    target.host.classList.add("has-search-highlight");
    window.setTimeout(() => target.host.classList.remove("has-search-highlight"), 900);
    diagEmit("search-highlight-shown", { page: result.page, mode: state.viewMode, source: result.source || "original" });
    return { marker, serial };
  } catch (error) {
    diagFail(null, error, { operation: "search-highlight", page: result.page, source: result.source || "original" });
  } finally {
    try { page?.cleanup?.(); } catch { /* limpieza defensiva */ }
  }
}

function refreshCurrentSearchHighlight(delay = 0) {
  if (state.search.positioning) return;
  const result = activeSearchResult();
  if (!result || result.page !== state.currentPage) {
    clearSearchHighlight();
    return;
  }
  const expectedIndex = state.search.currentIndex;
  window.setTimeout(async () => {
    if (expectedIndex !== state.search.currentIndex) return;
    const rendered = await renderSearchHighlight(result, expectedIndex);
    if (!rendered || expectedIndex !== state.search.currentIndex) return;
    await stabilizeSearchResultPosition(result, expectedIndex, rendered.serial);
  }, Math.max(0, Number(delay) || 0));
}

function updateSearchWarning(totalPages = state.pageCount) {
  if (!searchWarning || !searchWarningText) return;
  const count = state.search.pagesWithoutText;
  const failed = state.search.failedPages;
  searchWarning.hidden = count === 0 && failed === 0;
  if (searchWarning.hidden) return;

  const parts = [];
  if (count) {
    parts.push(
      `${count} de ${totalPages} ${count === 1 ? "página no contiene" : "páginas no contienen"} una capa de texto utilizable y pueden necesitar OCR.`
    );
  }
  if (failed) {
    parts.push(
      `${failed} ${failed === 1 ? "página no pudo analizarse" : "páginas no pudieron analizarse"} completamente.`
    );
  }
  searchWarningText.textContent = parts.join(" ");
}

function updateSearchNavigationControls() {
  const ready = Boolean(state.file && state.pageCount);
  const count = state.search.results.length;
  const hasResults = count > 0;
  const hasInput = Boolean(normalizeExtractedText(searchInput?.value || ""));

  if (searchInput) searchInput.disabled = !ready || state.saving || state.search.running || state.ocr.running;
  if (searchButton) searchButton.disabled = !ready || !hasInput || state.saving || state.search.running || state.ocr.running;
  if (searchClearButton) {
    searchClearButton.disabled =
      !ready ||
      state.saving ||
      state.ocr.running ||
      (!hasInput && !hasResults && !state.search.running && !state.search.query);
  }
  if (searchPreviousButton) searchPreviousButton.disabled = !hasResults || state.saving || state.ocr.running;
  if (searchNextButton) searchNextButton.disabled = !hasResults || state.saving || state.ocr.running;

  if (searchCounter) {
    const current = hasResults && state.search.currentIndex >= 0 ? state.search.currentIndex + 1 : 0;
    const suffix = state.search.truncated ? "+" : "";
    searchCounter.textContent = `${current} de ${count}${suffix}`;
  }
}

function resetSearchResultsView(message = "Escribe una palabra o frase y pulsa Buscar.") {
  if (searchResults) {
    const empty = document.createElement("p");
    empty.className = "viewer-search-empty";
    empty.textContent = message;
    searchResults.replaceChildren(empty);
  }
  if (searchResultSummary) searchResultSummary.textContent = "Sin búsqueda";
  if (searchCounter) searchCounter.textContent = "0 de 0";
}

function resetSearchSession() {
  window.clearTimeout(state.search.refreshTimer);
  state.search.serial += 1;
  clearSearchHighlight();
  state.search.running = false;
  state.search.cache.clear();
  state.search.results = [];
  state.search.query = "";
  state.search.foldedQuery = "";
  state.search.currentIndex = -1;
  state.search.processedPages = 0;
  state.search.pagesWithoutText = 0;
  state.search.failedPages = 0;
  state.search.totalMatches = 0;
  state.search.truncated = false;
  state.search.navigationLockUntil = 0;
  state.search.navigationSerial += 1;
  state.search.positioning = false;
  state.search.targetPage = 0;
  state.search.fitApplied = false;
  if (searchInput) searchInput.value = "";
  setSearchProgress(false, 0);
  if (searchWarning) searchWarning.hidden = true;
  setSearchStatus(
    state.file
      ? "Escribe una palabra o frase para buscar en el texto original y el OCR de esta sesión."
      : "Abre un PDF para buscar en su texto original y en el OCR de esta sesión."
  );
  resetSearchResultsView();
  updateSearchNavigationControls();
}

function cancelSearchWork({ silent = false } = {}) {
  if (!state.search.running) return;
  state.search.serial += 1;
  state.search.running = false;
  setSearchProgress(false, 0);
  if (!silent) {
    const pages = state.search.processedPages;
    const matches = state.search.totalMatches;
    setSearchStatus(
      `Análisis cancelado tras ${pages} ${pages === 1 ? "página" : "páginas"}. Se conservan ${matches} ${matches === 1 ? "coincidencia parcial" : "coincidencias parciales"}.`,
      "warning"
    );
  }
  updateSearchWarning();
  renderSearchResults();
  updateSearchNavigationControls();
  diagEmit("search-cancelled", {
    processedPages: state.search.processedPages,
    matches: state.search.totalMatches,
  });
  diagnosticContext();
}

function clearSearch({ keepFocus = true } = {}) {
  cancelSearchWork({ silent: true });
  clearSearchHighlight();
  state.search.results = [];
  state.search.query = "";
  state.search.foldedQuery = "";
  state.search.currentIndex = -1;
  state.search.processedPages = 0;
  state.search.pagesWithoutText = 0;
  state.search.failedPages = 0;
  state.search.totalMatches = 0;
  state.search.truncated = false;
  state.search.navigationLockUntil = 0;
  state.search.navigationSerial += 1;
  state.search.positioning = false;
  state.search.targetPage = 0;
  state.search.fitApplied = false;
  if (searchInput) searchInput.value = "";
  if (searchWarning) searchWarning.hidden = true;
  setSearchProgress(false, 0);
  setSearchStatus(
    state.file
      ? "Escribe una palabra o frase para buscar en el texto original y el OCR de esta sesión."
      : "Abre un PDF para buscar en su texto original y en el OCR de esta sesión."
  );
  resetSearchResultsView();
  updateSearchNavigationControls();
  if (keepFocus && state.file) searchInput?.focus({ preventScroll: true });
}

function nextSearchYield() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function extractSearchRecord(entry, serial) {
  const key = searchCacheKey(entry);
  if (!key) return { original: null, ocr: null, hasText: false, failed: true };
  const cached = state.search.cache.get(key);
  if (cached) return cached;

  const ocr = currentOcrRecord(entry);
  if (entry.kind === "blank") {
    const record = { original: null, ocr: null, hasText: false, failed: false };
    state.search.cache.set(key, record);
    return record;
  }

  let page = null;
  try {
    page = await getPdfPage(entry);
    const rotation = normalizeRotation((page.rotate || 0) + (entry.rotation || 0));
    const viewport = page.getViewport({ scale: 1, rotation });
    entry.width = viewport.width;
    entry.height = viewport.height;
    const content = await page.getTextContent();
    if (serial !== state.search.serial) return null;
    const text = textItemsToString(content?.items || []);
    const original = {
      text,
      folded: foldSearchText(text),
      hasText: Boolean(text),
    };
    const record = {
      original,
      ocr,
      hasText: Boolean(original.hasText || ocr?.hasText),
      failed: false,
    };
    state.search.cache.set(key, record);
    return record;
  } catch (error) {
    if (serial !== state.search.serial) return null;
    const record = {
      original: null,
      ocr,
      hasText: Boolean(ocr?.hasText),
      failed: !ocr?.hasText,
    };
    diagFail(null, error, { operation: "search-text-extraction" });
    state.search.cache.set(key, record);
    return record;
  } finally {
    try { page?.cleanup?.(); } catch { /* limpieza defensiva */ }
  }
}

function appendMatchesFromText(sourceRecord, pageNumber, source, ocrKey = "") {
  if (!sourceRecord?.hasText || !state.search.foldedQuery) return;
  const remaining = Math.max(0, MAX_STORED_SEARCH_RESULTS - state.search.results.length);
  const found = findSearchMatches(sourceRecord.folded, state.search.foldedQuery, remaining);
  state.search.totalMatches += found.total;
  if (found.truncated || state.search.results.length >= MAX_STORED_SEARCH_RESULTS) {
    state.search.truncated = state.search.totalMatches > state.search.results.length;
  }

  for (const start of found.indices) {
    const snippet = buildSearchSnippet(sourceRecord.text, start, state.search.query.length);
    state.search.results.push({
      page: pageNumber,
      start,
      snippet,
      source,
      ocrKey,
      languageLabel: sourceRecord.languageLabel || "",
    });
  }
}

function appendMatchesFromRecord(record, pageNumber, entry) {
  appendMatchesFromText(record?.original, pageNumber, "original");
  appendMatchesFromText(record?.ocr, pageNumber, "ocr", ocrRecordKey(entry));
}

function renderSearchResults() {
  if (!searchResults || !searchResultSummary) return;
  const results = state.search.results;

  if (!results.length) {
    const empty = document.createElement("p");
    empty.className = "viewer-search-empty";
    if (state.search.running) {
      empty.textContent = "Todavía no hay coincidencias en las páginas analizadas. El análisis continúa.";
      searchResultSummary.textContent = `${state.search.processedPages} de ${state.pageCount} páginas`;
    } else if (state.search.query) {
      empty.textContent = state.search.pagesWithoutText
        ? "No se encontraron coincidencias en el texto disponible. Revisa el aviso sobre páginas que pueden necesitar OCR."
        : "No se encontraron coincidencias en la capa de texto del documento.";
      searchResultSummary.textContent = "0 coincidencias";
    } else {
      empty.textContent = "Escribe una palabra o frase y pulsa Buscar.";
      searchResultSummary.textContent = "Sin búsqueda";
    }
    searchResults.replaceChildren(empty);
    updateSearchNavigationControls();
    return;
  }

  const pages = new Set(results.map((result) => result.page)).size;
  const progressSuffix = state.search.running ? " · analizando" : "";
  searchResultSummary.textContent =
    `${state.search.totalMatches} ${state.search.totalMatches === 1 ? "coincidencia" : "coincidencias"} en ${pages} ${pages === 1 ? "página" : "páginas"}${progressSuffix}`;

  if (state.search.currentIndex < 0) {
    const waiting = document.createElement("p");
    waiting.className = "viewer-search-empty";
    waiting.textContent = state.search.running
      ? "Se están reuniendo los resultados. Al terminar se abrirá la primera coincidencia."
      : "Pulsa Siguiente para abrir la primera coincidencia.";
    searchResults.replaceChildren(waiting);
    updateSearchNavigationControls();
    return;
  }

  const result = results[state.search.currentIndex];
  if (!result) return;
  const section = document.createElement("section");
  section.className = "viewer-search-page-group viewer-search-current-card";

  const heading = document.createElement("div");
  heading.className = "viewer-search-page-heading";
  const strong = document.createElement("strong");
  strong.textContent = `Página ${result.page}`;
  const origin = document.createElement("small");
  origin.className = "viewer-search-origin";
  origin.textContent = result.source === "ocr"
    ? `OCR${result.languageLabel ? ` · ${result.languageLabel}` : ""}`
    : "Texto original";
  strong.append(origin);
  const count = document.createElement("span");
  count.textContent = `Coincidencia ${state.search.currentIndex + 1} de ${results.length}${state.search.truncated ? "+" : ""}`;
  heading.append(strong, count);

  const text = document.createElement("p");
  text.className = "viewer-search-result viewer-search-result-preview is-current";
  text.setAttribute("aria-current", "true");
  const before = document.createTextNode(result.snippet.before);
  const mark = document.createElement("mark");
  mark.textContent = result.snippet.match || state.search.query;
  const after = document.createTextNode(result.snippet.after);
  text.append(before, mark, after);

  section.append(heading, text);
  if (state.search.truncated) {
    const more = document.createElement("p");
    more.className = "viewer-search-more";
    more.textContent = `Se guardan las primeras ${results.length} coincidencias para proteger el rendimiento.`;
    section.append(more);
  }
  searchResults.replaceChildren(section);
  updateSearchNavigationControls();
}

function updateSearchCurrentVisual() {
  renderSearchResults();
}

async function activateSearchResult(index, { focus = false } = {}) {
  const count = state.search.results.length;
  if (!count) return;
  const resolved = ((Number(index) || 0) % count + count) % count;
  const navigationSerial = ++state.search.navigationSerial;
  state.search.positioning = true;
  state.search.currentIndex = resolved;
  const result = state.search.results[resolved];
  state.search.targetPage = result.page;
  state.search.navigationLockUntil = Date.now() + 7000;

  const applyFitPage = !state.search.fitApplied;
  if (applyFitPage) {
    state.search.fitApplied = true;
    state.zoomMode = "fit-page";
  }

  updateSearchCurrentVisual();
  updateSearchNavigationControls();
  setSearchStatus(
    `Coincidencia ${resolved + 1} de ${count} · página ${result.page}.`,
    "success"
  );

  try {
    const renderPromise = goToPage(result.page, {
      scroll: false,
      searchNavigation: true,
    });
    if (applyFitPage && ["continuous", "spread"].includes(state.viewMode)) {
      refreshReadingView();
    }
    if (renderPromise && typeof renderPromise.then === "function") {
      await renderPromise;
    }
    if (navigationSerial !== state.search.navigationSerial || resolved !== state.search.currentIndex) return;

    const positionSerial = state.search.highlightSerial;
    await positionSearchPage(result.page, positionSerial);
    if (navigationSerial !== state.search.navigationSerial || resolved !== state.search.currentIndex) return;

    const rendered = await renderSearchHighlight(result, resolved);
    if (
      rendered &&
      navigationSerial === state.search.navigationSerial &&
      resolved === state.search.currentIndex
    ) {
      await stabilizeSearchResultPosition(result, resolved, rendered.serial);
    }
    if (navigationSerial === state.search.navigationSerial) {
      state.search.navigationLockUntil = Date.now() + 3600;
    }
  } finally {
    if (navigationSerial === state.search.navigationSerial) {
      state.search.positioning = false;
    }
  }
  if (focus) searchNextButton?.focus({ preventScroll: true });
}


function navigateSearchResults(delta) {
  const count = state.search.results.length;
  if (!count) return;
  if (state.search.currentIndex < 0) {
    activateSearchResult(delta < 0 ? count - 1 : 0, { focus: false });
    return;
  }
  activateSearchResult(state.search.currentIndex + delta, { focus: false });
}

async function runDocumentSearch() {
  if (!state.file || !state.pageCount || state.saving || state.ocr.running) return;
  const query = normalizeExtractedText(searchInput?.value || "");
  if (!query) {
    setSearchStatus("Escribe una palabra o frase antes de buscar.", "warning");
    updateSearchNavigationControls();
    return;
  }

  const serial = ++state.search.serial;
  clearSearchHighlight();
  state.search.navigationLockUntil = 0;
  state.search.navigationSerial += 1;
  state.search.positioning = false;
  state.search.targetPage = 0;
  state.search.fitApplied = false;
  const diagnosticToken = diagStart("search-index", { pages: state.pageCount });
  state.search.running = true;
  state.search.query = query;
  state.search.foldedQuery = foldSearchText(query);
  state.search.results = [];
  state.search.currentIndex = -1;
  state.search.processedPages = 0;
  state.search.pagesWithoutText = 0;
  state.search.failedPages = 0;
  state.search.totalMatches = 0;
  state.search.truncated = false;
  if (searchWarning) searchWarning.hidden = true;
  setSearchProgress(true, 0);
  setSearchStatus(
    `Analizando 0 de ${state.pageCount} páginas. Los resultados aparecerán progresivamente.`
  );
  resetSearchResultsView("Todavía no hay coincidencias en las páginas analizadas. El análisis continúa.");
  updateSearchNavigationControls();
  diagnosticContext();

  let lastRenderAt = performance.now();
  let lastRenderedResultCount = -1;
  let lastRenderedWarningCount = -1;
  try {
    for (let index = 0; index < state.pagePlan.length; index += 1) {
      if (serial !== state.search.serial) {
        diagEnd(
          diagnosticToken,
          {
            processedPages: state.search.processedPages,
            matches: state.search.totalMatches,
          },
          "cancelled"
        );
        return;
      }

      const entry = state.pagePlan[index];
      const cachedBefore = state.search.cache.has(searchCacheKey(entry));
      const record = await extractSearchRecord(entry, serial);
      if (serial !== state.search.serial || !record) {
        diagEnd(
          diagnosticToken,
          {
            processedPages: state.search.processedPages,
            matches: state.search.totalMatches,
          },
          "cancelled"
        );
        return;
      }

      state.search.processedPages = index + 1;
      if (record.failed) state.search.failedPages += 1;
      else if (!record.hasText) state.search.pagesWithoutText += 1;
      else appendMatchesFromRecord(record, index + 1, entry);

      const percent = (state.search.processedPages / state.pageCount) * 100;
      setSearchProgress(true, percent);
      setSearchStatus(
        `Analizando ${state.search.processedPages} de ${state.pageCount} páginas · ${state.search.totalMatches} ${state.search.totalMatches === 1 ? "coincidencia encontrada" : "coincidencias encontradas"}.`
      );

      const now = performance.now();
      const renderInterval = state.pageCount >= 1000 ? 900 : state.pageCount >= 200 ? 500 : 220;
      const resultChanged = state.search.results.length !== lastRenderedResultCount;
      const warningChanged =
        state.search.pagesWithoutText + state.search.failedPages !== lastRenderedWarningCount;
      if (
        index === state.pagePlan.length - 1 ||
        (now - lastRenderAt > renderInterval && (resultChanged || warningChanged))
      ) {
        updateSearchWarning();
        renderSearchResults();
        lastRenderedResultCount = state.search.results.length;
        lastRenderedWarningCount = state.search.pagesWithoutText + state.search.failedPages;
        lastRenderAt = now;
      }

      const yieldEvery = cachedBefore
        ? (state.pageCount >= 1000 ? 80 : 30)
        : (state.pageCount >= 1000 ? 1 : state.pageCount >= 200 ? 2 : 5);
      if ((index + 1) % yieldEvery === 0) await nextSearchYield();
    }

    if (serial !== state.search.serial) return;
    state.search.running = false;
    setSearchProgress(false, 100);
    updateSearchWarning();
    renderSearchResults();

    const matches = state.search.totalMatches;
    const pagesWithoutText = state.search.pagesWithoutText;
    if (matches) {
      setSearchStatus(
        `Búsqueda terminada: ${matches} ${matches === 1 ? "coincidencia encontrada" : "coincidencias encontradas"}.`,
        pagesWithoutText ? "warning" : "success"
      );
      await activateSearchResult(0, { focus: false });
    } else if (pagesWithoutText) {
      setSearchStatus(
        `Búsqueda terminada sin coincidencias en el texto disponible. ${pagesWithoutText} ${pagesWithoutText === 1 ? "página puede necesitar" : "páginas pueden necesitar"} OCR.`,
        "warning"
      );
    } else {
      setSearchStatus("Búsqueda terminada: no se encontraron coincidencias.", "info");
    }

    diagEnd(diagnosticToken, {
      pages: state.pageCount,
      processedPages: state.search.processedPages,
      pagesWithoutText,
      failedPages: state.search.failedPages,
      matches,
      storedResults: state.search.results.length,
      truncated: state.search.truncated,
    });
  } catch (error) {
    if (serial !== state.search.serial) return;
    state.search.running = false;
    setSearchProgress(false, 0);
    setSearchStatus(`No se pudo completar la búsqueda: ${error?.message || error}.`, "error");
    diagFail(diagnosticToken, error, { operation: "search-index" });
  } finally {
    if (serial === state.search.serial) {
      state.search.running = false;
      setSearchProgress(false, 0);
      updateSearchNavigationControls();
      diagnosticContext();
    }
  }
}

function scheduleSearchRefresh(message = "El documento cambió. Actualizando los resultados de búsqueda…") {
  window.clearTimeout(state.search.refreshTimer);
  if (!state.search.query || !state.file) return;
  state.search.serial += 1;
  state.search.running = false;
  setSearchProgress(false, 0);
  setSearchStatus(message);
  state.search.refreshTimer = window.setTimeout(() => {
    if (!state.file || !state.search.query) return;
    if (state.loading || state.saving || state.ocr.running) {
      scheduleSearchRefresh(message);
      return;
    }
    if (searchInput) searchInput.value = state.search.query;
    runDocumentSearch();
  }, 180);
}

function scheduleSearchRefreshAfterPlanChange() {
  scheduleSearchRefresh();
}

function pruneOcrRecordsForPlan() {
  const validKeys = new Set(
    state.pagePlan
      .filter((entry) => entry?.kind === "pdf")
      .map((entry) => ocrRecordKey(entry))
      .filter(Boolean)
  );
  for (const key of state.ocr.records.keys()) {
    if (!validKeys.has(key)) state.ocr.records.delete(key);
  }

  const validSearchKeys = new Set(state.pagePlan.map((entry) => searchCacheKey(entry)).filter(Boolean));
  for (const key of state.search.cache.keys()) {
    if (!validSearchKeys.has(key)) state.search.cache.delete(key);
  }
  state.ocr.panelKey = "";
}

function normalizedOcrTargetPage(value = state.ocr.targetPage) {
  if (!state.pageCount) return 0;
  const fallback = Math.max(1, Math.min(state.pageCount, Number(state.currentPage) || 1));
  const numeric = Number(value);
  return Number.isInteger(numeric)
    ? Math.max(1, Math.min(state.pageCount, numeric))
    : fallback;
}

function ocrTargetEntry() {
  const page = normalizedOcrTargetPage();
  return page ? entryAt(page) : null;
}

function setOcrTargetPage(pageNumber, { navigate = false, announce = false } = {}) {
  if (!state.pageCount || state.ocr.running) return;
  const page = normalizedOcrTargetPage(pageNumber);
  state.ocr.targetPage = page;
  state.ocr.panelKey = "";
  if (navigate) goToPage(page, { behavior: "auto" });
  updateOcrTargetVisuals();
  updateOcrControls();
  if (announce) setOcrStatus(`Página ${page} elegida para OCR.`, "info");
}

function chooseVisiblePageForOcr({ announce = true } = {}) {
  const visiblePage = detectedVisibleReadingPage();
  setOcrTargetPage(visiblePage || state.currentPage, { navigate: false, announce });
}

function setOcrTargetFromExplicitPageChoice(pageNumber) {
  if (state.activeTool !== "ocr" || state.ocr.running) return;
  setOcrTargetPage(pageNumber, { navigate: false, announce: false });
}

function setOcrProgress(visible, percent = 0) {
  if (!ocrProgressWrap || !ocrProgress || !ocrProgressValue) return;
  const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  ocrProgressWrap.hidden = !visible;
  ocrProgress.value = value;
  ocrProgress.textContent = `${value} %`;
  ocrProgressValue.textContent = `${value} %`;
}

function setOcrStatus(message, kind = "info") {
  if (!ocrStatus) return;
  ocrStatus.textContent = message;
  ocrStatus.dataset.kind = kind;
}

function showOcrLanguagePackagePreview({
  kind = "neutral",
  title = "Paquete sin seleccionar",
  code = "—",
  fileName = "—",
  size = "—",
  hash = "—",
  message = "Selecciona un paquete para comprobar su idioma, tamaño e integridad.",
} = {}) {
  if (!ocrLanguagePackagePreview) return;
  ocrLanguagePackagePreview.hidden = false;
  ocrLanguagePackagePreview.dataset.kind = kind;
  if (ocrLanguagePackageTitle) ocrLanguagePackageTitle.textContent = title;
  if (ocrLanguagePackageCode) ocrLanguagePackageCode.textContent = code;
  if (ocrLanguagePackageFile) ocrLanguagePackageFile.textContent = fileName;
  if (ocrLanguagePackageSize) ocrLanguagePackageSize.textContent = size;
  if (ocrLanguagePackageHash) ocrLanguagePackageHash.textContent = hash;
  if (ocrLanguagePackageMessage) ocrLanguagePackageMessage.textContent = message;
  if (ocrLanguageRuntimeText) {
    ocrLanguageRuntimeText.hidden = true;
    ocrLanguageRuntimeText.textContent = "";
  }
}

function showOcrLanguageRuntimeText(text) {
  if (!ocrLanguageRuntimeText) return;
  ocrLanguageRuntimeText.textContent = String(text || "").trim() || "No se reconoció texto utilizable.";
  ocrLanguageRuntimeText.hidden = false;
}

function setOcrLanguagePackageBusy(busy, message = "") {
  ocrLanguagePackages.busy = Boolean(busy);
  if (ocrLanguageImportPreviewButton) {
    ocrLanguageImportPreviewButton.disabled = ocrLanguagePackages.busy;
    if (message) ocrLanguageImportPreviewButton.textContent = message;
  }
  if (ocrLanguageInstallButton) ocrLanguageInstallButton.disabled = ocrLanguagePackages.busy;
  for (const button of ocrLanguageInstalledList?.querySelectorAll(
    ".viewer-ocr-language-remove, .viewer-ocr-language-test"
  ) || []) {
    button.disabled = ocrLanguagePackages.busy;
  }
}

function createOcrLanguageAdminRow(language, metadata = null) {
  const base = Boolean(language.installed);
  const locallyInstalled = Boolean(metadata);
  const installed = base || locallyInstalled;
  const row = document.createElement("div");
  row.className = `viewer-ocr-language-row${installed ? " is-installed" : ""}`;
  row.dataset.ocrLanguageCode = language.code;

  const identity = document.createElement("span");
  const name = document.createElement("strong");
  const detail = document.createElement("small");
  name.textContent = language.label;
  detail.dir = "auto";
  detail.textContent = `${language.nativeName} · ${language.code}${
    locallyInstalled ? ` · ${formatOcrPackageSize(metadata.bytes)}` : ""
  }`;
  identity.append(name, detail);

  const actions = document.createElement("div");
  actions.className = "viewer-ocr-language-row-actions";
  const badge = document.createElement("b");
  badge.textContent = base ? "Base" : locallyInstalled ? "Local" : "No instalado";
  actions.append(badge);

  if (locallyInstalled) {
    const test = document.createElement("button");
    test.className = "viewer-ocr-language-test";
    test.type = "button";
    test.dataset.testOcrLanguage = language.code;
    test.textContent = ocrLanguagePackages.runtimeCode === language.code
      ? "Probando…"
      : "Probar OCR";
    test.disabled = ocrLanguagePackages.busy;

    const remove = document.createElement("button");
    remove.className = "viewer-ocr-language-remove";
    remove.type = "button";
    remove.dataset.removeOcrLanguage = language.code;
    remove.textContent = "Desinstalar";
    remove.disabled = ocrLanguagePackages.busy;
    actions.append(test, remove);
  }

  row.append(identity, actions);
  return row;
}

function renderOcrLanguageAdmin() {
  if (!ocrLanguageInstalledList || !ocrLanguageAvailableList) return;
  const installedMetadata = new Map(
    ocrLanguagePackages.installed.map((record) => [record.code, record])
  );
  const installedRows = [];
  const availableRows = [];

  for (const language of OCR_LANGUAGES) {
    const metadata = installedMetadata.get(language.code) || null;
    const row = createOcrLanguageAdminRow(language, metadata);
    if (language.installed || metadata) installedRows.push(row);
    else availableRows.push(row);
  }

  ocrLanguageInstalledList.replaceChildren(...installedRows);
  if (availableRows.length) {
    ocrLanguageAvailableList.replaceChildren(...availableRows);
  } else {
    const empty = document.createElement("p");
    empty.className = "viewer-ocr-language-list-empty";
    empty.textContent = "Todos los idiomas catalogados están instalados.";
    ocrLanguageAvailableList.replaceChildren(empty);
  }

  if (ocrLanguageAdminSummary) {
    const installedCount = installedRows.length;
    const availableCount = OCR_LANGUAGES.length - installedCount;
    ocrLanguageAdminSummary.textContent = `${installedCount} instalados · ${availableCount} disponibles como paquetes offline`;
  }
}

async function refreshInstalledOcrLanguagePackages() {
  ocrLanguagePackages.installed = ocrLanguagePackages.storage
    ? [...(await ocrLanguagePackages.storage.list())]
    : [];
  renderOcrLanguageAdmin();
  rebuildOcrLanguageSelectors();
}

async function selectAndValidateOcrLanguagePackage() {
  const dialog = window.__TAURI__?.dialog;
  const fs = window.__TAURI__?.fs;
  if (typeof dialog?.open !== "function" || typeof fs?.readFile !== "function") {
    showOcrLanguagePackagePreview({
      kind: "error",
      title: "Validación no disponible",
      message: "Esta comprobación necesita ejecutarse dentro de PDFPrivado Pro para escritorio.",
    });
    return;
  }

  const originalText = "Seleccionar y validar paquete offline";
  setOcrLanguagePackageBusy(true, "Comprobando paquete…");
  ocrLanguagePackages.pending = null;
  if (ocrLanguageInstallButton) {
    ocrLanguageInstallButton.hidden = true;
    ocrLanguageInstallButton.disabled = true;
  }

  try {
    const selected = await dialog.open({
      directory: false,
      multiple: false,
      title: "Seleccionar paquete offline de idioma OCR",
      filters: [
        {
          name: "Paquete de idioma PDFPrivado Pro",
          extensions: ["pdfprivado-ocr"],
        },
      ],
    });

    const selectedPath = Array.isArray(selected) ? selected[0] : selected;
    if (!selectedPath) return;

    const fileName = ocrLanguagePackageFileName(selectedPath);
    showOcrLanguagePackagePreview({
      kind: "neutral",
      title: "Verificando integridad…",
      fileName,
      message: "Se están comprobando el código, el tamaño y la huella SHA-256 antes de permitir la instalación local.",
    });

    const bytes = await fs.readFile(selectedPath);
    const result = await inspectOcrLanguagePackage({ fileName, bytes });
    const alreadyInstalled = ocrLanguagePackages.installed.some(
      (record) => record.code === result.code
    );
    ocrLanguagePackages.pending = Object.freeze({
      inspection: result,
      bytes: new Uint8Array(bytes).slice(),
    });

    showOcrLanguagePackagePreview({
      kind: "success",
      title: `${result.language.label} · paquete válido`,
      code: result.code,
      fileName: result.fileName,
      size: result.sizeLabel,
      hash: result.sha256,
      message: alreadyInstalled
        ? "Paquete oficial íntegro. Puedes reinstalarlo para sustituir la copia local existente."
        : "Paquete oficial íntegro. Puedes instalarlo localmente en este equipo.",
    });
    if (ocrLanguageInstallButton) {
      ocrLanguageInstallButton.hidden = false;
      ocrLanguageInstallButton.disabled = !ocrLanguagePackages.storage;
      ocrLanguageInstallButton.textContent = alreadyInstalled
        ? `Reinstalar ${result.language.label}`
        : `Instalar ${result.language.label} localmente`;
    }
    diagEmit("ocr-language-package-validated", {
      language: result.code,
      bytes: result.bytes,
    });
  } catch (error) {
    showOcrLanguagePackagePreview({
      kind: "error",
      title: "Paquete rechazado",
      fileName: ocrLanguagePackageFile?.textContent || "—",
      message: String(error?.message || error),
    });
    diagnostics()?.error?.(error, "validar-paquete-ocr", { operation: "inspect-only" });
  } finally {
    setOcrLanguagePackageBusy(false);
    if (ocrLanguageImportPreviewButton) {
      ocrLanguageImportPreviewButton.disabled = false;
      ocrLanguageImportPreviewButton.textContent = originalText;
    }
    if (ocrLanguageInstallButton && !ocrLanguageInstallButton.hidden) {
      ocrLanguageInstallButton.disabled = !ocrLanguagePackages.storage;
    }
  }
}

async function installPendingOcrLanguagePackage() {
  const pending = ocrLanguagePackages.pending;
  if (!pending || !ocrLanguagePackages.storage || ocrLanguagePackages.busy) return;

  setOcrLanguagePackageBusy(true, "Instalando paquete…");
  if (ocrLanguageInstallButton) {
    ocrLanguageInstallButton.disabled = true;
    ocrLanguageInstallButton.textContent = "Instalando localmente…";
  }

  try {
    const installed = await ocrLanguagePackages.storage.install(pending);
    await refreshInstalledOcrLanguagePackages();
    showOcrLanguagePackagePreview({
      kind: "success",
      title: `${installed.label} · instalado localmente`,
      code: installed.code,
      fileName: installed.fileName,
      size: formatOcrPackageSize(installed.bytes),
      hash: installed.sha256,
      message: "El modelo permanece en este equipo. En esta etapa todavía no está conectado al motor OCR.",
    });
    ocrLanguagePackages.pending = null;
    if (ocrLanguageInstallButton) {
      ocrLanguageInstallButton.hidden = true;
      ocrLanguageInstallButton.disabled = true;
    }
    diagEmit("ocr-language-package-installed", {
      language: installed.code,
      bytes: installed.bytes,
    });
  } catch (error) {
    showOcrLanguagePackagePreview({
      kind: "error",
      title: "No se pudo instalar el paquete",
      code: pending.inspection.code,
      fileName: pending.inspection.fileName,
      size: pending.inspection.sizeLabel,
      hash: pending.inspection.sha256,
      message: String(error?.message || error),
    });
    diagnostics()?.error?.(error, "instalar-paquete-ocr", {
      language: pending.inspection.code,
    });
  } finally {
    setOcrLanguagePackageBusy(false);
    if (ocrLanguageImportPreviewButton) {
      ocrLanguageImportPreviewButton.disabled = false;
      ocrLanguageImportPreviewButton.textContent = "Seleccionar y validar paquete offline";
    }
    if (ocrLanguageInstallButton && !ocrLanguageInstallButton.hidden) {
      ocrLanguageInstallButton.disabled = !ocrLanguagePackages.storage;
      ocrLanguageInstallButton.textContent = `Instalar ${pending.inspection.language.label} localmente`;
    }
  }
}

function translateExternalOcrProgress(message, languageLabel) {
  const translated = translateOcrProgress(message);
  const status = String(message?.status || "").toLowerCase();
  if (status.includes("loading language")) {
    return {
      percent: translated.percent,
      text: `Cargando el modelo local de ${languageLabel} en el motor aislado…`,
    };
  }
  return translated;
}

async function testInstalledOcrLanguagePackage(code) {
  const language = OCR_LANGUAGES.find((entry) => entry.code === code);
  const pageNumber = normalizedOcrTargetPage();
  const entry = pageNumber ? entryAt(pageNumber) : null;

  if (!language || language.installed || !ocrLanguagePackages.storage) return;
  if (!state.file || !entry || entry.kind !== "pdf") {
    showOcrLanguagePackagePreview({
      kind: "error",
      title: `${language.label} · prueba no iniciada`,
      code: language.code,
      message: "Abre un PDF y elige una página antes de probar este modelo.",
    });
    return;
  }
  if (state.ocr.running || state.search.running || state.saving || ocrLanguagePackages.busy) return;

  const entryId = entry.id;
  const serial = ++state.ocr.serial;
  const diagnosticToken = diagStart("ocr-external-runtime-test", {
    page: pageNumber,
    language: language.code,
  });
  let page = null;
  let rendered = null;

  state.ocr.running = true;
  state.ocr.activeEntryId = entryId;
  ocrLanguagePackages.runtimeCode = language.code;
  setOcrLanguagePackageBusy(true, "Prueba OCR en curso…");
  renderOcrLanguageAdmin();
  setOcrProgress(true, 2);
  setOcrStatus(`Preparando una prueba aislada de la página ${pageNumber} en ${language.label}…`);
  updateOcrControls();
  diagnosticContext();

  try {
    const stored = await ocrLanguagePackages.storage.readVerified(language.code);
    if (!stored) {
      throw new Error(`El modelo local de ${language.label} ya no está instalado.`);
    }

    page = await getPdfPage(entry);
    rendered = await renderPageForOcr(page, entry, {
      ...OCR_RENDER_LIMITS,
      onRenderTask(task) {
        state.ocr.renderTask = task;
      },
      isCancelled() {
        return serial !== state.ocr.serial || !state.ocr.running;
      },
    });
    state.ocr.renderTask = null;
    if (serial !== state.ocr.serial || !state.ocr.running) return;

    setOcrProgress(true, 25);
    setOcrStatus(`Modelo verificado. Iniciando la prueba aislada en ${language.label}…`);
    const result = await recognizeExternalOcrImage(
      rendered.canvas,
      language.code,
      stored.bytes,
      {
        onProgress(message) {
          if (serial !== state.ocr.serial || !state.ocr.running) return;
          const translated = translateExternalOcrProgress(message, language.label);
          setOcrProgress(true, translated.percent);
          setOcrStatus(translated.text);
        },
      }
    );

    if (serial !== state.ocr.serial || !state.ocr.running || entryAt(pageNumber)?.id !== entryId) return;

    const text = normalizeExtractedText(result?.data?.text || "");
    showOcrLanguagePackagePreview({
      kind: text ? "success" : "neutral",
      title: `${language.label} · prueba aislada completada`,
      code: language.code,
      fileName: stored.metadata.fileName,
      size: formatOcrPackageSize(stored.metadata.bytes),
      hash: stored.metadata.sha256,
      message: text
        ? "El motor cargó el paquete local y reconoció la página. El texto no se ha guardado ni añadido a Buscar."
        : "El motor cargó el paquete local, pero no encontró texto utilizable. El resultado no se ha guardado.",
    });
    showOcrLanguageRuntimeText(text);
    setOcrProgress(false, 100);
    setOcrStatus(
      text
        ? `Prueba aislada terminada en ${language.label}. El resultado no se ha guardado.`
        : `Prueba aislada terminada en ${language.label}, sin texto utilizable.`,
      text ? "success" : "warning"
    );
    diagEnd(diagnosticToken, {
      page: pageNumber,
      language: language.code,
      hasText: Boolean(text),
      characters: text.length,
      imagePixels: rendered.width * rendered.height,
      effectiveDpi: rendered.effectiveDpi,
    });
  } catch (error) {
    if (
      serial !== state.ocr.serial ||
      isExternalOcrCancelledError(error) ||
      isOcrCancelledError(error) ||
      error?.name === "AbortError"
    ) {
      diagEnd(diagnosticToken, { page: pageNumber, language: language.code }, "cancelled");
      return;
    }
    setOcrProgress(false, 0);
    setOcrStatus(`No se pudo completar la prueba OCR: ${error?.message || error}.`, "error");
    showOcrLanguagePackagePreview({
      kind: "error",
      title: `${language.label} · prueba fallida`,
      code: language.code,
      message: String(error?.message || error),
    });
    diagFail(diagnosticToken, error, {
      operation: "ocr-external-runtime-test",
      page: pageNumber,
      language: language.code,
    });
  } finally {
    try { page?.cleanup?.(); } catch { /* limpieza defensiva */ }
    if (rendered?.canvas) {
      rendered.canvas.width = 1;
      rendered.canvas.height = 1;
    }
    if (serial === state.ocr.serial) {
      state.ocr.running = false;
      state.ocr.renderTask = null;
      state.ocr.activeEntryId = "";
      ocrLanguagePackages.runtimeCode = "";
      setOcrLanguagePackageBusy(false);
      if (ocrLanguageImportPreviewButton) {
        ocrLanguageImportPreviewButton.disabled = false;
        ocrLanguageImportPreviewButton.textContent = "Seleccionar y validar paquete offline";
      }
      renderOcrLanguageAdmin();
      updateOcrControls();
      diagnosticContext();
    }
  }
}

async function removeInstalledOcrLanguagePackage(code) {
  if (!ocrLanguagePackages.storage || ocrLanguagePackages.busy) return;
  const language = OCR_LANGUAGES.find((entry) => entry.code === code);
  if (!language || language.installed) return;
  if (!window.confirm(`¿Desinstalar el modelo OCR de ${language.label} de este equipo?`)) return;

  setOcrLanguagePackageBusy(true, "Procesando…");
  try {
    const removed = await ocrLanguagePackages.storage.remove(code);
    await refreshInstalledOcrLanguagePackages();
    if (ocrLanguagePackages.pending?.inspection?.code === code) {
      ocrLanguagePackages.pending = null;
      if (ocrLanguageInstallButton) {
        ocrLanguageInstallButton.hidden = true;
        ocrLanguageInstallButton.disabled = true;
      }
    }
    showOcrLanguagePackagePreview({
      kind: "neutral",
      title: removed ? `${language.label} · desinstalado` : `${language.label} · no estaba instalado`,
      code: language.code,
      message: removed
        ? "El modelo opcional se ha eliminado del almacenamiento local."
        : "No había ningún modelo local que eliminar.",
    });
    diagEmit("ocr-language-package-removed", { language: code, removed });
  } catch (error) {
    showOcrLanguagePackagePreview({
      kind: "error",
      title: "No se pudo desinstalar el idioma",
      code: language.code,
      message: String(error?.message || error),
    });
    diagnostics()?.error?.(error, "desinstalar-paquete-ocr", { language: code });
  } finally {
    setOcrLanguagePackageBusy(false);
    if (ocrLanguageImportPreviewButton) {
      ocrLanguageImportPreviewButton.disabled = false;
      ocrLanguageImportPreviewButton.textContent = "Seleccionar y validar paquete offline";
    }
  }
}

async function initializeOcrLanguagePackageManager() {
  renderOcrLanguageAdmin();

  const desktopAvailable = Boolean(
    typeof window.__TAURI__?.dialog?.open === "function" &&
    typeof window.__TAURI__?.fs?.readFile === "function"
  );
  if (ocrLanguageImportPreviewButton) {
    ocrLanguageImportPreviewButton.disabled = !desktopAvailable;
    if (!desktopAvailable) {
      ocrLanguageImportPreviewButton.textContent = "Validación disponible en escritorio";
    }
  }

  try {
    ocrLanguagePackages.storage = createOcrLanguageStorage({
      driver: createIndexedDbOcrLanguageDriver(),
    });
    await refreshInstalledOcrLanguagePackages();
  } catch (error) {
    ocrLanguagePackages.storage = null;
    ocrLanguagePackages.installed = [];
    renderOcrLanguageAdmin();
    showOcrLanguagePackagePreview({
      kind: "error",
      title: "Almacenamiento local no disponible",
      message: String(error?.message || error),
    });
    diagnostics()?.error?.(error, "inicializar-almacen-idiomas-ocr", {
      operation: "metadata-only",
    });
  }
}

function formatOcrConfidence(value) {
  return Number.isFinite(value) ? `${Math.round(value)} % de confianza aproximada` : "Confianza no disponible";
}

function refreshOcrPanel({ force = false } = {}) {
  if (!ocrPageLabel || !ocrPreview || !ocrSummary) return;
  const targetPage = normalizedOcrTargetPage();
  const entry = targetPage ? entryAt(targetPage) : null;
  const key = ocrRecordKey(entry);
  if (!force && state.ocr.panelKey === key && !state.ocr.running) return;
  state.ocr.panelKey = key;

  if (!state.file || !entry) {
    ocrPageLabel.textContent = "Ninguna página abierta";
    if (ocrPageNumberInput) {
      ocrPageNumberInput.value = "1";
      ocrPageNumberInput.max = "1";
    }
    if (ocrPageTotal) ocrPageTotal.textContent = "/ 0";
    ocrSummary.textContent = "Sin OCR";
    ocrPreview.textContent = "Abre un PDF para elegir y reconocer una página.";
    if (!state.ocr.running) setOcrStatus("Abre un PDF para iniciar el OCR local.");
    return;
  }

  state.ocr.targetPage = targetPage;
  if (ocrPageNumberInput) {
    ocrPageNumberInput.value = String(targetPage);
    ocrPageNumberInput.max = String(state.pageCount);
  }
  if (ocrPageTotal) ocrPageTotal.textContent = `/ ${state.pageCount}`;
  ocrPageLabel.textContent = `Elegida: página ${targetPage} de ${state.pageCount}`;
  const record = currentOcrRecord(entry);
  if (!record) {
    ocrSummary.textContent = "Sin OCR en esta sesión";
    ocrPreview.textContent = "Todavía no se ha reconocido texto en esta página.";
    if (!state.ocr.running) setOcrStatus("El reconocimiento se guardará únicamente en memoria durante esta sesión.");
    return;
  }

  ocrSummary.textContent = `${record.languageLabel} · ${formatOcrConfidence(record.confidence)} · ${record.effectiveDpi} PPP`;
  ocrPreview.textContent = record.text || "No se reconoció texto utilizable.";
  if (!state.ocr.running) {
    setOcrStatus(
      record.hasText
        ? "OCR disponible para Buscar. El PDF original no se ha modificado."
        : "El OCR terminó, pero no encontró texto utilizable.",
      record.hasText ? "success" : "warning"
    );
  }
}

// PDFPRIVADO_OCR_BILINGUE_V3
function installedOcrLanguageCodes() {
  return new Set([
    ...OCR_LANGUAGES
      .filter((language) => language.installed)
      .map((language) => language.code),
    ...ocrLanguagePackages.installed.map((record) => record.code),
  ]);
}

function isOcrLanguageInstalled(code) {
  return installedOcrLanguageCodes().has(
    String(code || "").trim().toLowerCase()
  );
}

function createOcrLanguageOption(language) {
  const installed = isOcrLanguageInstalled(language.code);
  const option = document.createElement("option");

  option.value = language.code;
  option.dataset.installed = String(installed);
  option.disabled = !installed;
  option.textContent = installed
    ? `${language.label} · ${language.nativeName}${language.installed ? "" : " · local"}`
    : `${language.label} · paquete offline pendiente`;

  return option;
}

function rebuildOcrLanguageSelectors({ preserve = true } = {}) {
  const installed = installedOcrLanguageCodes();
  const previousPrimary = preserve
    ? String(ocrLanguage?.value || "spa")
    : "spa";
  const previousSecondary = preserve
    ? String(ocrLanguageSecondary?.value || "")
    : "";

  if (ocrLanguage) {
    ocrLanguage.replaceChildren(
      ...OCR_LANGUAGES.map(createOcrLanguageOption)
    );
    ocrLanguage.value = installed.has(previousPrimary)
      ? previousPrimary
      : "spa";
  }

  if (ocrLanguageSecondary) {
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Ninguno";

    ocrLanguageSecondary.replaceChildren(
      none,
      ...OCR_LANGUAGES.map(createOcrLanguageOption)
    );

    ocrLanguageSecondary.value =
      previousSecondary &&
      previousSecondary !== ocrLanguage?.value &&
      installed.has(previousSecondary)
        ? previousSecondary
        : "";
  }

  if (ocrLanguageAvailability) {
    ocrLanguageAvailability.textContent =
      `${OCR_LANGUAGES.length} idiomas catalogados · ` +
      `${installed.size} instalados en este equipo`;
  }

  syncOcrLanguageSelectors();
}

function selectedOcrLanguageSelection() {
  const installed = installedOcrLanguageCodes();
  const primaryCode = installed.has(ocrLanguage?.value)
    ? ocrLanguage.value
    : "spa";
  const secondaryCode =
    ocrLanguageSecondary?.value &&
    ocrLanguageSecondary.value !== primaryCode &&
    installed.has(ocrLanguageSecondary.value)
      ? ocrLanguageSecondary.value
      : "";

  const codes = secondaryCode
    ? [primaryCode, secondaryCode]
    : [primaryCode];

  const languages = codes.map((code) =>
    OCR_LANGUAGES.find((entry) => entry.code === code)
  );

  return Object.freeze({
    primary: languages[0],
    secondary: languages[1] || null,
    codes,
    key: codes.join("+"),
    label: languages
      .map((language) => language.label)
      .join(" + "),
    usesOptionalModels: languages.some(
      (language) => !language.installed
    ),
  });
}

function syncOcrLanguageSelectors({ announce = false } = {}) {
  const installed = installedOcrLanguageCodes();

  if (ocrLanguage && !installed.has(ocrLanguage.value)) {
    ocrLanguage.value = "spa";
  }

  if (ocrLanguageSecondary) {
    if (
      ocrLanguageSecondary.value === ocrLanguage?.value ||
      (
        ocrLanguageSecondary.value &&
        !installed.has(ocrLanguageSecondary.value)
      )
    ) {
      ocrLanguageSecondary.value = "";
    }

    for (const option of ocrLanguageSecondary.options) {
      option.disabled = Boolean(
        option.value &&
        (
          option.value === ocrLanguage?.value ||
          option.dataset.installed === "false"
        )
      );
    }
  }

  const selection = selectedOcrLanguageSelection();

  if (announce) {
    setOcrStatus(
      `Idiomas preparados: ${selection.label}.`,
      "info"
    );
  }

  return selection;
}

async function readBundledOcrModel(code) {
  const url = new URL(
    `./vendor/tesseract/lang/${code}.traineddata.gz`,
    import.meta.url
  );
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `No se pudo cargar el modelo base ${code} incluido en la aplicación.`
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function prepareOcrRuntimeModels(codes) {
  const models = [];

  for (const code of codes) {
    const language = OCR_LANGUAGES.find(
      (entry) => entry.code === code
    );

    if (!language) {
      throw new Error(`Idioma OCR desconocido: ${code}`);
    }

    if (language.installed) {
      models.push({
        code,
        bytes: await readBundledOcrModel(code),
      });
      continue;
    }

    const stored =
      await ocrLanguagePackages.storage?.readVerified(code);

    if (!stored) {
      throw new Error(
        `El modelo local de ${language.label} ya no está instalado.`
      );
    }

    models.push({
      code,
      bytes: stored.bytes,
    });
  }

  return models;
}
function updateOcrControls() {
  const targetPage = normalizedOcrTargetPage();
  const targetEntry = targetPage ? entryAt(targetPage) : null;
  const ready = Boolean(state.file && state.pageCount && targetEntry?.kind === "pdf");
  const record = currentOcrRecord(targetEntry);
  const busy = state.ocr.running || state.saving || state.search.running;
  if (ocrLanguage) ocrLanguage.disabled = !ready || busy;
  if (ocrLanguageSecondary) {
    ocrLanguageSecondary.disabled = !ready || busy;
  }
  if (ocrScope) ocrScope.disabled = !state.file || !state.pageCount || busy;
  if (ocrReprocess) ocrReprocess.disabled = !state.file || !state.pageCount || busy;
  if (ocrPageNumberInput) {
    ocrPageNumberInput.disabled = !state.file || !state.pageCount || busy;
    ocrPageNumberInput.min = "1";
    ocrPageNumberInput.max = String(Math.max(1, state.pageCount));
    if (targetPage) ocrPageNumberInput.value = String(targetPage);
  }
  if (ocrPageTotal) ocrPageTotal.textContent = `/ ${state.pageCount || 0}`;
  if (ocrPagePreviousButton) ocrPagePreviousButton.disabled = !ready || busy || targetPage <= 1;
  if (ocrPageNextButton) ocrPageNextButton.disabled = !ready || busy || targetPage >= state.pageCount;
  if (ocrUseVisibleButton) {
    ocrUseVisibleButton.disabled = !state.file || !state.pageCount || busy;
    const visiblePage = state.file && state.pageCount ? detectedVisibleReadingPage() : 0;
    ocrUseVisibleButton.textContent = visiblePage
      ? `Usar página visible (${visiblePage})`
      : "Usar página visible";
  }
  if (ocrStartButton) {
    const scope = selectedOcrBatchScope();
    const pages = ocrBatchPages(scope);
    ocrStartButton.disabled = !pages.length || busy;
    ocrStartButton.textContent =
      scope === "current"
        ? (record ? "Repetir OCR de la página elegida" : "Reconocer página elegida")
        : scope === "without-text"
          ? "Reconocer páginas sin texto"
          : "Reconocer documento completo";
  }
  if (ocrCancelButton) {
    ocrCancelButton.hidden = !state.ocr.running;
    ocrCancelButton.disabled = !state.ocr.running;
  }
  if (ocrClearButton) ocrClearButton.disabled = !ready || !record || state.ocr.running || state.saving;
  refreshOcrPanel();
}

function translateOcrProgress(message) {
  const status = String(message?.status || "").toLowerCase();
  const progress = Math.max(0, Math.min(1, Number(message?.progress) || 0));
  if (status.includes("loading tesseract core")) return { percent: 28 + progress * 10, text: "Cargando el motor OCR local…" };
  if (status.includes("loading language")) return { percent: 38 + progress * 10, text: "Cargando el idioma incluido en la aplicación…" };
  if (status.includes("initializing")) return { percent: 48 + progress * 8, text: "Inicializando el reconocimiento…" };
  if (status.includes("recognizing text")) return { percent: 56 + progress * 40, text: "Reconociendo el texto de la página…" };
  if (status === "error") return { percent: 0, text: "El motor OCR informó de un error." };
  return { percent: 30 + progress * 25, text: "Preparando el motor OCR local…" };
}

async function cancelCurrentOcr({ silent = false } = {}) {
  if (!state.ocr.running && !state.ocr.renderTask) return;
  state.ocr.serial += 1;
  state.ocr.running = false;
  try { state.ocr.renderTask?.cancel?.(); } catch { /* tarea ya finalizada */ }
  state.ocr.renderTask = null;
  await Promise.allSettled([
    cancelOcrEngine(),
    cancelExternalOcrRuntime(),
  ]);
  ocrLanguagePackages.runtimeCode = "";
  setOcrLanguagePackageBusy(false);
  renderOcrLanguageAdmin();
  setOcrProgress(false, 0);
  if (!silent) setOcrStatus("OCR cancelado. No se ha modificado el documento.", "warning");
  updateOcrControls();
  diagEmit("ocr-cancelled", { page: normalizedOcrTargetPage() });
  diagnosticContext();
}

// PDFPRIVADO_OCR_MULTIPAGINA_BASE_V1
function selectedOcrBatchScope() {
  const value = String(ocrScope?.value || "current");
  return ["current", "all", "without-text"].includes(value)
    ? value
    : "current";
}

function resetOcrBatchStats() {
  state.ocr.batchTotal = 0;
  state.ocr.batchProcessed = 0;
  state.ocr.batchSucceeded = 0;
  state.ocr.batchSkipped = 0;
  state.ocr.batchFailed = 0;
  state.ocr.batchStartedAt = 0;
}

function formatOcrBatchDuration(milliseconds) {
  const seconds = Math.max(0, Math.round((Number(milliseconds) || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes} min ${rest} s` : `${rest} s`;
}

function ocrBatchPages(scope = selectedOcrBatchScope()) {
  if (!state.file || !state.pageCount) return [];

  if (scope === "current") {
    const page = normalizedOcrTargetPage();
    const entry = page ? entryAt(page) : null;
    return entry?.kind === "pdf" ? [page] : [];
  }

  const pages = [];
  for (let page = 1; page <= state.pageCount; page += 1) {
    if (entryAt(page)?.kind === "pdf") pages.push(page);
  }
  return pages;
}

async function pageHasUsableOriginalText(pageNumber, serial) {
  const entry = entryAt(pageNumber);
  if (!entry || entry.kind !== "pdf") return false;

  let page = null;
  try {
    page = await getPdfPage(entry);
    const content = await page.getTextContent();
    if (serial !== state.ocr.serial || !state.ocr.running) {
      const error = new Error("OCR cancelado");
      error.name = "AbortError";
      throw error;
    }
    return (content?.items || []).some(
      (item) => String(item?.str || "").trim().length > 0
    );
  } finally {
    try { page?.cleanup?.(); } catch { /* limpieza defensiva */ }
  }
}

function setOcrBatchProgress(pageNumber, pageIndex, pageTotal, innerPercent = 0, detail = "") {
  const completed = Math.max(0, pageIndex);
  const fraction = Math.max(0, Math.min(1, Number(innerPercent) / 100));
  const global = pageTotal
    ? ((completed + fraction) / pageTotal) * 100
    : 0;

  setOcrProgress(true, global);

  const elapsed = state.ocr.batchStartedAt
    ? performance.now() - state.ocr.batchStartedAt
    : 0;
  const average = completed > 0 ? elapsed / completed : 0;
  const remaining = average > 0
    ? average * Math.max(0, pageTotal - completed)
    : 0;
  const estimate = completed > 0 && pageTotal > completed
    ? ` · estimado ${formatOcrBatchDuration(remaining)}`
    : "";

  setOcrStatus(
    `Página ${pageNumber} · ${completed + 1} de ${pageTotal}${estimate}${detail ? ` · ${detail}` : ""}`
  );
}

async function recognizeOcrPageInBatch(
  pageNumber,
  languageSelection,
  serial,
  pageIndex,
  pageTotal
) {
  const entry = entryAt(pageNumber);
  if (!entry || entry.kind !== "pdf") {
    return { status: "skipped", reason: "Página no compatible" };
  }

  const entryId = entry.id;
  let page = null;
  let rendered = null;

  try {
    state.ocr.targetPage = pageNumber;
    state.ocr.activeEntryId = entryId;
    state.ocr.panelKey = "";
    refreshOcrPanel({ force: true });

    setOcrBatchProgress(
      pageNumber,
      pageIndex,
      pageTotal,
      2,
      `Preparando OCR en ${languageSelection.label}`
    );

    page = await getPdfPage(entry);
    rendered = await renderPageForOcr(page, entry, {
      ...OCR_RENDER_LIMITS,
      onRenderTask(task) {
        state.ocr.renderTask = task;
      },
      isCancelled() {
        return serial !== state.ocr.serial || !state.ocr.running;
      },
    });

    state.ocr.renderTask = null;

    if (serial !== state.ocr.serial || !state.ocr.running) {
      const error = new Error("OCR cancelado");
      error.name = "AbortError";
      throw error;
    }

    let result;

    if (languageSelection.usesOptionalModels) {
      const runtimeModels = await prepareOcrRuntimeModels(
        languageSelection.codes
      );

      if (serial !== state.ocr.serial || !state.ocr.running) {
        const error = new Error("OCR cancelado");
        error.name = "AbortError";
        throw error;
      }

      ocrLanguagePackages.runtimeCode = languageSelection.key;
      setOcrLanguagePackageBusy(true, "OCR multipágina en curso…");
      renderOcrLanguageAdmin();

      result = await recognizeExternalOcrImage(
        rendered.canvas,
        languageSelection.codes,
        runtimeModels,
        {
          onProgress(message) {
            if (serial !== state.ocr.serial || !state.ocr.running) return;
            const translated = translateExternalOcrProgress(
              message,
              languageSelection.label
            );
            setOcrBatchProgress(
              pageNumber,
              pageIndex,
              pageTotal,
              translated.percent,
              translated.text
            );
          },
        }
      );
    } else {
      result = await recognizeOcrImage(
        rendered.canvas,
        languageSelection.codes,
        {
          onProgress(message) {
            if (serial !== state.ocr.serial || !state.ocr.running) return;
            const translated = translateOcrProgress(message);
            setOcrBatchProgress(
              pageNumber,
              pageIndex,
              pageTotal,
              translated.percent,
              translated.text
            );
          },
        }
      );
    }

    if (
      serial !== state.ocr.serial ||
      !state.ocr.running ||
      entryAt(pageNumber)?.id !== entryId
    ) {
      const error = new Error("OCR cancelado");
      error.name = "AbortError";
      throw error;
    }

    const record = buildOcrRecord(result?.data, {
      imageWidth: rendered.width,
      imageHeight: rendered.height,
      language: languageSelection.key,
      languageLabel: languageSelection.label,
      rotation: rendered.rotation,
      effectiveDpi: rendered.effectiveDpi,
    });

    state.ocr.records.set(ocrRecordKey(entry), record);
    state.search.cache.delete(searchCacheKey(entry));
    state.ocr.panelKey = "";

    return {
      status: "success",
      hasText: record.hasText,
      words: record.words.length,
      confidence: record.confidence,
    };
  } finally {
    try { page?.cleanup?.(); } catch { /* limpieza defensiva */ }

    if (rendered?.canvas) {
      rendered.canvas.width = 1;
      rendered.canvas.height = 1;
    }

    state.ocr.renderTask = null;
    state.ocr.activeEntryId = "";
    ocrLanguagePackages.runtimeCode = "";
    setOcrLanguagePackageBusy(false);
    renderOcrLanguageAdmin();
  }
}

async function recognizeCurrentPage() {
  const scope = selectedOcrBatchScope();
  const reprocess = Boolean(ocrReprocess?.checked);
  const pages = ocrBatchPages(scope);

  if (
    !state.file ||
    !pages.length ||
    state.ocr.running ||
    state.search.running ||
    state.saving
  ) {
    return;
  }

  const languageSelection = syncOcrLanguageSelectors();
  const serial = ++state.ocr.serial;
  const diagnosticToken = diagStart("ocr-batch", {
    scope,
    pages: pages.length,
    language: languageSelection.key,
    reprocess,
  });

  state.ocr.running = true;
  state.ocr.batchScope = scope;
  state.ocr.batchReprocess = reprocess;
  state.ocr.batchTotal = pages.length;
  state.ocr.batchProcessed = 0;
  state.ocr.batchSucceeded = 0;
  state.ocr.batchSkipped = 0;
  state.ocr.batchFailed = 0;
  state.ocr.batchStartedAt = performance.now();

  setOcrProgress(true, 0);
  setOcrStatus(
    scope === "current"
      ? `Preparando OCR de la página ${pages[0]}…`
      : `Preparando OCR secuencial de ${pages.length} páginas…`
  );
  updateOcrControls();
  diagnosticContext();

  try {
    for (let index = 0; index < pages.length; index += 1) {
      if (serial !== state.ocr.serial || !state.ocr.running) {
        return;
      }

      const pageNumber = pages[index];
      const entry = entryAt(pageNumber);

      try {
        if (!entry || entry.kind !== "pdf") {
          state.ocr.batchSkipped += 1;
          continue;
        }

        if (!reprocess && state.ocr.records.has(ocrRecordKey(entry))) {
          state.ocr.batchSkipped += 1;
          setOcrBatchProgress(
            pageNumber,
            index,
            pages.length,
            100,
            "OCR existente conservado"
          );
          continue;
        }

        if (
          scope === "without-text" &&
          await pageHasUsableOriginalText(pageNumber, serial)
        ) {
          state.ocr.batchSkipped += 1;
          setOcrBatchProgress(
            pageNumber,
            index,
            pages.length,
            100,
            "Página con texto original, omitida"
          );
          continue;
        }

        const result = await recognizeOcrPageInBatch(
          pageNumber,
          languageSelection,
          serial,
          index,
          pages.length
        );

        if (result.status === "success") {
          state.ocr.batchSucceeded += 1;
        } else {
          state.ocr.batchSkipped += 1;
        }
      } catch (error) {
        if (
          serial !== state.ocr.serial ||
          isOcrCancelledError(error) ||
          isExternalOcrCancelledError(error) ||
          error?.name === "AbortError"
        ) {
          return;
        }

        state.ocr.batchFailed += 1;
        diagFail(null, error, {
          operation: "ocr-batch-page",
          page: pageNumber,
          language: languageSelection.key,
        });
      } finally {
        state.ocr.batchProcessed = index + 1;
        setOcrProgress(
          true,
          (state.ocr.batchProcessed / pages.length) * 100
        );
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }

    setOcrProgress(false, 100);
    state.ocr.panelKey = "";
    refreshOcrPanel({ force: true });

    const elapsed = formatOcrBatchDuration(
      performance.now() - state.ocr.batchStartedAt
    );

    setOcrStatus(
      `OCR finalizado en ${elapsed}: ` +
      `${state.ocr.batchSucceeded} procesadas, ` +
      `${state.ocr.batchSkipped} omitidas y ` +
      `${state.ocr.batchFailed} con error.`,
      state.ocr.batchFailed ? "warning" : "success"
    );

    if (state.search.query) {
      scheduleSearchRefresh(
        "El OCR multipágina cambió el índice local. Actualizando Buscar…"
      );
    }

    diagEnd(diagnosticToken, {
      scope,
      total: pages.length,
      processed: state.ocr.batchProcessed,
      succeeded: state.ocr.batchSucceeded,
      skipped: state.ocr.batchSkipped,
      failed: state.ocr.batchFailed,
      language: languageSelection.key,
    });
  } finally {
    if (serial === state.ocr.serial) {
      state.ocr.running = false;
      state.ocr.renderTask = null;
      state.ocr.activeEntryId = "";
      ocrLanguagePackages.runtimeCode = "";
      setOcrLanguagePackageBusy(false);
      renderOcrLanguageAdmin();
      updateOcrControls();
      diagnosticContext();
    }
  }
}
function clearCurrentOcr() {
  const entry = ocrTargetEntry();
  const key = ocrRecordKey(entry);
  if (!key || !state.ocr.records.has(key) || state.ocr.running) return;
  state.ocr.records.delete(key);
  state.search.cache.delete(searchCacheKey(entry));
  state.ocr.panelKey = "";
  refreshOcrPanel({ force: true });
  setOcrStatus("Se eliminó el OCR de esta página de la memoria de la sesión.", "info");
  if (state.search.query) scheduleSearchRefresh("Se eliminó texto OCR del índice. Actualizando Buscar…");
  updateOcrControls();
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
  updateResponsiveViewerLayout();
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

function cancelScheduledChannel(channel) {
  renderScheduler.cancelChannel(channel);
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
  cancelSearchWork({ silent: true });
  await cancelCurrentOcr({ silent: true });
  await destroyOcrEngine();
  try {
    state.renderTask?.cancel?.();
  } catch {
    // La tarea puede haber finalizado.
  }
  state.renderTask = null;
  cancelSpreadRenderTasks();
  renderScheduler.clear();
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
  state.ocr.records.clear();
  state.ocr.panelKey = "";
  state.ocr.targetPage = 0;
  clearReadingNavigationLock();
}

async function resetDocument() {
  await destroySources();
  state.file = null;
  resetSearchSession();
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
  viewerLayoutState.lastReadingMode = "continuous";
  viewerLayoutState.readingModeBeforeOrganize = "continuous";
  state.zoomMode = "fit-width";
  state.zoom = 1;
  cancelSpreadRenderTasks();
  state.renderSerial += 1;
  state.thumbnailBuildSerial += 1;
  state.continuousBuildSerial += 1;
  state.thumbnailVirtual = null;
  state.continuousVirtual = null;
  state.organizeVirtual = null;
  organizeGrid.classList.remove("is-virtualized");
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
  [spreadLeftCanvas, spreadRightCanvas].forEach((target) => {
    if (!target) return;
    target.width = 1;
    target.height = 1;
    target.style.width = "1px";
    target.style.height = "1px";
  });
  spreadLeft.hidden = true;
  spreadRight.hidden = true;
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
  diagnosticContext();
}

async function closeCurrentPdf() {
  if (!state.file || state.loading || state.saving) return;
  if (isDocumentChanged()) {
    const confirmed = await confirmDiscardChanges("Hay cambios pendientes que todavía no se han guardado. ¿Quieres cerrar el PDF y descartarlos?");
    if (!confirmed) return;
  }
  const previousName = state.file.name;
  diagEmit("document-close-start", {
    pages: state.pageCount,
    currentPage: state.currentPage,
    selectedPages: state.selectedIds.size,
    sourceDocuments: sourceCountInPlan(),
  });
  await resetDocument();
  diagEmit("document-closed", {});
  setFeedback(`${previousName} se cerró. Ya puedes abrir otro documento.`, "info");
}

async function createSource(file, purpose = "source") {
  const readToken = diagStart("pdf-read", { purpose, fileSizeBytes: Number(file?.size) || null });
  let bytes;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
    diagEnd(readToken, { bytes: bytes.byteLength });
  } catch (error) {
    diagFail(readToken, error, { purpose });
    throw error;
  }

  const loadToken = diagStart("pdfjs-load", { purpose, bytes: bytes.byteLength });
  try {
    const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
    const pdfDocument = await loadingTask.promise;
    if (!pdfDocument.numPages) {
      await pdfDocument.destroy();
      throw new Error("El documento no contiene páginas.");
    }
    const id = `source-${++state.sourceSequence}`;
    const source = { id, file, bytes, pdfDocument };
    state.sources.set(id, source);
    diagEnd(loadToken, { pages: pdfDocument.numPages });
    return source;
  } catch (error) {
    diagFail(loadToken, error, { purpose });
    throw error;
  }
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
  if (state.ocr.running || state.ocr.renderTask) void cancelCurrentOcr({ silent: true });
  pruneOcrRecordsForPlan();
  state.pageCount = state.pagePlan.length;
  state.currentPage = Math.max(1, Math.min(state.currentPage, state.pageCount || 1));
  state.ocr.targetPage = state.pageCount ? normalizedOcrTargetPage() : 0;
  const validIds = new Set(state.pagePlan.map((entry) => entry.id));
  state.selectedIds = new Set([...state.selectedIds].filter((id) => validIds.has(id)));
  state.lastSelectedId = validIds.has(state.lastSelectedId) ? state.lastSelectedId : null;
  state.blankPages.clear();
  blankCount.textContent = "Sin analizar";
  resetProgress();
  buildThumbnailList();
  if (["continuous", "spread"].includes(state.viewMode)) buildContinuousList();
  if (state.viewMode === "organize") buildOrganizeGrid();
  if (!options.skipRender && state.viewMode === "page") renderCurrentPage();
  updateDocumentIdentity();
  updateControls();
  updateSplitPlan();
  scheduleSearchRefreshAfterPlanChange();
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
    const confirmed = await confirmDiscardChanges("Hay cambios pendientes que todavía no se han guardado. ¿Quieres abrir otro PDF y descartarlos?");
    if (!confirmed) return;
  }

  if (state.file) {
    diagEmit("document-replace-start", {
      pages: state.pageCount,
      currentPage: state.currentPage,
      selectedPages: state.selectedIds.size,
      sourceDocuments: sourceCountInPlan(),
    });
  }
  state.loading = true;
  showWorkspace(false);
  await resetDocument();
  diagEmit("document-open-start", { fileSizeBytes: Number(file.size) || null, source: sourceText === "Windows" ? "windows" : "manual" });
  const openDiagnosticToken = diagStart("pdf-open-ready", { fileSizeBytes: Number(file.size) || null });
  state.loading = true;
  state.file = file;
  emptyState.hidden = true;
  viewerShell.hidden = false;
  fileName.textContent = file.name;
  fileDetails.textContent = `${formatBytes(file.size)} · preparando páginas`;
  setLoading(true, "Abriendo el PDF", "El archivo permanece en este equipo.");
  hideFeedback();

  try {
    const source = await createSource(file, "open");
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
    setSearchStatus("Escribe una palabra o frase para buscar en el texto original y el OCR de esta sesión.");
    updateSearchNavigationControls();
    document.title = `${file.name} | PDFPrivado Pro`;
    diagEnd(openDiagnosticToken, { pages: state.pageCount });
    diagEmit("document-open-ready", { pages: state.pageCount, fileSizeBytes: Number(file.size) || null });
    diagnosticContext();
  } catch (error) {
    const detail = String(error?.message || error);
    const message = /password|encrypt/i.test(detail)
      ? "El PDF está protegido con contraseña o cifrado y no puede abrirse en esta versión."
      : `No se pudo abrir ${file.name}. Puede estar dañado o usar una estructura no compatible.`;
    setLoading(true, "No se pudo abrir el PDF", message);
    setFeedback(message, "error");
    diagFail(openDiagnosticToken, error, { stage: "open" });
    diagEmit("document-open-failed", { errorType: error?.name || "Error" });
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
    diagnosticContext();
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
      const source = await createSource(valid[index], "insert");
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
  const previousSlot = canvasRenderSlots.get(targetCanvas);
  let resolveDone;
  const slot = {
    task: null,
    cancelled: false,
    done: new Promise((resolve) => { resolveDone = resolve; }),
    cancel() {
      this.cancelled = true;
      try { this.task?.cancel?.(); } catch { /* la tarea puede haber finalizado */ }
    },
  };
  canvasRenderSlots.set(targetCanvas, slot);

  if (previousSlot) {
    previousSlot.cancel();
    await previousSlot.done;
  }

  const ensureCurrent = () => {
    if (slot.cancelled || canvasRenderSlots.get(targetCanvas) !== slot) {
      throw createRenderingCancelledError();
    }
  };

  let page = null;
  try {
    ensureCurrent();
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

    page = await getPdfPage(entry);
    ensureCurrent();
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
    slot.task = task;
    options.onTask?.(task);
    if (slot.cancelled) task.cancel?.();
    await task.promise;
    ensureCurrent();
    return { width: base.width, height: base.height, scale, task };
  } finally {
    try { page?.cleanup?.(); } catch { /* limpieza defensiva de PDF.js */ }
    resolveDone();
    if (canvasRenderSlots.get(targetCanvas) === slot) {
      canvasRenderSlots.delete(targetCanvas);
    }
  }
}


function adaptiveOutputScale(kind) {
  if (state.pageCount >= 2000) return 1;
  if (state.pageCount >= 500) return kind === "continuous" ? 1.05 : 1.1;
  if (state.pageCount >= 200) return kind === "continuous" ? 1.2 : 1.25;
  if (kind === "thumbnail") return 1.5;
  if (kind === "organize") return 1.4;
  return 1.5;
}

function renderPriority(observed, root, fallbackPage = state.currentPage) {
  const page = Number(observed.target?.dataset?.page) || fallbackPage || 1;
  const rect = observed.boundingClientRect || observed.target?.getBoundingClientRect?.();
  const rootRect = observed.rootBounds || root?.getBoundingClientRect?.();
  const ratio = Number(observed.intersectionRatio) || 0;
  let distance = Math.abs(page - state.currentPage) * 3;
  if (rect && rootRect) {
    const center = (rect.top + rect.bottom) / 2;
    const rootCenter = (rootRect.top + rootRect.bottom) / 2;
    distance += Math.abs(center - rootCenter) / 8;
  }
  return Math.round(2000 * ratio - distance);
}

function releaseRenderedCanvas(node) {
  const target = node?.querySelector?.("canvas");
  if (!target || target.width <= 1) return;
  try { canvasRenderSlots.get(target)?.cancel?.(); } catch { /* limpieza defensiva */ }
  target.width = 1;
  target.height = 1;
  target.dataset.renderedSignature = "";
}

function scheduleIdle(callback) {
  if (typeof window.requestIdleCallback === "function") {
    return window.requestIdleCallback(callback, { timeout: 90 });
  }
  return window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 8 }), 0);
}

function appendCardsProgressively({ serialProperty, container, entries, initialCount, batchSize, createCard, observeCard, onComplete }) {
  const serial = ++state[serialProperty];
  let index = 0;

  const appendBatch = (limit) => {
    if (serial !== state[serialProperty]) return false;
    const fragment = document.createDocumentFragment();
    const added = [];
    const end = Math.min(entries.length, index + limit);
    while (index < end) {
      const card = createCard(entries[index], index + 1);
      fragment.append(card);
      added.push(card);
      index += 1;
    }
    container.append(fragment);
    added.forEach((card) => observeCard?.(card));
    return index < entries.length;
  };

  const hasMore = appendBatch(Math.max(1, initialCount));
  if (!hasMore) {
    onComplete?.();
    return;
  }

  const pump = (deadline) => {
    if (serial !== state[serialProperty]) return;
    let batches = 0;
    while (index < entries.length && batches < 3 && (deadline.didTimeout || deadline.timeRemaining() > 3)) {
      appendBatch(batchSize);
      batches += 1;
    }
    if (index < entries.length) scheduleIdle(pump);
    else onComplete?.();
  };
  scheduleIdle(pump);
}



function isExtremeDocument() {
  return state.pagePlan.length >= state.virtualThreshold;
}

function binarySearchOffset(offsets, value) {
  let low = 0;
  let high = Math.max(0, offsets.length - 1);
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (offsets[mid] <= value) low = mid;
    else high = mid - 1;
  }
  return low;
}

function createVirtualSpacer(className, height) {
  const spacer = document.createElement('div');
  spacer.className = className;
  spacer.style.height = `${Math.max(0, Math.round(height))}px`;
  spacer.setAttribute('aria-hidden', 'true');
  return spacer;
}

function thumbnailStride() {
  return 198;
}

function estimateContinuousStride(entry) {
  let width = Math.max(1, Number(entry?.width) || A4.width);
  let height = Math.max(1, Number(entry?.height) || A4.height);
  if (normalizeRotation(entry?.rotation || 0) % 180 !== 0) [width, height] = [height, width];
  const { width: availableWidth, height: availableHeight } = continuousRenderBounds();
  let scale;
  if (state.zoomMode === 'custom') scale = Math.max(0.1, state.zoom);
  else if (state.zoomMode === 'fit-page') scale = Math.max(0.1, Math.min(availableWidth / width, availableHeight / height));
  else scale = Math.max(0.1, availableWidth / width);
  return Math.max(260, height * scale + 92);
}

function spreadRowStartIndex(index) {
  const bounded = Math.max(0, Math.min(state.pagePlan.length - 1, Number(index) || 0));
  if (state.spreadCoverAlone) {
    if (bounded === 0) return 0;
    return 1 + Math.floor((bounded - 1) / 2) * 2;
  }
  return Math.floor(bounded / 2) * 2;
}

function spreadRowEndIndex(index) {
  const start = spreadRowStartIndex(index);
  if (state.spreadCoverAlone && start === 0) return Math.min(1, state.pagePlan.length);
  return Math.min(state.pagePlan.length, start + 2);
}

function buildContinuousOffsets() {
  const offsets = new Array(state.pagePlan.length + 1).fill(0);
  if (state.viewMode !== "spread") {
    for (let index = 0; index < state.pagePlan.length; index += 1) {
      offsets[index + 1] = offsets[index] + estimateContinuousStride(state.pagePlan[index]);
    }
    return offsets;
  }

  let total = 0;
  let index = 0;
  while (index < state.pagePlan.length) {
    const end = state.spreadCoverAlone && index === 0
      ? 1
      : Math.min(state.pagePlan.length, index + 2);
    let rowHeight = 0;
    for (let pageIndex = index; pageIndex < end; pageIndex += 1) {
      offsets[pageIndex] = total;
      rowHeight = Math.max(rowHeight, estimateContinuousStride(state.pagePlan[pageIndex]));
    }
    total += Math.max(260, rowHeight);
    offsets[end] = total;
    index = end;
  }
  offsets[state.pagePlan.length] = total;
  return offsets;
}

function renderVirtualThumbnailWindow(forcePage = null) {
  const virtual = state.thumbnailVirtual;
  if (!virtual) return;
  const stride = virtual.stride;
  const viewport = Math.max(1, thumbnailList.clientHeight);
  const anchor = forcePage ? Math.max(0, forcePage - 1) : Math.floor(thumbnailList.scrollTop / stride);
  const visibleCount = Math.ceil(viewport / stride);
  const start = Math.max(0, anchor - 8);
  const end = Math.min(state.pagePlan.length, anchor + visibleCount + 12);
  if (virtual.start === start && virtual.end === end) return;
  state.thumbObserver?.disconnect();
  cancelScheduledChannel('thumbnail');
  cancelTaskMap(state.thumbnailTasks);
  const fragment = document.createDocumentFragment();
  fragment.append(createVirtualSpacer('viewer-virtual-spacer viewer-thumbnail-virtual-spacer', start * stride));
  for (let index = start; index < end; index += 1) {
    const card = createThumbnailCard(state.pagePlan[index], index + 1);
    fragment.append(card);
  }
  fragment.append(createVirtualSpacer('viewer-virtual-spacer viewer-thumbnail-virtual-spacer', (state.pagePlan.length - end) * stride));
  thumbnailList.replaceChildren(fragment);
  virtual.start = start;
  virtual.end = end;
  for (const item of thumbnailList.querySelectorAll('.viewer-thumbnail-item')) {
    const page = Number(item.dataset.page) || 1;
    scheduleThumbnail(item.dataset.entryId, 10000 - Math.abs(page - (anchor + 1)) * 10);
  }
  refreshSelectionVisuals();
  thumbnailList.querySelector(`[data-page="${state.currentPage}"]`)?.classList.add('is-current');
  updateOcrTargetVisuals();
  diagEmit('virtual-thumbnail-window', { start: start + 1, end, total: state.pagePlan.length });
}

function renderVirtualContinuousWindow(forcePage = null) {
  const virtual = state.continuousVirtual;
  if (!virtual) return;
  const offsets = virtual.offsets;
  const viewportTop = forcePage ? offsets[Math.max(0, forcePage - 1)] : continuousStage.scrollTop;
  const viewportBottom = viewportTop + Math.max(1, continuousStage.clientHeight);
  let start = Math.max(0, binarySearchOffset(offsets, viewportTop) - 4);
  let end = Math.min(state.pagePlan.length, binarySearchOffset(offsets, viewportBottom) + 6);
  if (end <= start) end = Math.min(state.pagePlan.length, start + 10);
  if (state.viewMode === "spread" && state.pagePlan.length) {
    start = spreadRowStartIndex(start);
    end = spreadRowEndIndex(Math.max(start, end - 1));
  }
  if (virtual.start === start && virtual.end === end) return;
  state.continuousObserver?.disconnect();
  state.readingVisibleNodes.clear();
  cancelScheduledChannel('continuous');
  cancelTaskMap(state.continuousTasks);
  const fragment = document.createDocumentFragment();
  fragment.append(createVirtualSpacer('viewer-virtual-spacer viewer-continuous-virtual-spacer', offsets[start]));
  for (let index = start; index < end; index += 1) fragment.append(createContinuousItem(state.pagePlan[index], index + 1));
  fragment.append(createVirtualSpacer('viewer-virtual-spacer viewer-continuous-virtual-spacer', offsets[state.pagePlan.length] - offsets[end]));
  continuousList.replaceChildren(fragment);
  virtual.start = start;
  virtual.end = end;
  let centerIndex = binarySearchOffset(offsets, viewportTop + continuousStage.clientHeight / 2);
  if (state.viewMode === "spread" && state.pagePlan.length) centerIndex = spreadRowStartIndex(centerIndex);
  const centerPage = Math.max(1, Math.min(state.pagePlan.length, centerIndex + 1));
  for (const item of continuousList.querySelectorAll('.viewer-continuous-page')) {
    const page = Number(item.dataset.page) || 1;
    scheduleContinuousPage(item.dataset.entryId, 10000 - Math.abs(page - centerPage) * 20);
    item.classList.toggle('is-current', page === state.currentPage);
  }
  updateOcrTargetVisuals();
  diagEmit('virtual-continuous-window', { start: start + 1, end, total: state.pagePlan.length, currentPage: state.currentPage });
  scheduleReadingViewportSync();
}

function scrollVirtualThumbnailToPage(page, smooth = false) {
  if (!state.thumbnailVirtual) return false;
  thumbnailList.scrollTo({ top: Math.max(0, page - 1) * state.thumbnailVirtual.stride, behavior: smooth ? 'smooth' : 'auto' });
  renderVirtualThumbnailWindow(page);
  return true;
}

function scrollVirtualContinuousToPage(page, smooth = false) {
  if (!state.continuousVirtual) return false;
  const top = state.continuousVirtual.offsets[Math.max(0, page - 1)] || 0;
  continuousStage.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  renderVirtualContinuousWindow(page);
  return true;
}


function organizeVirtualMetrics() {
  const style = getComputedStyle(organizeGrid);
  const gap = Math.max(0, Number.parseFloat(style.rowGap) || 14);
  const columnGap = Math.max(0, Number.parseFloat(style.columnGap) || gap);
  const paddingLeft = Math.max(0, Number.parseFloat(style.paddingLeft) || 18);
  const paddingRight = Math.max(0, Number.parseFloat(style.paddingRight) || 18);
  const contentWidth = Math.max(168, organizeGrid.clientWidth - paddingLeft - paddingRight);
  const columns = Math.max(1, Math.floor((contentWidth + columnGap) / (168 + columnGap)));
  const cardHeight = 310;
  const rowStride = cardHeight + gap;
  const rows = Math.max(1, Math.ceil(state.pagePlan.length / columns));
  return { gap, columns, cardHeight, rowStride, rows };
}

function clearVirtualOrganizeDropTarget() {
  organizeGrid.querySelectorAll('.viewer-organize-card.is-drop-before, .viewer-organize-card.is-drop-after')
    .forEach((card) => card.classList.remove('is-drop-before', 'is-drop-after'));
}

function renderVirtualOrganizeWindow(forcePage = null) {
  const virtual = state.organizeVirtual;
  if (!virtual) return;
  const metrics = organizeVirtualMetrics();
  const columnsChanged = virtual.columns !== metrics.columns;

  const viewport = Math.max(1, organizeGrid.clientHeight);
  const anchorPage = forcePage
    ? Math.max(1, Math.min(state.pagePlan.length, Number(forcePage) || 1))
    : Math.max(1, Math.min(state.pagePlan.length, Math.floor(organizeGrid.scrollTop / metrics.rowStride) * metrics.columns + 1));
  const anchorRow = Math.floor((anchorPage - 1) / metrics.columns);
  const visibleRows = Math.max(1, Math.ceil(viewport / metrics.rowStride));
  const startRow = Math.max(0, anchorRow - 3);
  const endRow = Math.min(metrics.rows, anchorRow + visibleRows + 5);
  const start = startRow * metrics.columns;
  const end = Math.min(state.pagePlan.length, endRow * metrics.columns);
  if (virtual.start === start && virtual.end === end && !columnsChanged) return;

  state.organizeObserver?.disconnect();
  cancelScheduledChannel('organize');
  cancelTaskMap(state.organizeTasks);

  const space = document.createElement('div');
  space.className = 'viewer-organize-virtual-space';
  space.style.height = `${Math.max(metrics.cardHeight, metrics.rows * metrics.rowStride - metrics.gap)}px`;

  const windowNode = document.createElement('div');
  windowNode.className = 'viewer-organize-virtual-window';
  windowNode.style.top = `${startRow * metrics.rowStride}px`;
  for (let index = start; index < end; index += 1) {
    windowNode.append(createOrganizeCard(state.pagePlan[index], index + 1));
  }
  space.append(windowNode);
  organizeGrid.replaceChildren(space);

  virtual.start = start;
  virtual.end = end;
  virtual.columns = metrics.columns;
  virtual.cardHeight = metrics.cardHeight;
  virtual.rowStride = metrics.rowStride;
  virtual.rows = metrics.rows;

  const centerPage = Math.max(1, Math.min(state.pagePlan.length, anchorRow * metrics.columns + Math.ceil(metrics.columns / 2)));
  for (const card of organizeGrid.querySelectorAll('.viewer-organize-card')) {
    const page = Number(card.dataset.page) || 1;
    scheduleOrganizeCard(card.dataset.entryId, 10000 - Math.abs(page - centerPage) * 10);
  }
  refreshSelectionVisuals();
  organizeGrid.querySelectorAll('.viewer-organize-card.is-current').forEach((node) => node.classList.remove('is-current'));
  organizeGrid.querySelector(`[data-page="${state.currentPage}"]`)?.classList.add('is-current');
  if (state.organizeDrag) {
    for (const card of organizeGrid.querySelectorAll('.viewer-organize-card.is-selected')) {
      card.classList.add('is-dragging');
      card.setAttribute('aria-grabbed', 'true');
    }
  }
  diagEmit('virtual-organize-window', {
    start: start + 1,
    end,
    total: state.pagePlan.length,
    columns: metrics.columns,
    domCards: end - start,
  });
  diagnosticContext();
}

function scrollVirtualOrganizeToPage(page, smooth = false) {
  if (!state.organizeVirtual) return false;
  const metrics = organizeVirtualMetrics();
  const row = Math.floor((Math.max(1, page) - 1) / metrics.columns);
  organizeGrid.scrollTo({ top: row * metrics.rowStride, behavior: smooth ? 'smooth' : 'auto' });
  renderVirtualOrganizeWindow(page);
  return true;
}

function updateVirtualOrganizeDropTarget(target, clientY) {
  const dragState = state.organizeDrag;
  if (!dragState) return;
  clearVirtualOrganizeDropTarget();
  let candidate = target?.candidate || null;
  let placement = target?.placement || 'after';
  if (!candidate) {
    const cards = [...organizeGrid.querySelectorAll('.viewer-organize-card')]
      .filter((card) => !dragState.ids.includes(card.dataset.entryId));
    if (cards.length) {
      candidate = clientY < organizeGrid.getBoundingClientRect().top + organizeGrid.clientHeight / 2 ? cards[0] : cards.at(-1);
      placement = candidate === cards[0] ? 'before' : 'after';
    }
  }
  dragState.dropEntryId = candidate?.dataset.entryId || null;
  dragState.dropPlacement = placement;
  candidate?.classList.add(placement === 'before' ? 'is-drop-before' : 'is-drop-after');
}

function finishVirtualOrganizeReorder(dragState) {
  clearVirtualOrganizeDropTarget();
  const selectedSet = new Set(dragState.ids);
  const moving = state.pagePlan.filter((entry) => selectedSet.has(entry.id));
  const remaining = state.pagePlan.filter((entry) => !selectedSet.has(entry.id));
  if (!moving.length || !remaining.length || !dragState.dropEntryId) {
    refreshSelectionVisuals();
    renderVirtualOrganizeWindow(state.currentPage);
    return;
  }
  const targetIndex = remaining.findIndex((entry) => entry.id === dragState.dropEntryId);
  if (targetIndex < 0) {
    refreshSelectionVisuals();
    renderVirtualOrganizeWindow(state.currentPage);
    return;
  }
  const insertionIndex = targetIndex + (dragState.dropPlacement === 'after' ? 1 : 0);
  const next = [
    ...remaining.slice(0, insertionIndex),
    ...moving,
    ...remaining.slice(insertionIndex),
  ].map((entry) => ({ ...entry }));
  if (next.map((entry) => entry.id).join('|') === dragState.originalOrder.join('|')) {
    refreshSelectionVisuals();
    renderVirtualOrganizeWindow(state.currentPage);
    return;
  }
  state.currentPage = Math.max(1, insertionIndex + 1);
  commitPlan(next, moving.length === 1 ? 'Página movida' : `${moving.length} páginas movidas`);
}

function cancelScheduledRender(channel, entryId, releaseNode = null) {
  renderScheduler.cancel(`${channel}:${entryId}`);
  if (releaseNode) releaseRenderedCanvas(releaseNode);
}

function createThumbnailCard(entry, position) {
  const item = document.createElement("li");
  item.className = "viewer-thumbnail-item";
  item.dataset.entryId = entry.id;
  item.dataset.page = String(position);
  item.classList.toggle("is-selected", state.selectedIds.has(entry.id));

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.className = "viewer-thumbnail-select";
  selectButton.setAttribute("aria-label", `Seleccionar página ${position}`);
  selectButton.setAttribute("aria-pressed", String(state.selectedIds.has(entry.id)));
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
  pageButton.addEventListener("click", () => {
    setOcrTargetFromExplicitPageChoice(position);
    goToPage(position);
  });

  item.append(selectButton, pageButton);
  return item;
}

function buildThumbnailList() {
  const diagnosticToken = diagStart("build-thumbnails", { pages: state.pagePlan.length });
  state.thumbObserver?.disconnect();
  cancelScheduledChannel("thumbnail");
  cancelTaskMap(state.thumbnailTasks);
  thumbnailList.replaceChildren();
  state.thumbnailVirtual = null;

  if (isExtremeDocument()) {
    state.thumbnailVirtual = { stride: thumbnailStride(), start: -1, end: -1 };
    renderVirtualThumbnailWindow(state.currentPage);
    diagEnd(diagnosticToken, { virtualized: true, cards: state.pagePlan.length, domCards: thumbnailList.querySelectorAll('.viewer-thumbnail-item').length });
    diagnosticContext();
    return;
  }

  const renderVisible = (entryId, priority = 0, force = false) => scheduleThumbnail(entryId, priority, force);
  if ("IntersectionObserver" in window) {
    state.thumbObserver = new IntersectionObserver(
      (entries) => entries.forEach((observed) => {
        const entryId = observed.target.dataset.entryId;
        if (observed.isIntersecting) renderVisible(entryId, renderPriority(observed, thumbnailList));
        else cancelScheduledRender("thumbnail", entryId);
      }),
      { root: thumbnailList, rootMargin: "140px 0px", threshold: [0.01, 0.25, 0.6] }
    );
  }

  const initialCount = Math.min(state.pagePlan.length, Math.max(160, state.currentPage + 24));
  appendCardsProgressively({
    serialProperty: "thumbnailBuildSerial",
    container: thumbnailList,
    entries: state.pagePlan,
    initialCount,
    batchSize: 220,
    createCard: createThumbnailCard,
    observeCard: (item) => {
      if (state.thumbObserver) state.thumbObserver.observe(item);
      else if (Number(item.dataset.page) <= 30) renderVisible(item.dataset.entryId, 1000 - Number(item.dataset.page));
    },
    onComplete: () => diagEmit("build-thumbnails-complete", { cards: state.pagePlan.length }),
  });

  refreshSelectionVisuals();
  scrollCurrentThumbnail(false);
  diagEnd(diagnosticToken, { initialCards: initialCount, cards: state.pagePlan.length, progressive: state.pagePlan.length > initialCount });
  diagnosticContext();
}

function scheduleThumbnail(entryId, priority = 0, force = false) {
  const key = `thumbnail:${entryId}`;
  if (force) {
    renderScheduler.cancel(key);
    state.thumbnailTasks.get(entryId)?.cancel?.();
  }
  renderScheduler.enqueue({
    key,
    channel: "thumbnail",
    priority,
    cancel: () => state.thumbnailTasks.get(entryId)?.cancel?.(),
    run: () => performRenderThumbnail(entryId, force),
  });
}

async function performRenderThumbnail(entryId, force = false) {
  const item = thumbnailList.querySelector(`[data-entry-id="${entryId}"]`);
  const target = item?.querySelector("canvas");
  const entry = state.pagePlan.find((candidate) => candidate.id === entryId);
  if (!item || !target || !entry) return;
  const signature = `${entry.kind}:${entry.sourceId || "blank"}:${entry.sourcePage || 0}:${normalizeRotation(entry.rotation || 0)}`;
  if (!force && target.dataset.renderedSignature === signature && target.width > 1) return;
  if (state.thumbnailTasks.has(entryId)) {
    if (!force) return;
    state.thumbnailTasks.get(entryId)?.cancel?.();
  }
  const diagnosticToken = diagStart("render-thumbnail", { page: positionOfId(entryId) });
  const taskHolder = createRenderTaskHolder();
  state.thumbnailTasks.set(entryId, taskHolder);
  diagnosticContext();
  try {
    await renderEntryToCanvas(entry, target, {
      maxWidth: 138,
      maxHeight: 155,
      outputScale: adaptiveOutputScale("thumbnail"),
      onTask: (task) => {
        taskHolder.setTask(task);
        diagnosticContext();
      },
    });
    target.dataset.renderedSignature = signature;
    diagEnd(diagnosticToken, { width: target.width, height: target.height });
  } catch (error) {
    diagFail(diagnosticToken, error, { page: positionOfId(entryId) });
    if (error?.name !== "RenderingCancelledException") throw error;
  } finally {
    if (state.thumbnailTasks.get(entryId) === taskHolder) state.thumbnailTasks.delete(entryId);
    diagnosticContext();
  }
}

function getFitScale(baseWidth, baseHeight) {
  const { width: availableWidth, height: availableHeight } = canvasRenderBounds();
  if (state.zoomMode === "fit-page") return Math.max(0.1, Math.min(availableWidth / baseWidth, availableHeight / baseHeight));
  if (state.zoomMode === "fit-width") return Math.max(0.1, availableWidth / baseWidth);
  return Math.max(0.1, state.zoom);
}

async function renderCurrentPage() {
  if (!state.file || !state.pageCount || state.viewMode !== "page") return;
  const diagnosticToken = diagStart("render-page", { page: state.currentPage });
  const entry = entryAt(state.currentPage);
  if (!entry) return;
  const serial = ++state.renderSerial;
  const renderSignature = pageRenderSignature(entry);
  canvas.dataset.renderedSignature = "";
  try {
    state.renderTask?.cancel?.();
  } catch {
    // La tarea anterior puede haber terminado.
  }
  setLoading(true, `Mostrando página ${state.currentPage}`, "El PDF se representa localmente con PDF.js.");
  let activeTask = null;
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
      onTask: (task) => {
        activeTask = task;
        state.renderTask = task;
      },
    });
    if (serial !== state.renderSerial) return;
    canvas.dataset.renderedSignature = renderSignature;
    pageInput.value = String(state.currentPage);
    pageInfo.textContent = `Página ${state.currentPage} · ${Math.round(result.width)} × ${Math.round(result.height)} pt · ${sourceLabel(entry)}`;
    zoomValue.textContent = `${Math.round(result.scale * 100)} %`;
    setLoading(false);
    centerReadingStageHorizontal();
    diagEnd(diagnosticToken, { width: canvas.width, height: canvas.height });
    refreshCurrentSearchHighlight();
  } catch (error) {
    diagFail(diagnosticToken, error, { page: state.currentPage });
    if (error?.name === "RenderingCancelledException") return;
    setLoading(true, "No se pudo mostrar la página", String(error?.message || error));
  } finally {
    if (state.renderTask === activeTask) state.renderTask = null;
    diagnosticContext();
  }
}

function scrollCurrentThumbnail(smooth = true) {
  if (scrollVirtualThumbnailToPage(state.currentPage, smooth)) return;
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
  [spreadLeft, spreadRight].forEach((node) => {
    node?.classList.toggle("is-current", Number(node.dataset.page) === state.currentPage);
  });
  updateOcrTargetVisuals();
}

function updateOcrTargetVisuals() {
  const targetPage = state.activeTool === "ocr" && state.pageCount
    ? normalizedOcrTargetPage()
    : 0;
  for (const item of thumbnailList?.querySelectorAll?.(".viewer-thumbnail-item") || []) {
    item.classList.toggle("is-ocr-target", Number(item.dataset.page) === targetPage);
  }
  for (const page of continuousList?.querySelectorAll?.(".viewer-continuous-page") || []) {
    page.classList.toggle("is-ocr-target", Number(page.dataset.page) === targetPage);
  }
  [spreadLeft, spreadRight].forEach((node) => {
    node?.classList.toggle("is-ocr-target", Number(node.dataset.page) === targetPage);
  });
  canvasStage?.classList.toggle(
    "is-ocr-target",
    state.viewMode === "page" && targetPage === state.currentPage
  );
}

function readingNavigationLocked() {
  return Boolean(
    state.readingNavigation.targetPage &&
    performance.now() < state.readingNavigation.lockUntil
  );
}

function clearReadingNavigationLock() {
  state.readingNavigation.serial += 1;
  state.readingNavigation.targetPage = 0;
  state.readingNavigation.lockUntil = 0;
  state.readingNavigation.attempts = 0;
  if (state.readingNavigation.syncFrame) {
    window.cancelAnimationFrame(state.readingNavigation.syncFrame);
    state.readingNavigation.syncFrame = 0;
  }
  if (state.readingNavigation.settleTimer) {
    window.clearTimeout(state.readingNavigation.settleTimer);
    state.readingNavigation.settleTimer = 0;
  }
}

function beginReadingNavigation(page, behavior) {
  if (state.readingNavigation.settleTimer) {
    window.clearTimeout(state.readingNavigation.settleTimer);
    state.readingNavigation.settleTimer = 0;
  }
  const smooth = behavior === "smooth";
  const serial = ++state.readingNavigation.serial;
  state.readingNavigation.targetPage = page;
  state.readingNavigation.attempts = 0;
  state.readingNavigation.lockUntil = performance.now() + (smooth ? 2400 : 1600);
  state.readingNavigation.settleTimer = window.setTimeout(
    () => finalizeReadingNavigation(serial),
    smooth ? 2500 : 1700
  );
  return serial;
}

function readingPageCandidates() {
  if (!continuousStage || continuousStage.hidden || !state.pageCount) return [];
  const rootRect = continuousStage.getBoundingClientRect();
  const viewportTop = rootRect.top + 8;
  const viewportBottom = rootRect.bottom - 8;
  const anchorY = viewportTop + Math.max(1, viewportBottom - viewportTop) * 0.38;
  const collect = (nodes) => [...nodes]
    .filter((node) => node?.isConnected)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const intersection = Math.max(0, Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop));
      if (intersection <= 1) return null;
      const containsAnchor = rect.top <= anchorY && rect.bottom >= anchorY;
      const distance = containsAnchor
        ? 0
        : Math.min(Math.abs(anchorY - rect.top), Math.abs(anchorY - rect.bottom));
      return {
        node,
        page: Number(node.dataset.page) || 0,
        rect,
        intersection,
        containsAnchor,
        distance,
      };
    })
    .filter((item) => item?.page);

  const observed = collect(state.readingVisibleNodes);
  if (observed.length) return observed;
  return collect(continuousList.querySelectorAll(".viewer-continuous-page[data-page]"));
}

function detectedVisibleReadingPage() {
  if (!state.pageCount) return 0;
  if (state.viewMode === "page" || state.viewMode === "organize") return state.currentPage;
  if (!["continuous", "spread"].includes(state.viewMode)) return state.currentPage;

  const candidates = readingPageCandidates();
  if (!candidates.length) return state.currentPage;

  const navigationTarget = Number(state.readingNavigation.targetPage) || 0;
  if (readingNavigationLocked()) {
    const locked = candidates.find((item) => item.page === navigationTarget);
    if (locked) return locked.page;
    return state.currentPage;
  }

  const ordered = [...candidates].sort((a, b) => {
    if (a.containsAnchor !== b.containsAnchor) return a.containsAnchor ? -1 : 1;
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.intersection !== b.intersection) return b.intersection - a.intersection;
    return a.page - b.page;
  });
  const best = ordered[0];
  if (!best) return state.currentPage;

  if (state.viewMode === "spread") {
    const row = candidates.filter((item) => Math.abs(item.rect.top - best.rect.top) <= 8);
    const preferred = row.find((item) => item.page === state.currentPage);
    if (preferred) return preferred.page;
    return row.sort((a, b) => a.page - b.page)[0]?.page || best.page;
  }

  return best.page;
}

function syncCurrentPageFromReadingViewport({ force = false } = {}) {
  if (!state.file || !["continuous", "spread"].includes(state.viewMode)) return;
  if (!force && (state.readingNavigation.targetPage || searchNavigationLocked() || state.search.targetPage)) return;

  const page = detectedVisibleReadingPage();
  if (!page || page === state.currentPage) return;

  state.currentPage = page;
  pageInput.value = String(page);
  const entry = entryAt(page);
  pageInfo.textContent = entry ? `Página ${page} · ${sourceLabel(entry)}` : `Página ${page}`;
  updateCurrentVisuals();
  updateControls();
}

function finalizeReadingNavigation(expectedSerial = state.readingNavigation.serial) {
  if (expectedSerial !== state.readingNavigation.serial) return;
  state.readingNavigation.settleTimer = 0;
  const target = state.readingNavigation.targetPage;
  const visibleTarget = target
    ? readingPageCandidates().some((item) => item.page === target && item.containsAnchor)
    : false;

  if (
    target &&
    !visibleTarget &&
    ["continuous", "spread"].includes(state.viewMode) &&
    state.readingNavigation.attempts < 4
  ) {
    state.readingNavigation.attempts += 1;
    state.readingNavigation.lockUntil = performance.now() + 700;
    scrollReadingPageIntoView(target, { behavior: "auto", block: "start" });
    state.readingNavigation.settleTimer = window.setTimeout(
      () => finalizeReadingNavigation(expectedSerial),
      520
    );
    return;
  }

  state.readingNavigation.targetPage = 0;
  state.readingNavigation.lockUntil = 0;
  state.readingNavigation.attempts = 0;
  if (target && visibleTarget) state.currentPage = target;

  if (searchNavigationLocked() || state.search.targetPage) {
    pageInput.value = String(state.currentPage);
    updateCurrentVisuals();
    updateControls();
    return;
  }
  syncCurrentPageFromReadingViewport({ force: true });
}

function scheduleReadingViewportSync() {
  if (!state.file || !["continuous", "spread"].includes(state.viewMode)) return;
  if (!state.readingNavigation.syncFrame) {
    state.readingNavigation.syncFrame = window.requestAnimationFrame(() => {
      state.readingNavigation.syncFrame = 0;
      syncCurrentPageFromReadingViewport();
    });
  }
  if (state.readingNavigation.targetPage) return;
  window.clearTimeout(state.readingNavigation.settleTimer);
  const serial = state.readingNavigation.serial;
  state.readingNavigation.settleTimer = window.setTimeout(
    () => finalizeReadingNavigation(serial),
    180
  );
}

function renderedContinuousScrollTop(page, block = "start") {
  const node = continuousList.querySelector(`[data-page="${page}"]`);
  if (!node) return null;
  const rootRect = continuousStage.getBoundingClientRect();
  const pageRect = node.getBoundingClientRect();
  let top = continuousStage.scrollTop + pageRect.top - rootRect.top - 10;
  if (block === "center") {
    top -= Math.max(0, (rootRect.height - pageRect.height) / 2);
  }
  return Math.max(0, Math.min(top, Math.max(0, continuousStage.scrollHeight - continuousStage.clientHeight)));
}

function scrollReadingPageIntoView(page, { behavior = "smooth", block = "start" } = {}) {
  if (state.continuousVirtual) {
    const estimatedTop = state.continuousVirtual.offsets[Math.max(0, page - 1)] || 0;
    continuousStage.scrollTo({ top: estimatedTop, behavior: "auto" });
    renderVirtualContinuousWindow(page);
  }

  const exactTop = renderedContinuousScrollTop(page, block);
  if (exactTop !== null) {
    continuousStage.scrollTo({ top: exactTop, behavior });
    return true;
  }

  const target = continuousList.querySelector(`[data-page="${page}"]`);
  target?.scrollIntoView({ behavior, block, inline: "center" });
  return Boolean(target);
}

function goToPage(pageNumber, options = {}) {
  if (!state.pageCount) return;
  const page = Math.max(1, Math.min(state.pageCount, Number(pageNumber) || 1));
  const behavior = options.behavior === "auto" ? "auto" : "smooth";
  const block = options.block || (options.searchNavigation ? "center" : "start");
  if (["continuous", "spread"].includes(state.viewMode) && options.scroll !== false) {
    beginReadingNavigation(page, behavior);
  }
  state.currentPage = page;
  pageInput.value = String(page);
  const currentEntry = entryAt(page);
  pageInfo.textContent = currentEntry ? `Página ${page} · ${sourceLabel(currentEntry)}` : `Página ${page}`;
  updateCurrentVisuals();
  const renderPromise = state.viewMode === "page" ? renderCurrentPage() : null;
  if (["continuous", "spread"].includes(state.viewMode) && options.scroll !== false) {
    scrollReadingPageIntoView(page, { behavior, block });
  }
  if (state.viewMode === "organize" && options.scroll !== false) {
    if (!scrollVirtualOrganizeToPage(page, behavior === "smooth")) {
      organizeGrid.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ behavior, block: "nearest" });
    }
  }
  if (!options.searchNavigation) {
    state.search.targetPage = 0;
    state.search.navigationLockUntil = 0;
    if (activeSearchResult()?.page !== page) clearSearchHighlight();
  }
  updateControls();
  return renderPromise;
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
  article.style.minHeight = `${Math.round(estimateContinuousStride(entry))}px`;
  article.dataset.readingReservedHeight = "true";
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
    setOcrTargetFromExplicitPageChoice(position);
    goToPage(position, { scroll: false });
  });
  article.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOcrTargetFromExplicitPageChoice(position);
      goToPage(position, { scroll: false });
    }
  });
  return article;
}

function buildContinuousList() {
  const diagnosticToken = diagStart("build-continuous", { pages: state.pagePlan.length });
  state.continuousObserver?.disconnect();
  state.readingVisibleNodes.clear();
  cancelScheduledChannel("continuous");
  cancelTaskMap(state.continuousTasks);
  continuousList.replaceChildren();
  state.continuousVirtual = null;

  if (isExtremeDocument()) {
    state.continuousVirtual = { offsets: buildContinuousOffsets(), start: -1, end: -1 };
    renderVirtualContinuousWindow(state.currentPage);
    diagEnd(diagnosticToken, { virtualized: true, cards: state.pagePlan.length, domCards: continuousList.querySelectorAll('.viewer-continuous-page').length });
    diagnosticContext();
    return;
  }

  if ("IntersectionObserver" in window) {
    state.continuousObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        entries.forEach((observed) => {
          const entryId = observed.target.dataset.entryId;
          if (observed.isIntersecting) {
            state.readingVisibleNodes.add(observed.target);
            scheduleContinuousPage(entryId, renderPriority(observed, continuousStage));
          } else {
            state.readingVisibleNodes.delete(observed.target);
            cancelScheduledRender("continuous", entryId, observed.target);
          }
        });
        if (visible.length) scheduleReadingViewportSync();
      },
      { root: continuousStage, rootMargin: "240px 0px", threshold: [0.01, 0.35, 0.65] }
    );
  }

  const initialCount = Math.min(state.pagePlan.length, Math.max(48, state.currentPage + 8));
  appendCardsProgressively({
    serialProperty: "continuousBuildSerial",
    container: continuousList,
    entries: state.pagePlan,
    initialCount,
    batchSize: 180,
    createCard: createContinuousItem,
    observeCard: (item) => {
      if (state.continuousObserver) state.continuousObserver.observe(item);
      else if (Number(item.dataset.page) <= 12) scheduleContinuousPage(item.dataset.entryId, 1000 - Number(item.dataset.page));
    },
    onComplete: () => diagEmit("build-continuous-complete", { cards: state.pagePlan.length }),
  });

  updateCurrentVisuals();
  diagEnd(diagnosticToken, { initialCards: initialCount, cards: state.pagePlan.length, progressive: state.pagePlan.length > initialCount });
  diagnosticContext();
}

function scheduleContinuousPage(entryId, priority = 0) {
  renderScheduler.enqueue({
    key: `continuous:${entryId}`,
    channel: "continuous",
    priority,
    cancel: () => state.continuousTasks.get(entryId)?.cancel?.(),
    run: () => performRenderContinuousPage(entryId),
  });
}

async function performRenderContinuousPage(entryId) {
  const item = continuousList.querySelector(`[data-entry-id="${entryId}"]`);
  const target = item?.querySelector("canvas");
  const entry = state.pagePlan.find((candidate) => candidate.id === entryId);
  if (!item || !target || !entry) return;
  const signature = continuousRenderSignature(entry);
  if (target.dataset.renderedSignature === signature && target.width > 1) return;

  const { width: availableWidth, height: availableHeight } = continuousRenderBounds();
  const outputScale = adaptiveOutputScale("continuous");
  const options = state.zoomMode === "custom"
    ? { scale: state.zoom, maxWidth: 100000, maxHeight: 100000, outputScale }
    : state.zoomMode === "fit-page"
      ? { maxWidth: availableWidth, maxHeight: availableHeight, outputScale }
      : { maxWidth: availableWidth, maxHeight: 100000, outputScale };

  if (state.continuousTasks.has(entryId)) return;
  const diagnosticToken = diagStart("render-continuous", { page: Number(item.dataset.page) || positionOfId(entryId) });
  const taskHolder = createRenderTaskHolder();
  state.continuousTasks.set(entryId, taskHolder);
  diagnosticContext();
  options.onTask = (task) => {
    taskHolder.setTask(task);
    diagnosticContext();
  };
  try {
    const result = await renderEntryToCanvas(entry, target, options);
    target.dataset.renderedSignature = signature;
    if (Number(item.dataset.page) === state.currentPage || state.zoomMode === "custom") {
      zoomValue.textContent = `${Math.round(result.scale * 100)} %`;
    }
    centerReadingStageHorizontal();
    const renderedPage = Number(item.dataset.page) || positionOfId(entryId);
    if (
      renderedPage &&
      state.readingNavigation.targetPage === renderedPage &&
      ["continuous", "spread"].includes(state.viewMode)
    ) {
      const navigationSerial = state.readingNavigation.serial;
      window.requestAnimationFrame(() => {
        if (
          navigationSerial === state.readingNavigation.serial &&
          state.readingNavigation.targetPage === renderedPage
        ) {
          scrollReadingPageIntoView(renderedPage, { behavior: "auto", block: "start" });
        }
      });
    }
    diagEnd(diagnosticToken, { width: target.width, height: target.height });
    if (activeSearchResult()?.page === Number(item.dataset.page)) refreshCurrentSearchHighlight();
  } catch (error) {
    diagFail(diagnosticToken, error, { page: Number(item.dataset.page) || positionOfId(entryId) });
    if (error?.name !== "RenderingCancelledException") throw error;
  } finally {
    if (state.continuousTasks.get(entryId) === taskHolder) state.continuousTasks.delete(entryId);
    diagnosticContext();
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
  const candidates = [...organizeGrid.querySelectorAll(".viewer-organize-card")]
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
    virtual: Boolean(state.organizeVirtual),
    dropEntryId: null,
    dropPlacement: "after",
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
  if (dragState.virtual) updateVirtualOrganizeDropTarget(target, event.clientY);
  else moveOrganizeCardsLive(dragState.cards, target.candidate, target.placement);
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

  if (dragState.virtual) {
    finishVirtualOrganizeReorder(dragState);
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
  if (event.button !== 0 || state.loading || state.saving || event.target.closest?.('.viewer-organize-card, button')) return;
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
  for (const card of organizeGrid.querySelectorAll(".viewer-organize-card")) {
    if (marqueeIntersection(selectionRect, card.getBoundingClientRect())) next.add(card.dataset.entryId);
  }
  state.selectedIds = next;
  refreshSelectionVisuals();
  selectedCount.textContent = String(state.selectedIds.size);
  organizeSummary.textContent = organizeSummaryLabel();
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
  const diagnosticToken = diagStart("build-organize", { pages: state.pagePlan.length });
  state.organizeObserver?.disconnect();
  cancelScheduledChannel("organize");
  cancelTaskMap(state.organizeTasks);
  organizeGrid.replaceChildren();
  state.organizeVirtual = null;
  organizeGrid.classList.remove('is-virtualized');
  organizeSummary.textContent = organizeSummaryLabel();

  if (isExtremeDocument()) {
    state.organizeVirtual = { start: -1, end: -1, columns: 0, cardHeight: 310, rowStride: 324, rows: 0 };
    organizeGrid.classList.add('is-virtualized');
    const metrics = organizeVirtualMetrics();
    const currentRow = Math.floor((Math.max(1, state.currentPage) - 1) / metrics.columns);
    renderVirtualOrganizeWindow(state.currentPage);
    organizeGrid.scrollTop = currentRow * metrics.rowStride;
    diagEnd(diagnosticToken, {
      virtualized: true,
      cards: state.pagePlan.length,
      domCards: organizeGrid.querySelectorAll('.viewer-organize-card').length,
    });
    diagnosticContext();
    return;
  }

  const fragment = document.createDocumentFragment();
  state.pagePlan.forEach((entry, index) => fragment.append(createOrganizeCard(entry, index + 1)));
  organizeGrid.append(fragment);
  if ("IntersectionObserver" in window) {
    state.organizeObserver = new IntersectionObserver(
      (entries) => entries.forEach((observed) => {
        const entryId = observed.target.dataset.entryId;
        if (observed.isIntersecting) scheduleOrganizeCard(entryId, renderPriority(observed, organizeStage));
        else cancelScheduledRender("organize", entryId, observed.target);
      }),
      { root: organizeStage, rootMargin: "220px 0px", threshold: [0.01, 0.3, 0.6] }
    );
    organizeGrid.querySelectorAll(".viewer-organize-card").forEach((item) => state.organizeObserver.observe(item));
  }
  refreshSelectionVisuals();
  updateCurrentVisuals();
  diagEnd(diagnosticToken, { cards: state.pagePlan.length });
  diagnosticContext();
}

function scheduleOrganizeCard(entryId, priority = 0) {
  renderScheduler.enqueue({
    key: `organize:${entryId}`,
    channel: "organize",
    priority,
    cancel: () => state.organizeTasks.get(entryId)?.cancel?.(),
    run: () => performRenderOrganizeCard(entryId),
  });
}

async function performRenderOrganizeCard(entryId) {
  const card = organizeGrid.querySelector(`[data-entry-id="${entryId}"]`);
  const target = card?.querySelector("canvas");
  const position = positionOfId(entryId);
  const entry = position ? entryAt(position) : null;
  if (!card || !target || !entry) return;
  const signature = `${entry.id}:${normalizeRotation(entry.rotation || 0)}`;
  if (target.dataset.renderedSignature === signature && target.width > 1) return;
  if (state.organizeTasks.has(entryId)) return;
  const diagnosticToken = diagStart("render-organize", { page: positionOfId(entryId) });
  const taskHolder = createRenderTaskHolder();
  state.organizeTasks.set(entryId, taskHolder);
  diagnosticContext();
  try {
    await renderEntryToCanvas(entry, target, {
      maxWidth: 190,
      maxHeight: 230,
      outputScale: adaptiveOutputScale("organize"),
      onTask: (task) => {
        taskHolder.setTask(task);
        diagnosticContext();
      },
    });
    target.dataset.renderedSignature = signature;
    diagEnd(diagnosticToken, { width: target.width, height: target.height });
  } catch (error) {
    diagFail(diagnosticToken, error, { page: positionOfId(entryId) });
    if (error?.name !== "RenderingCancelledException") throw error;
  } finally {
    if (state.organizeTasks.get(entryId) === taskHolder) state.organizeTasks.delete(entryId);
    diagnosticContext();
  }
}

function switchReadingMode(mode) {
  if (state.viewMode === "organize" && state.activeTool === "organize") {
    activateTool("overview");
  }
  setViewMode(mode);
}

function setViewMode(mode, rebuild = true) {
  clearSearchHighlight();
  clearReadingNavigationLock();
  const before = {
    viewMode: state.viewMode,
    currentPage: state.currentPage,
    selectedPages: state.selectedIds.size,
    activeTool: state.activeTool,
  };
  const resolvedMode = ["continuous", "page", "spread", "organize"].includes(mode) ? mode : "continuous";

  if (state.viewMode === "page" && resolvedMode !== "page") {
    try { state.renderTask?.cancel?.(); } catch { /* la tarea puede haber terminado */ }
    state.renderTask = null;
    state.renderSerial += 1;
  }
  if (state.viewMode === "spread" && resolvedMode !== "spread") {
    cancelSpreadRenderTasks();
  }
  if (!["continuous", "spread"].includes(resolvedMode)) {
    state.continuousObserver?.disconnect();
    state.readingVisibleNodes.clear();
    cancelScheduledChannel("continuous");
    cancelTaskMap(state.continuousTasks);
  }
  if (resolvedMode !== "organize") {
    state.organizeObserver?.disconnect();
    cancelScheduledChannel("organize");
    cancelTaskMap(state.organizeTasks);
  }

  if (resolvedMode === "organize" && ["continuous", "page", "spread"].includes(state.viewMode)) {
    viewerLayoutState.readingModeBeforeOrganize = state.viewMode;
  }

  state.viewMode = resolvedMode;
  if (["continuous", "page", "spread"].includes(resolvedMode)) {
    viewerLayoutState.lastReadingMode = resolvedMode;
    persistViewerLayoutPreferences();
  }

  viewerLayoutState.organizeThumbnailsOverride = null;
  viewerLayoutState.organizeToolsOverride = null;
  canvasStage.hidden = resolvedMode !== "page";
  continuousStage.hidden = !["continuous", "spread"].includes(resolvedMode);
  spreadStage.hidden = true;
  organizeStage.hidden = resolvedMode !== "organize";
  document.body.classList.toggle("viewer-organize-active", resolvedMode === "organize");
  if (!state.loading) setLoading(false);
  applyViewerPanelLayout();

  if (rebuild && state.file) {
    if (["continuous", "spread"].includes(resolvedMode)) {
      const page = state.currentPage;
      buildContinuousList();
      requestAnimationFrame(() => {
        beginReadingNavigation(page, "auto");
        scrollReadingPageIntoView(page, { behavior: "auto", block: "start" });
        centerReadingStageHorizontal(true);
      });
    } else if (resolvedMode === "page") {
      renderCurrentPage();
    } else if (resolvedMode === "organize") {
      buildOrganizeGrid();
    }
  }

  updateControls();
  const after = {
    viewMode: state.viewMode,
    currentPage: state.currentPage,
    selectedPages: state.selectedIds.size,
    activeTool: state.activeTool,
  };
  const passed =
    before.currentPage === after.currentPage &&
    before.selectedPages === after.selectedPages &&
    after.viewMode === resolvedMode;
  diagEmit("state-check", { operation: "view-change", passed, before, after });
  diagnosticContext();
}


const APP_TOOL_REGISTRY = Object.freeze({
  overview: { label: "Inicio" },
  search: { label: "Buscar texto" },
  ocr: { label: "OCR local" },
  organize: { label: "Organizar páginas" },
  rotate: { label: "Rotar páginas" },
  split: { label: "Dividir PDF" },
  merge: { label: "Añadir otro PDF" },
  save: { label: "Opciones de guardado" },
});

function closeAppMenus(except = null) {
  appMenus.forEach((menu) => {
    if (menu === except) return;
    menu.classList.remove("is-open");
    const trigger = menu.querySelector(".app-menu-trigger");
    const dropdown = menu.querySelector(".app-menu-dropdown");
    trigger?.setAttribute("aria-expanded", "false");
    if (dropdown) dropdown.hidden = true;
  });
}

function toggleAppMenu(menu) {
  const opening = !menu.classList.contains("is-open");
  closeAppMenus(menu);
  menu.classList.toggle("is-open", opening);
  const trigger = menu.querySelector(".app-menu-trigger");
  const dropdown = menu.querySelector(".app-menu-dropdown");
  trigger?.setAttribute("aria-expanded", String(opening));
  if (dropdown) dropdown.hidden = !opening;
}

function updateAppMenuState() {
  const hasDocument = Boolean(state.file && state.pageCount);
  if (appMenuDocument) {
    appMenuDocument.textContent = hasDocument
      ? `${state.file?.name || "Documento PDF"} · ${state.pageCount} ${state.pageCount === 1 ? "página" : "páginas"}`
      : "Ningún PDF abierto";
  }

  const targetMap = {
    save: saveButton,
    close: closeFileButton,
    undo: undoButton,
    redo: redoButton,
    "view-continuous": modeContinuousButton,
    "view-page": modePageButton,
    "view-spread": modeSpreadButton,
    "fit-width": fitWidthButton,
    "fit-page": fitPageButton,
    "toggle-thumbnails": toggleThumbnailsButton,
    "toggle-tools": toggleToolsButton,
  };
  appMenuCommands.forEach((item) => {
    const target = targetMap[item.dataset.appCommand];
    if (target) item.disabled = Boolean(target.disabled || target.hidden);
  });
  appMenuTools.forEach((item) => {
    item.disabled = !hasDocument || !APP_TOOL_REGISTRY[item.dataset.appTool];
    item.classList.toggle("is-active", item.dataset.appTool === state.activeTool);
  });
}

function runAppMenuCommand(command) {
  const click = (element) => {
    if (!element || element.disabled || element.hidden) return;
    element.click();
  };
  const commands = {
    open: () => click(openFileButton),
    save: () => click(saveButton),
    close: () => click(closeFileButton),
    undo: () => click(undoButton),
    redo: () => click(redoButton),
    "view-continuous": () => click(modeContinuousButton),
    "view-page": () => click(modePageButton),
    "view-spread": () => click(modeSpreadButton),
    "fit-width": () => click(fitWidthButton),
    "fit-page": () => click(fitPageButton),
    "toggle-thumbnails": () => click(toggleThumbnailsButton),
    "toggle-tools": () => click(toggleToolsButton),
    privacy: () => {
      showFeedback("Privacidad real: los documentos se procesan en este equipo, sin CDN, telemetría ni servidores ocultos.", "success");
    },
    shortcuts: () => {
      showFeedback("Atajos: Ctrl+O abrir · Ctrl+F buscar · Ctrl+Z deshacer · Ctrl+Y rehacer · Ctrl+Mayús+S guardar copia.", "success");
    },
  };
  commands[command]?.();
  updateAppMenuState();
}

function initializeAppMenu() {
  if (!appMenuBar) return;
  appMenus.forEach((menu) => {
    const trigger = menu.querySelector(".app-menu-trigger");
    trigger?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleAppMenu(menu);
    });
    trigger?.addEventListener("pointerenter", () => {
      if (appMenus.some((candidate) => candidate.classList.contains("is-open"))) toggleAppMenu(menu);
    });
  });
  appMenuCommands.forEach((item) => item.addEventListener("click", () => {
    if (!item.disabled) runAppMenuCommand(item.dataset.appCommand);
    closeAppMenus();
  }));
  appMenuTools.forEach((item) => item.addEventListener("click", () => {
    const tool = item.dataset.appTool;
    if (!item.disabled && APP_TOOL_REGISTRY[tool]) activateTool(tool);
    closeAppMenus();
  }));
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("#app-menu-bar")) closeAppMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAppMenus();
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      runAppMenuCommand("save");
    }
    if (event.ctrlKey && event.key.toLowerCase() === "w") {
      event.preventDefault();
      runAppMenuCommand("close");
    }
  });
  updateAppMenuState();
}

function activateTool(name) {
  const before = { activeTool: state.activeTool, viewMode: state.viewMode, currentPage: state.currentPage, selectedPages: state.selectedIds.size };
  const enteringOrganize = Boolean(state.file && name === "organize" && state.viewMode !== "organize");
  const leavingOrganizeForOverview = name === "overview" && state.viewMode === "organize";

  if (enteringOrganize) {
    viewerLayoutState.readingModeBeforeOrganize = ["continuous", "page", "spread"].includes(state.viewMode)
      ? state.viewMode
      : viewerLayoutState.lastReadingMode;
    viewerLayoutState.organizeReturnTool =
      state.activeTool && state.activeTool !== "organize" ? state.activeTool : "overview";
  } else if (state.viewMode === "organize" && !["overview", "organize"].includes(name)) {
    // Si se trabaja con una herramienta contextual sobre la cuadrícula,
    // volver a lectura recuperará esa herramienta y su panel.
    viewerLayoutState.organizeReturnTool = name;
  }

  state.activeTool = name;
  updateAppMenuState();
  if (toolsHeadingTitle) {
    toolsHeadingTitle.textContent = APP_TOOL_REGISTRY[name]?.label || "Herramientas";
  }
  toolTabs.forEach((button) => button.classList.toggle("is-active", button.dataset.viewerTool === name));
  toolPanels.forEach((panel) => {
    const active = panel.dataset.viewerToolPanel === name;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });

  // Organizar es un espacio de trabajo de ancho completo. Sus raíles siguen
  // disponibles, pero los paneles se pliegan temporalmente para no duplicar
  // la cuadrícula. Inicio sí devuelve al modo de lectura.
  if (enteringOrganize) {
    setViewMode("organize");
  } else if (leavingOrganizeForOverview) {
    setViewMode(viewerLayoutState.readingModeBeforeOrganize || viewerLayoutState.lastReadingMode || "continuous");
  }

  viewerLayoutState.contextualToolsOverride = null;
  if (state.viewMode === "organize") {
    viewerLayoutState.organizeToolsOverride = ["overview", "organize"].includes(name) ? null : false;
  }
  applyViewerPanelLayout();
  scheduleViewerLayoutRefresh();

  if (name === "split") updateSplitPlan();
  if (name === "search") {
    requestAnimationFrame(() => searchInput?.focus({ preventScroll: true }));
  }
  if (name === "ocr") {
    if (!state.ocr.targetPage && state.pageCount) state.ocr.targetPage = normalizedOcrTargetPage(state.currentPage);
    refreshOcrPanel({ force: true });
    requestAnimationFrame(() => ocrPageNumberInput?.focus({ preventScroll: true }));
  }
  document.querySelector(`.viewer-tool-panel[data-viewer-tool-panel="${name}"]`)?.scrollTo?.({ top: 0 });
  updateOcrTargetVisuals();
  const after = { activeTool: state.activeTool, viewMode: state.viewMode, currentPage: state.currentPage, selectedPages: state.selectedIds.size };
  const expectedView = enteringOrganize
    ? "organize"
    : leavingOrganizeForOverview
      ? (viewerLayoutState.readingModeBeforeOrganize || viewerLayoutState.lastReadingMode || "continuous")
      : before.viewMode;
  const passed = before.currentPage === after.currentPage && before.selectedPages === after.selectedPages && after.viewMode === expectedView;
  diagEmit("state-check", { operation: "tool-change", passed, before, after });
  diagnosticContext();
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
  organizeSummary.textContent = organizeSummaryLabel(selected);
  pageTotal.textContent = `/ ${state.pageCount || 0}`;
  pageInput.max = String(state.pageCount || 1);
  previousButton.disabled = !ready || state.currentPage <= 1;
  nextButton.disabled = !ready || state.currentPage >= state.pageCount;
  pageInput.disabled = !ready;
  const readingView = ready && ["continuous", "page", "spread"].includes(state.viewMode);
  zoomOutButton.disabled = !readingView;
  zoomInButton.disabled = !readingView;
  fitWidthButton.disabled = !readingView;
  fitPageButton.disabled = !readingView;
  modeContinuousButton.disabled = !ready;
  modePageButton.disabled = !ready;
  modeSpreadButton.disabled = !ready;
  spreadCoverButton.disabled = !ready || state.viewMode !== "spread";
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
  modeContinuousButton.classList.toggle("is-active", state.viewMode === "continuous");
  modePageButton.classList.toggle("is-active", state.viewMode === "page");
  modeSpreadButton.classList.toggle("is-active", state.viewMode === "spread");
  spreadCoverButton.classList.toggle("is-active", state.spreadCoverAlone);
  modeContinuousButton.setAttribute("aria-pressed", String(state.viewMode === "continuous"));
  modePageButton.setAttribute("aria-pressed", String(state.viewMode === "page"));
  modeSpreadButton.setAttribute("aria-pressed", String(state.viewMode === "spread"));
  spreadCoverButton.setAttribute("aria-pressed", String(state.spreadCoverAlone));
  const coverLabel = state.spreadCoverAlone
    ? "Portada separada activada: página 1 sola; después 2-3, 4-5…"
    : "Portada separada desactivada: parejas 1-2, 3-4, 5-6…";
  spreadCoverButton.title = coverLabel;
  spreadCoverButton.setAttribute("aria-label", coverLabel);
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
  updateSearchNavigationControls();
  updateOcrControls();
  applyViewerPanelLayout();
  diagnosticContext();
}

function refreshReadingView() {
  if (!state.file) return;
  if (["continuous", "spread"].includes(state.viewMode)) {
    const page = state.currentPage;
    buildContinuousList();
    requestAnimationFrame(() => {
      beginReadingNavigation(page, "auto");
      scrollReadingPageIntoView(page, { behavior: "auto", block: "start" });
      centerReadingStageHorizontal(true);
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
  if (!["continuous", "spread"].includes(state.viewMode) || event.button !== 0 || !state.file) return;
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
previousButton?.addEventListener("click", () => goToPage(readingNavigationTarget(-1)));
nextButton?.addEventListener("click", () => goToPage(readingNavigationTarget(1)));
pageInput?.addEventListener("change", () => goToPage(pageInput.value, { behavior: "auto" }));
pageInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    goToPage(pageInput.value, { behavior: "auto" });
  }
});
modeContinuousButton?.addEventListener("click", () => switchReadingMode("continuous"));
modePageButton?.addEventListener("click", () => switchReadingMode("page"));
modeSpreadButton?.addEventListener("click", () => switchReadingMode("spread"));
spreadCoverButton?.addEventListener("click", () => {
  state.spreadCoverAlone = !state.spreadCoverAlone;
  persistViewerLayoutPreferences();
  applyViewerPanelLayout();
  if (state.viewMode === "spread") {
    const page = state.currentPage;
    buildContinuousList();
    requestAnimationFrame(() => {
      beginReadingNavigation(page, "auto");
      scrollReadingPageIntoView(page, { behavior: "auto", block: "start" });
    });
  }
  updateControls();
});
zoomOutButton?.addEventListener("click", () => setCustomZoom((state.zoomMode === "custom" ? state.zoom : parseInt(zoomValue.textContent, 10) / 100) - 0.15));
zoomInButton?.addEventListener("click", () => setCustomZoom((state.zoomMode === "custom" ? state.zoom : parseInt(zoomValue.textContent, 10) / 100) + 0.15));
fitWidthButton?.addEventListener("click", () => {
  state.zoomMode = "fit-width";
  refreshReadingView();
  updateControls();
  centerReadingStageHorizontal(true);
});
fitPageButton?.addEventListener("click", () => {
  state.zoomMode = "fit-page";
  refreshReadingView();
  updateControls();
  centerReadingStageHorizontal(true);
});
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
searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  runDocumentSearch();
});
searchInput?.addEventListener("input", updateSearchNavigationControls);
searchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    clearSearch();
  }
});
searchClearButton?.addEventListener("click", () => clearSearch());
searchPreviousButton?.addEventListener("click", () => navigateSearchResults(-1));
searchNextButton?.addEventListener("click", () => navigateSearchResults(1));
searchCancelButton?.addEventListener("click", () => cancelSearchWork());
ocrStartButton?.addEventListener("click", recognizeCurrentPage);
ocrCancelButton?.addEventListener("click", () => cancelCurrentOcr());
ocrClearButton?.addEventListener("click", clearCurrentOcr);
ocrPagePreviousButton?.addEventListener("click", () => {
  const page = normalizedOcrTargetPage() - 1;
  setOcrTargetPage(page, { navigate: true, announce: true });
});
ocrPageNextButton?.addEventListener("click", () => {
  const page = normalizedOcrTargetPage() + 1;
  setOcrTargetPage(page, { navigate: true, announce: true });
});
ocrUseVisibleButton?.addEventListener("click", () => chooseVisiblePageForOcr({ announce: true }));
ocrPageNumberInput?.addEventListener("change", () => {
  setOcrTargetPage(ocrPageNumberInput.value, { navigate: true, announce: true });
});
ocrPageNumberInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    setOcrTargetPage(ocrPageNumberInput.value, { navigate: true, announce: true });
  }
});
ocrLanguage?.addEventListener("change", () => {
  syncOcrLanguageSelectors({ announce: true });
});
ocrLanguageSecondary?.addEventListener("change", () => {
  syncOcrLanguageSelectors({ announce: true });
});
ocrScope?.addEventListener("change", () => {
  updateOcrControls();
  const scope = selectedOcrBatchScope();
  const count = ocrBatchPages(scope).length;
  setOcrStatus(
    scope === "current"
      ? "OCR preparado para la página elegida."
      : scope === "without-text"
        ? `OCR preparado para revisar ${count} páginas y procesar solo las que no tengan texto.`
        : `OCR preparado para recorrer ${count} páginas del documento.`
  );
});
ocrReprocess?.addEventListener("change", () => {
  state.ocr.batchReprocess = Boolean(ocrReprocess.checked);
  updateOcrControls();
});
toolTabs.forEach((button) => button.addEventListener("click", () => activateTool(button.dataset.viewerTool)));
toolLinks.forEach((button) => button.addEventListener("click", () => activateTool(button.dataset.activateTool)));
openOrganizeButton?.addEventListener("click", () => {
  if (state.viewMode === "organize") {
    const returnTool = viewerLayoutState.organizeReturnTool || "overview";
    setViewMode(viewerLayoutState.readingModeBeforeOrganize || viewerLayoutState.lastReadingMode || "continuous");
    activateTool(returnTool === "organize" ? "overview" : returnTool);
    return;
  }
  activateTool("organize");
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
continuousStage?.addEventListener("pointerdown", (event) => {
  releasePinnedSearchNavigation();
  clearReadingNavigationLock();
  handleContinuousPanStart(event);
});
continuousStage?.addEventListener("pointermove", handleContinuousPanMove);
continuousStage?.addEventListener("pointerup", handleContinuousPanEnd);
continuousStage?.addEventListener("pointercancel", handleContinuousPanEnd);
spreadStage?.addEventListener("click", (event) => {
  const pageNode = event.target.closest?.(".viewer-spread-page[data-page]");
  const page = Number(pageNode?.dataset.page);
  if (Number.isInteger(page) && page >= 1 && page <= state.pageCount) {
    setOcrTargetFromExplicitPageChoice(page);
    goToPage(page, { scroll: false });
  }
});
organizeStage?.addEventListener("pointermove", moveOrganizeCardPointer);
organizeStage?.addEventListener("pointerup", (event) => finishOrganizeCardPointer(event, false));
organizeStage?.addEventListener("pointercancel", (event) => finishOrganizeCardPointer(event, true));
organizeGrid?.addEventListener("pointerdown", beginOrganizeMarquee);
organizeGrid?.addEventListener("pointermove", moveOrganizeMarquee);
organizeGrid?.addEventListener("pointerup", (event) => finishOrganizeMarquee(event, false));
organizeGrid?.addEventListener("pointercancel", (event) => finishOrganizeMarquee(event, true));
const pauseQueuedRenderingDuringScroll = () => renderScheduler.pauseFor(115);
const releasePinnedSearchNavigation = () => {
  if (!state.search.targetPage && !state.search.positioning) return;
  state.search.navigationSerial += 1;
  state.search.positioning = false;
  state.search.targetPage = 0;
  state.search.navigationLockUntil = 0;
};
thumbnailList?.addEventListener("scroll", pauseQueuedRenderingDuringScroll, { passive: true });
thumbnailList?.addEventListener("scroll", () => {
  if (state.thumbnailVirtual) renderVirtualThumbnailWindow();
}, { passive: true });
continuousStage?.addEventListener("scroll", () => {
  if (state.continuousVirtual) renderVirtualContinuousWindow();
  scheduleReadingViewportSync();
}, { passive: true });
continuousStage?.addEventListener("scroll", pauseQueuedRenderingDuringScroll, { passive: true });
organizeGrid?.addEventListener("scroll", () => {
  if (state.organizeVirtual) renderVirtualOrganizeWindow();
}, { passive: true });
organizeGrid?.addEventListener("scroll", pauseQueuedRenderingDuringScroll, { passive: true });
window.addEventListener("resize", () => {
  if (state.organizeVirtual && state.viewMode === "organize") renderVirtualOrganizeWindow(state.currentPage);
});

let viewerWheelZoomDelta = 0;
let viewerWheelZoomTimer = 0;

function queueViewerZoomFromWheel(event) {
  event.preventDefault();
  viewerWheelZoomDelta += Math.max(-160, Math.min(160, Number(event.deltaY) || 0));
  window.clearTimeout(viewerWheelZoomTimer);
  viewerWheelZoomTimer = window.setTimeout(() => {
    const current = state.zoomMode === "custom"
      ? state.zoom
      : (Number.parseInt(zoomValue.textContent, 10) || 100) / 100;
    const delta = Math.max(-260, Math.min(260, viewerWheelZoomDelta));
    viewerWheelZoomDelta = 0;
    const factor = Math.exp(-delta * 0.0016);
    setCustomZoom(current * factor);
  }, 48);
}

continuousStage?.addEventListener("wheel", (event) => {
  if (!state.file || !["continuous", "spread"].includes(state.viewMode)) return;
  if (!event.ctrlKey) {
    releasePinnedSearchNavigation();
    clearReadingNavigationLock();
    return;
  }
  queueViewerZoomFromWheel(event);
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
    queueViewerZoomFromWheel(event);
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

spreadStage?.addEventListener("dblclick", (event) => {
  if (!state.file || event.target.closest?.(".viewer-spread-label")) return;
  if (state.zoomMode === "fit-page") setCustomZoom(1.25);
  else {
    state.zoomMode = "fit-page";
    renderSpread();
    updateControls();
  }
});
spreadStage?.addEventListener("wheel", (event) => {
  if (!state.file || state.viewMode !== "spread") return;
  if (event.ctrlKey) {
    queueViewerZoomFromWheel(event);
    return;
  }
  const now = Date.now();
  if (now - state.wheelTimestamp < 260) return;
  const atBottom = spreadStage.scrollTop + spreadStage.clientHeight >= spreadStage.scrollHeight - 3;
  const atTop = spreadStage.scrollTop <= 3;
  const noVerticalScroll = spreadStage.scrollHeight <= spreadStage.clientHeight + 3;
  if ((event.deltaY > 0 && (atBottom || noVerticalScroll)) || (event.deltaY < 0 && (atTop || noVerticalScroll))) {
    event.preventDefault();
    state.wheelTimestamp = now;
    goToPage(readingNavigationTarget(event.deltaY > 0 ? 1 : -1));
  }
}, { passive: false });

window.addEventListener("resize", () => {
  updateResponsiveViewerLayout();
  scheduleViewerLayoutRefresh();
});

toggleThumbnailsButton?.addEventListener("click", () => toggleViewerPanel("thumbnails"));
toggleToolsButton?.addEventListener("click", () => toggleViewerPanel("tools"));

if ("ResizeObserver" in window) {
  const viewerResizeObserver = new ResizeObserver(() => {
    updateResponsiveViewerLayout();
    scheduleViewerLayoutRefresh();
  });
  [viewerShell, canvasStage, continuousStage, spreadStage].forEach((element) => {
    if (element) viewerResizeObserver.observe(element);
  });
}

window.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === "o") {
    event.preventDefault();
    showWorkspace(false);
    openFilePicker();
    return;
  }
  if (event.ctrlKey && event.key.toLowerCase() === "f" && !viewerView.hidden) {
    event.preventDefault();
    activateTool("search");
    requestAnimationFrame(() => {
      searchInput?.focus({ preventScroll: true });
      searchInput?.select?.();
    });
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
    refreshReadingView();
    updateControls();
  } else if (!editing && (event.key === "ArrowRight" || event.key === "PageDown")) {
    event.preventDefault();
    goToPage(readingNavigationTarget(1));
  } else if (!editing && (event.key === "ArrowLeft" || event.key === "PageUp")) {
    event.preventDefault();
    goToPage(readingNavigationTarget(-1));
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

window.addEventListener("pdfprivado:diagnostics-request-context", diagnosticContext);
ocrLanguageImportPreviewButton?.addEventListener("click", selectAndValidateOcrLanguagePackage);
ocrLanguageInstallButton?.addEventListener("click", installPendingOcrLanguagePackage);
ocrLanguageInstalledList?.addEventListener("click", (event) => {
  const testButton = event.target.closest("[data-test-ocr-language]");
  if (testButton) {
    testInstalledOcrLanguagePackage(testButton.dataset.testOcrLanguage);
    return;
  }

  const removeButton = event.target.closest("[data-remove-ocr-language]");
  if (!removeButton) return;
  removeInstalledOcrLanguagePackage(removeButton.dataset.removeOcrLanguage);
});

rebuildOcrLanguageSelectors({ preserve: false });
initializeOcrLanguagePackageManager();
initializeAppMenu();
if (fileName) {
  new MutationObserver(updateAppMenuState).observe(fileName, { childList: true, characterData: true, subtree: true });
}
updateResponsiveViewerLayout();
applyViewerPanelLayout();
updateScopeControls();
activateTool("overview");
setViewMode("continuous", false);
resetSearchSession();
updateControls();
updateSplitPlan();
initializeNativeOpenHandling();
