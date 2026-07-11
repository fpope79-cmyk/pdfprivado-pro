const STORAGE_KEY = "pdfprivado-diagnostics-panel-open";
const MAX_EVENTS = 600;
const MAX_ERRORS = 120;
const MAX_MEMORY_SAMPLES = 120;
const MAX_SCROLL_SAMPLES = 80;
const MAX_DOCUMENT_RUNS = 20;
const MEMORY_SAMPLE_INTERVAL_MS = 5000;
const SLOW_RENDER_MS = 180;
const MB = 1024 * 1024;

const now = () => performance.now();
const isoNow = () => new Date().toISOString();
const round = (value, decimals = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
};

function formatDuration(value) {
  if (!Number.isFinite(value)) return "—";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} s`;
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${Math.round(value)} B`;
  const units = ["KB", "MB", "GB"];
  let amount = value / 1024;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount.toFixed(amount >= 100 ? 0 : 1)} ${units[index]}`;
}

function classifyFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "desconocido";
  if (bytes < 10 * MB) return "pequeño";
  if (bytes < 50 * MB) return "medio";
  if (bytes < 200 * MB) return "grande";
  return "muy grande";
}

function classifyPageCount(pages) {
  if (!Number.isFinite(pages) || pages <= 0) return "desconocido";
  if (pages <= 30) return "pequeño";
  if (pages <= 150) return "medio";
  if (pages <= 600) return "grande";
  return "muy grande";
}

const blockedDetailKey = /(?:name|nombre|path|ruta|content|contenido|text|texto|password|contrase)/i;

function sanitizeString(value) {
  return String(value)
    .replace(/[A-Za-z]:\\[^\r\n]*/g, "[ruta local omitida]")
    .replace(/file:\/\/\/[^\s]+/gi, "[ruta local omitida]")
    .replace(/[^\r\n]{1,160}\.pdf\b/gi, "[PDF omitido]");
}

function sanitizeValue(value, depth = 0) {
  if (depth > 5 || value === undefined || typeof value === "function") return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return sanitizeString(value);
  if (value instanceof Error) {
    return {
      type: sanitizeString(value.name || "Error"),
      message: sanitizeString(value.message || value),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === "object") {
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
      if (blockedDetailKey.test(key)) continue;
      const sanitized = sanitizeValue(nested, depth + 1);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  }
  return sanitizeString(value);
}

function cleanDetails(details = {}) {
  const sanitized = sanitizeValue(details);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized) ? sanitized : {};
}

function emptyRenderStats() {
  return { count: 0, totalMs: 0, averageMs: null, maximumMs: null, slowCount: 0, errors: 0, cancelled: 0 };
}

function emptyDocumentState() {
  return {
    open: false,
    sizeBytes: null,
    sizeClass: "desconocido",
    pages: 0,
    pageClass: "desconocido",
    currentPage: 0,
    selectedPages: 0,
    sourceDocuments: 0,
  };
}

function emptyTimings() {
  return {
    pdfOpenReadyMs: null,
    pdfReadMs: null,
    pdfJsLoadMs: null,
    thumbnailListBuildMs: null,
    continuousListBuildMs: null,
    organizeGridBuildMs: null,
    firstThumbnailMs: null,
    firstVisiblePageMs: null,
    firstOrganizeCardMs: null,
  };
}

function emptyMemoryStats() {
  return {
    firstUsedBytes: null,
    currentUsedBytes: null,
    peakUsedBytes: null,
    endingUsedBytes: null,
    jsHeapLimitBytes: null,
    samples: [],
  };
}

function emptyLongTaskStats() {
  return { count: 0, totalMs: 0, maximumMs: null };
}

function emptyScrollStats() {
  return {
    sampleCount: 0,
    averageFps: null,
    worstP95FrameMs: null,
    framesOver32Ms: 0,
    samples: [],
  };
}

function emptyStateChecks() {
  return { count: 0, failures: 0, last: null };
}

function emptyViewerState() {
  return {
    viewMode: "continuous",
    activeTool: "overview",
    zoomMode: "fit-width",
    zoomPercent: null,
    pendingThumbnailTasks: 0,
    pendingContinuousTasks: 0,
    pendingOrganizeTasks: 0,
    queuedRenderTasks: 0,
    activeRenderTasks: 0,
  };
}

function createSession() {
  return {
    schemaVersion: 2,
    moduleVersion: "diagnostics-v2-performance-v1",
    startedAt: isoNow(),
    endedAt: null,
    recording: true,
    privacy: {
      localOnly: true,
      fileNamesCollected: false,
      filePathsCollected: false,
      pdfContentCollected: false,
    },
    environment: {
      platform: navigator.platform || "desconocida",
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemoryGb: navigator.deviceMemory || null,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: round(window.devicePixelRatio || 1, 2),
      userAgent: navigator.userAgent,
      performanceMemoryAvailable: Boolean(performance.memory),
      longTaskObserverAvailable: false,
    },
    document: emptyDocumentState(),
    state: emptyViewerState(),
    timings: emptyTimings(),
    renders: {
      thumbnail: emptyRenderStats(),
      continuous: emptyRenderStats(),
      organize: emptyRenderStats(),
      page: emptyRenderStats(),
      analysis: emptyRenderStats(),
    },
    memory: emptyMemoryStats(),
    longTasks: emptyLongTaskStats(),
    scroll: emptyScrollStats(),
    stateChecks: emptyStateChecks(),
    documents: [],
    lastCompletedDocumentId: null,
    events: [],
    errors: [],
  };
}

let session = createSession();
let operationSequence = 0;
const operations = new Map();
let panel = null;
let toggleButton = null;
let updateTimer = null;
let memoryTimer = null;
let longTaskObserver = null;
let documentOpenStartedAt = null;
let organizeStartedAt = null;
let renderSequence = 0;
let documentSequence = 0;
let activeDocumentRun = null;
const scrollSamplers = new Map();

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function resetCurrentDocumentMetrics(fileSizeBytes = null) {
  operations.clear();
  session.document = emptyDocumentState();
  session.document.open = true;
  session.document.currentPage = 1;
  session.document.sourceDocuments = 1;
  session.document.sizeBytes = Number.isFinite(fileSizeBytes) ? fileSizeBytes : null;
  session.document.sizeClass = classifyFileSize(session.document.sizeBytes);
  session.state = emptyViewerState();
  session.timings = emptyTimings();
  for (const key of Object.keys(session.renders)) session.renders[key] = emptyRenderStats();
  session.memory = emptyMemoryStats();
  session.longTasks = emptyLongTaskStats();
  session.scroll = emptyScrollStats();
  session.stateChecks = emptyStateChecks();
  documentOpenStartedAt = now();
  organizeStartedAt = null;
}

function currentDocumentSnapshot(status = "active", endedAt = null) {
  if (!activeDocumentRun) return null;
  return {
    id: activeDocumentRun.id,
    order: activeDocumentRun.order,
    startedAt: activeDocumentRun.startedAt,
    endedAt,
    status,
    source: activeDocumentRun.source,
    document: cloneData(session.document),
    state: cloneData(session.state),
    timings: cloneData(session.timings),
    renders: cloneData(session.renders),
    memory: cloneData(session.memory),
    longTasks: cloneData(session.longTasks),
    scroll: cloneData(session.scroll),
    stateChecks: cloneData(session.stateChecks),
    errors: cloneData(activeDocumentRun.errors),
    recentEvents: cloneData(activeDocumentRun.events),
  };
}

function finalizeCurrentDocument(status) {
  if (!activeDocumentRun) return null;
  sampleMemory();
  session.document.open = false;
  session.memory.endingUsedBytes = session.memory.currentUsedBytes;
  const snapshot = currentDocumentSnapshot(status, isoNow());
  session.documents.push(snapshot);
  if (session.documents.length > MAX_DOCUMENT_RUNS) session.documents.shift();
  session.lastCompletedDocumentId = snapshot.id;
  activeDocumentRun = null;
  documentOpenStartedAt = null;
  organizeStartedAt = null;
  return snapshot;
}

function addEvent(type, details = {}, level = "info") {
  if (!session.recording) return;
  const event = {
    at: isoNow(),
    elapsedMs: round(now(), 1),
    type,
    level,
    details: cleanDetails(details),
  };
  session.events.push(event);
  if (session.events.length > MAX_EVENTS) session.events.shift();
  if (activeDocumentRun) {
    activeDocumentRun.events.push(event);
    if (activeDocumentRun.events.length > 80) activeDocumentRun.events.shift();
  }
}

function recordError(error, context = "aplicación", details = {}) {
  if (!session.recording) return;
  const normalized = error instanceof Error
    ? {
      type: sanitizeString(error.name || "Error"),
      message: sanitizeString(error.message || error),
      stack: error.stack ? sanitizeString(String(error.stack).split("\n").slice(0, 8).join("\n")) : null,
    }
    : { type: "Error", message: sanitizeString(error || "Error desconocido"), stack: null };
  const safeContext = sanitizeString(context);
  const errorEntry = { at: isoNow(), context: safeContext, ...normalized, details: cleanDetails(details) };
  session.errors.push(errorEntry);
  if (session.errors.length > MAX_ERRORS) session.errors.shift();
  if (activeDocumentRun) {
    activeDocumentRun.errors.push(errorEntry);
    if (activeDocumentRun.errors.length > MAX_ERRORS) activeDocumentRun.errors.shift();
  }
  addEvent("error", { context: safeContext, type: normalized.type, message: normalized.message, ...details }, "error");
}

function startOperation(name, details = {}) {
  const id = `diag-${++operationSequence}`;
  const startedAt = now();
  if (name === "build-organize") organizeStartedAt = startedAt;
  operations.set(id, {
    name,
    startedAt,
    details: cleanDetails(details),
    documentId: activeDocumentRun?.id || null,
  });
  if (!name.startsWith("render-")) addEvent(`${name}:inicio`, details);
  return id;
}

function applyTiming(name, durationMs) {
  const timingMap = {
    "pdf-open-ready": "pdfOpenReadyMs",
    "pdf-read": "pdfReadMs",
    "pdfjs-load": "pdfJsLoadMs",
    "build-thumbnails": "thumbnailListBuildMs",
    "build-continuous": "continuousListBuildMs",
    "build-organize": "organizeGridBuildMs",
  };
  const key = timingMap[name];
  if (key && session.timings[key] === null) session.timings[key] = round(durationMs, 1);
}

function updateRenderStats(kind, durationMs, status = "ok") {
  const stats = session.renders[kind];
  if (!stats) return;
  if (status === "cancelled") {
    stats.cancelled += 1;
    return;
  }
  if (status === "error") {
    stats.errors += 1;
    return;
  }
  stats.count += 1;
  stats.totalMs = round(stats.totalMs + durationMs, 1);
  stats.averageMs = round(stats.totalMs / stats.count, 1);
  stats.maximumMs = round(Math.max(stats.maximumMs || 0, durationMs), 1);
  if (durationMs >= SLOW_RENDER_MS) stats.slowCount += 1;

  const hasOpenStart = Number.isFinite(documentOpenStartedAt);
  if (kind === "thumbnail" && session.timings.firstThumbnailMs === null && hasOpenStart) {
    session.timings.firstThumbnailMs = round(now() - documentOpenStartedAt, 1);
  }
  if ((kind === "continuous" || kind === "page") && session.timings.firstVisiblePageMs === null && hasOpenStart) {
    session.timings.firstVisiblePageMs = round(now() - documentOpenStartedAt, 1);
  }
  if (kind === "organize" && session.timings.firstOrganizeCardMs === null && Number.isFinite(organizeStartedAt)) {
    session.timings.firstOrganizeCardMs = round(now() - organizeStartedAt, 1);
  }
}

function endOperation(id, details = {}, status = "ok") {
  const operation = operations.get(id);
  if (!operation) return null;
  operations.delete(id);
  const durationMs = now() - operation.startedAt;
  const payload = { ...operation.details, ...cleanDetails(details), durationMs: round(durationMs, 1), status };
  const isRender = operation.name.startsWith("render-");
  if (!isRender || status !== "ok" || durationMs >= SLOW_RENDER_MS) {
    addEvent(`${operation.name}:fin`, payload, status === "error" ? "error" : durationMs >= SLOW_RENDER_MS ? "warning" : "info");
  }
  const belongsToActiveDocument = Boolean(
    activeDocumentRun && operation.documentId === activeDocumentRun.id
  );
  if (belongsToActiveDocument) {
    applyTiming(operation.name, durationMs);
    if (isRender) {
      updateRenderStats(operation.name.replace("render-", ""), durationMs, status);
    }
  }
  return durationMs;
}

function failOperation(id, error, details = {}) {
  const operation = operations.get(id);
  if (operation) endOperation(id, details, error?.name === "RenderingCancelledException" ? "cancelled" : "error");
  if (error?.name !== "RenderingCancelledException") recordError(error, operation?.name || "operación", details);
}

function updateContext(details = {}) {
  const safe = cleanDetails(details);
  if (!activeDocumentRun && safe.documentOpen) {
    resetCurrentDocumentMetrics(Number.isFinite(safe.fileSizeBytes) ? safe.fileSizeBytes : null);
    activeDocumentRun = {
      id: `document-${++documentSequence}`,
      order: documentSequence,
      startedAt: isoNow(),
      source: "context",
      events: [],
      errors: [],
    };
    addEvent("document-context-start", {
      fileSizeBytes: Number.isFinite(safe.fileSizeBytes) ? safe.fileSizeBytes : null,
      pages: Number.isFinite(safe.pages) ? safe.pages : 0,
    });
    sampleMemory();
  }
  if (!activeDocumentRun) return;
  if (Object.prototype.hasOwnProperty.call(safe, "documentOpen")) session.document.open = Boolean(safe.documentOpen);
  if (Number.isFinite(safe.fileSizeBytes)) {
    session.document.sizeBytes = safe.fileSizeBytes;
    session.document.sizeClass = classifyFileSize(safe.fileSizeBytes);
  }
  for (const key of ["pages", "currentPage", "selectedPages", "sourceDocuments"]) {
    if (Number.isFinite(safe[key])) session.document[key] = safe[key];
  }
  session.document.pageClass = classifyPageCount(session.document.pages);
  for (const key of ["viewMode", "activeTool", "zoomMode", "zoomPercent", "pendingThumbnailTasks", "pendingContinuousTasks", "pendingOrganizeTasks", "queuedRenderTasks", "activeRenderTasks"]) {
    if (safe[key] !== undefined) session.state[key] = safe[key];
  }
}

function emit(type, details = {}) {
  const safe = cleanDetails(details);

  if (type === "document-open-start") {
    if (activeDocumentRun) finalizeCurrentDocument("replaced");
    resetCurrentDocumentMetrics(Number.isFinite(safe.fileSizeBytes) ? safe.fileSizeBytes : null);
    activeDocumentRun = {
      id: `document-${++documentSequence}`,
      order: documentSequence,
      startedAt: isoNow(),
      source: safe.source || "manual",
      events: [],
      errors: [],
    };
    addEvent(type, safe);
    sampleMemory();
    return;
  }

  if (type === "document-open-ready") {
    if (activeDocumentRun) {
      session.document.open = true;
      if (Number.isFinite(safe.pages)) session.document.pages = safe.pages;
      session.document.pageClass = classifyPageCount(session.document.pages);
      session.timings.pdfOpenReadyMs = Number.isFinite(documentOpenStartedAt)
        ? round(now() - documentOpenStartedAt, 1)
        : null;
    }
    addEvent(type, safe);
    return;
  }

  if (type === "document-close-start" || type === "document-replace-start") {
    updateContext(safe);
    addEvent(type, safe);
    finalizeCurrentDocument(type === "document-replace-start" ? "replaced" : "closed");
    return;
  }

  if (type === "document-open-failed") {
    addEvent(type, safe, "error");
    finalizeCurrentDocument("open-failed");
    return;
  }

  if (type === "document-closed") {
    if (activeDocumentRun) finalizeCurrentDocument("closed");
    addEvent(type, safe);
    return;
  }

  if (type === "context") {
    updateContext(safe);
  } else if (type === "state-check" && activeDocumentRun) {
    session.stateChecks.count += 1;
    const passed = safe.passed !== false;
    if (!passed) session.stateChecks.failures += 1;
    session.stateChecks.last = { at: isoNow(), ...safe };
  }
  addEvent(type, safe, type.includes("failed") ? "error" : "info");
}

function sampleMemory() {
  if (!session.recording || !performance.memory || !activeDocumentRun) return;
  const used = Number(performance.memory.usedJSHeapSize);
  const limit = Number(performance.memory.jsHeapSizeLimit);
  if (!Number.isFinite(used)) return;
  if (!Number.isFinite(session.memory.firstUsedBytes)) session.memory.firstUsedBytes = used;
  session.memory.currentUsedBytes = used;
  session.memory.peakUsedBytes = Math.max(session.memory.peakUsedBytes || 0, used);
  session.memory.jsHeapLimitBytes = Number.isFinite(limit) ? limit : null;
  session.memory.samples.push({ at: isoNow(), elapsedMs: round(now(), 0), usedBytes: used });
  if (session.memory.samples.length > MAX_MEMORY_SAMPLES) session.memory.samples.shift();
}

function startLongTaskObserver() {
  if (!("PerformanceObserver" in window)) return;
  try {
    const supported = PerformanceObserver.supportedEntryTypes || [];
    if (!supported.includes("longtask")) return;
    longTaskObserver = new PerformanceObserver((list) => {
      if (!session.recording || !activeDocumentRun) return;
      for (const entry of list.getEntries()) {
        const duration = Number(entry.duration) || 0;
        session.longTasks.count += 1;
        session.longTasks.totalMs = round(session.longTasks.totalMs + duration, 1);
        session.longTasks.maximumMs = round(Math.max(session.longTasks.maximumMs || 0, duration), 1);
        addEvent("tarea-larga", { durationMs: round(duration, 1) }, duration >= 200 ? "warning" : "info");
      }
    });
    longTaskObserver.observe({ entryTypes: ["longtask"] });
    session.environment.longTaskObserverAvailable = true;
  } catch {
    session.environment.longTaskObserverAvailable = false;
  }
}

function finishScrollSample(key) {
  const sampler = scrollSamplers.get(key);
  if (!sampler) return;
  scrollSamplers.delete(key);
  cancelAnimationFrame(sampler.raf);
  if (!activeDocumentRun) return;
  const deltas = sampler.deltas.filter((value) => value > 0 && value < 250);
  if (deltas.length < 3) return;
  const sorted = [...deltas].sort((a, b) => a - b);
  const average = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const fps = Math.min(120, 1000 / average);
  const over32 = deltas.filter((value) => value > 32).length;
  const sample = { at: isoNow(), area: key, frames: deltas.length, averageFps: round(fps, 1), p95FrameMs: round(p95, 1), framesOver32Ms: over32 };
  session.scroll.samples.push(sample);
  if (session.scroll.samples.length > MAX_SCROLL_SAMPLES) session.scroll.samples.shift();
  session.scroll.sampleCount = session.scroll.samples.length;
  session.scroll.averageFps = round(session.scroll.samples.reduce((sum, item) => sum + item.averageFps, 0) / session.scroll.samples.length, 1);
  session.scroll.worstP95FrameMs = round(Math.max(...session.scroll.samples.map((item) => item.p95FrameMs)), 1);
  session.scroll.framesOver32Ms = session.scroll.samples.reduce((sum, item) => sum + item.framesOver32Ms, 0);
  addEvent("muestra-desplazamiento", sample, p95 > 50 ? "warning" : "info");
}

function sampleScroll(area) {
  if (!session.recording || !activeDocumentRun) return;
  const existing = scrollSamplers.get(area);
  if (existing) {
    existing.lastScrollAt = now();
    return;
  }
  const sampler = { lastFrameAt: now(), lastScrollAt: now(), deltas: [], raf: 0 };
  const frame = (timestamp) => {
    sampler.deltas.push(timestamp - sampler.lastFrameAt);
    sampler.lastFrameAt = timestamp;
    if (timestamp - sampler.lastScrollAt > 450 || sampler.deltas.length >= 180) {
      finishScrollSample(area);
      return;
    }
    sampler.raf = requestAnimationFrame(frame);
  };
  sampler.raf = requestAnimationFrame(frame);
  scrollSamplers.set(area, sampler);
}

function attachScrollSampling() {
  const targets = [
    ["lectura", document.querySelector("#viewer-continuous-stage")],
    ["organizar", document.querySelector("#viewer-organize-stage")],
    ["miniaturas", document.querySelector("#viewer-thumbnail-list")],
  ];
  for (const [name, element] of targets) {
    element?.addEventListener("scroll", () => sampleScroll(name), { passive: true });
  }
}

function renderRows() {
  if (!panel) return;
  toggleButton?.classList.toggle("is-recording", session.recording);
  if (panel.hidden) return;
  const set = (name, value) => {
    const element = panel.querySelector(`[data-diag-value="${name}"]`);
    if (element) element.textContent = value;
  };
  set("recording", session.recording ? "Grabando" : "En pausa");
  const completedCount = session.documents.length;
  set("document", session.document.open
    ? `${session.document.pages || "?"} pág. (${session.document.pageClass}) · ${formatBytes(session.document.sizeBytes)} (${session.document.sizeClass})`
    : completedCount
      ? `Última: ${session.document.pages || "?"} pág. · ${formatBytes(session.document.sizeBytes)} · ${completedCount} prueba${completedCount === 1 ? "" : "s"}`
      : "Sin PDF");
  set("open-ready", formatDuration(session.timings.pdfOpenReadyMs));
  set("first-page", formatDuration(session.timings.firstVisiblePageMs));
  set("first-thumb", formatDuration(session.timings.firstThumbnailMs));
  set("heap", performance.memory ? `${formatBytes(session.memory.currentUsedBytes)} / pico ${formatBytes(session.memory.peakUsedBytes)}` : "No disponible");
  set("long-tasks", `${session.longTasks.count} · máx. ${formatDuration(session.longTasks.maximumMs)}`);
  set("errors", String(session.errors.length));
  set("scroll", session.scroll.averageFps === null ? "Sin muestra" : `${session.scroll.averageFps} FPS · p95 ${session.scroll.worstP95FrameMs} ms`);
  set("state", `${session.state.viewMode} · ${session.state.activeTool} · pág. ${session.document.currentPage || 0} · sel. ${session.document.selectedPages || 0}`);
  set("pending", `Activas ${session.state.activeRenderTasks || 0} · Cola ${session.state.queuedRenderTasks || 0} · Mini ${session.state.pendingThumbnailTasks || 0} · Lectura ${session.state.pendingContinuousTasks || 0} · Organizar ${session.state.pendingOrganizeTasks || 0}`);
  set("checks", `${session.stateChecks.count} comprobaciones · ${session.stateChecks.failures} fallos`);

  for (const kind of ["thumbnail", "continuous", "organize", "page"]) {
    const stats = session.renders[kind];
    set(`render-${kind}`, `${stats.count} · media ${formatDuration(stats.averageMs)} · máx. ${formatDuration(stats.maximumMs)} · lentas ${stats.slowCount} · err. ${stats.errors}`);
  }

  const recent = panel.querySelector("[data-diag-events]");
  if (recent) {
    recent.replaceChildren();
    for (const event of session.events.slice(-8).reverse()) {
      const row = document.createElement("li");
      row.className = `pdfp-diagnostics-event is-${event.level}`;
      const time = new Date(event.at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      row.innerHTML = `<time>${time}</time><span>${event.type}</span>`;
      recent.append(row);
    }
  }

  const pauseButton = panel.querySelector("[data-diag-action=toggle-recording]");
  if (pauseButton) pauseButton.textContent = session.recording ? "Pausar" : "Reanudar";
}

function buildReport() {
  if (activeDocumentRun) sampleMemory();
  const documents = cloneData(session.documents);
  const activeSnapshot = currentDocumentSnapshot("active", null);
  if (activeSnapshot) documents.push(activeSnapshot);
  const report = cloneData(session);
  report.endedAt = isoNow();
  report.environment.viewport = `${window.innerWidth}x${window.innerHeight}`;
  report.documents = documents;
  report.activeDocumentId = activeDocumentRun?.id || null;
  return report;
}

function appendDocumentText(lines, run, index) {
  const document = run.document;
  const timings = run.timings;
  lines.push(
    "",
    `PRUEBA ${index + 1} · ${run.status.toUpperCase()}`,
    "----------------------------------------",
    `Inicio: ${run.startedAt}`,
    `Fin: ${run.endedAt || "en curso"}`,
    `Origen de apertura: ${run.source}`,
    `Tamaño: ${formatBytes(document.sizeBytes)} (${document.sizeClass})`,
    `Páginas: ${document.pages} (${document.pageClass})`,
    `Última página activa: ${document.currentPage}`,
    `Seleccionadas: ${document.selectedPages}`,
    `PDF de origen: ${document.sourceDocuments}`,
    "",
    "TIEMPOS",
    `PDF listo para usar: ${formatDuration(timings.pdfOpenReadyMs)}`,
    `Lectura del archivo: ${formatDuration(timings.pdfReadMs)}`,
    `Carga PDF.js: ${formatDuration(timings.pdfJsLoadMs)}`,
    `Construcción miniaturas: ${formatDuration(timings.thumbnailListBuildMs)}`,
    `Construcción lectura continua: ${formatDuration(timings.continuousListBuildMs)}`,
    `Construcción Organizar: ${formatDuration(timings.organizeGridBuildMs)}`,
    `Primera miniatura: ${formatDuration(timings.firstThumbnailMs)}`,
    `Primera página visible: ${formatDuration(timings.firstVisiblePageMs)}`,
    `Primera tarjeta Organizar: ${formatDuration(timings.firstOrganizeCardMs)}`,
    "",
    "RENDERIZADO",
  );
  for (const [kind, stats] of Object.entries(run.renders)) {
    lines.push(`${kind}: ${stats.count} completados · media ${formatDuration(stats.averageMs)} · máximo ${formatDuration(stats.maximumMs)} · lentos ${stats.slowCount} · errores ${stats.errors} · cancelados ${stats.cancelled}`);
  }
  lines.push(
    "",
    "MEMORIA Y FLUIDEZ",
    `Heap inicial: ${formatBytes(run.memory.firstUsedBytes)}`,
    `Heap final: ${formatBytes(run.memory.endingUsedBytes ?? run.memory.currentUsedBytes)}`,
    `Pico de heap: ${formatBytes(run.memory.peakUsedBytes)}`,
    `Límite de heap: ${formatBytes(run.memory.jsHeapLimitBytes)}`,
    `Muestras de memoria: ${run.memory.samples.length}`,
    `Tareas largas: ${run.longTasks.count} · total ${formatDuration(run.longTasks.totalMs)} · máximo ${formatDuration(run.longTasks.maximumMs)}`,
    `Desplazamiento: ${run.scroll.sampleCount} muestras · media ${run.scroll.averageFps ?? "—"} FPS · peor p95 ${run.scroll.worstP95FrameMs ?? "—"} ms · frames >32 ms ${run.scroll.framesOver32Ms}`,
    "",
    "PERSISTENCIA DE ESTADO",
    `${run.stateChecks.count} comprobaciones · ${run.stateChecks.failures} fallos`,
    `Estado final: vista ${run.state.viewMode} · herramienta ${run.state.activeTool} · página ${document.currentPage} · selección ${document.selectedPages}`,
    "",
    `ERRORES DE ESTA PRUEBA: ${run.errors.length}`,
  );
  run.errors.forEach((error, errorIndex) => lines.push(`${errorIndex + 1}. [${error.context}] ${error.type}: ${error.message}`));
}

function reportAsText(report) {
  const lines = [
    "PDFPrivado Pro — Informe de diagnóstico temporal",
    "=================================================",
    `Inicio de sesión: ${report.startedAt}`,
    `Fin de sesión: ${report.endedAt}`,
    "Privacidad: informe local sin nombres, rutas ni contenido de documentos.",
    "",
    "ENTORNO",
    `Plataforma: ${report.environment.platform}`,
    `CPU lógica: ${report.environment.hardwareConcurrency ?? "no disponible"}`,
    `Memoria declarada: ${report.environment.deviceMemoryGb ? `${report.environment.deviceMemoryGb} GB` : "no disponible"}`,
    `Vista: ${report.environment.viewport} · DPR ${report.environment.devicePixelRatio}`,
    `Memoria JS disponible: ${report.environment.performanceMemoryAvailable ? "sí" : "no"}`,
    `Observador de tareas largas: ${report.environment.longTaskObserverAvailable ? "sí" : "no"}`,
    "",
    `PRUEBAS DE DOCUMENTOS: ${report.documents.length}`,
  ];

  report.documents.forEach((run, index) => appendDocumentText(lines, run, index));

  lines.push(
    "",
    "RESUMEN GLOBAL",
    `Errores totales registrados: ${report.errors.length}`,
    `Eventos conservados: ${report.events.length}`,
    "",
    "ÚLTIMOS EVENTOS GLOBALES",
  );
  report.events.slice(-80).forEach((event) => lines.push(`${event.at} · ${event.level} · ${event.type} · ${JSON.stringify(event.details)}`));
  return lines.join("\r\n");
}

async function saveReport(kind) {
  const report = buildReport();
  const isJson = kind === "json";
  const extension = isJson ? "json" : "txt";
  const content = isJson ? JSON.stringify(report, null, 2) : reportAsText(report);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suggestedName = `pdfprivado-diagnostico-${stamp}.${extension}`;
  const dialog = window.__TAURI__?.dialog;
  const fs = window.__TAURI__?.fs;
  try {
    if (typeof dialog?.save === "function" && typeof fs?.writeFile === "function") {
      const path = await dialog.save({
        defaultPath: suggestedName,
        title: `Guardar informe de diagnóstico ${extension.toUpperCase()}`,
        filters: [{ name: isJson ? "Informe JSON" : "Informe de texto", extensions: [extension] }],
      });
      if (!path) return;
      await fs.writeFile(path, new TextEncoder().encode(content));
    } else {
      const blob = new Blob([content], { type: isJson ? "application/json" : "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = suggestedName;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    addEvent("informe-exportado", { format: extension });
  } catch (error) {
    recordError(error, "exportar-informe", { format: extension });
    window.alert(`No se pudo guardar el informe: ${String(error?.message || error)}`);
  }
}

function resetSession() {
  const recording = session.recording;
  session = createSession();
  session.recording = recording;
  operations.clear();
  documentOpenStartedAt = null;
  organizeStartedAt = null;
  activeDocumentRun = null;
  documentSequence = 0;
  renderSequence = 0;
  addEvent("sesión-reiniciada");
  window.dispatchEvent(new CustomEvent("pdfprivado:diagnostics-request-context"));
  renderRows();
}

function setPanelOpen(open) {
  if (!panel) return;
  panel.hidden = !open;
  toggleButton?.setAttribute("aria-expanded", String(open));
  try { localStorage.setItem(STORAGE_KEY, open ? "1" : "0"); } catch { /* almacenamiento opcional */ }
  if (open) renderRows();
}

function createUi() {
  toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "pdfp-diagnostics-toggle is-recording";
  toggleButton.setAttribute("aria-label", "Abrir diagnóstico temporal");
  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.innerHTML = `<span aria-hidden="true">D</span><small>Diagnóstico</small>`;

  panel = document.createElement("aside");
  panel.className = "pdfp-diagnostics-panel";
  panel.setAttribute("aria-label", "Panel temporal de diagnóstico");
  panel.hidden = true;
  panel.innerHTML = `
    <header class="pdfp-diagnostics-header">
      <div><span>DESARROLLO</span><strong>Diagnóstico temporal</strong></div>
      <button type="button" data-diag-action="close" aria-label="Cerrar panel">×</button>
    </header>
    <p class="pdfp-diagnostics-privacy">Solo datos técnicos locales. Nunca registra nombres, rutas ni contenido del PDF.</p>
    <div class="pdfp-diagnostics-actions">
      <button type="button" data-diag-action="toggle-recording">Pausar</button>
      <button type="button" data-diag-action="reset">Reiniciar prueba</button>
      <button type="button" data-diag-action="export-txt">Exportar TXT</button>
      <button type="button" data-diag-action="export-json">Exportar JSON</button>
    </div>
    <section class="pdfp-diagnostics-summary">
      <div><span>Estado</span><strong data-diag-value="recording">Grabando</strong></div>
      <div><span>Documento</span><strong data-diag-value="document">Sin PDF</strong></div>
      <div><span>PDF listo</span><strong data-diag-value="open-ready">—</strong></div>
      <div><span>Primera página</span><strong data-diag-value="first-page">—</strong></div>
      <div><span>Primera miniatura</span><strong data-diag-value="first-thumb">—</strong></div>
      <div><span>Memoria JS</span><strong data-diag-value="heap">—</strong></div>
      <div><span>Tareas largas</span><strong data-diag-value="long-tasks">0</strong></div>
      <div><span>Errores</span><strong data-diag-value="errors">0</strong></div>
      <div><span>Desplazamiento</span><strong data-diag-value="scroll">Sin muestra</strong></div>
    </section>
    <section class="pdfp-diagnostics-section">
      <h2>Estado actual</h2>
      <p data-diag-value="state">continuous · overview</p>
      <p data-diag-value="pending">Activas 0 · Cola 0 · Mini 0 · Lectura 0 · Organizar 0</p>
      <p data-diag-value="checks">0 comprobaciones · 0 fallos</p>
    </section>
    <section class="pdfp-diagnostics-section">
      <h2>Renderizado</h2>
      <dl class="pdfp-diagnostics-render-list">
        <div><dt>Miniaturas</dt><dd data-diag-value="render-thumbnail">0</dd></div>
        <div><dt>Lectura</dt><dd data-diag-value="render-continuous">0</dd></div>
        <div><dt>Organizar</dt><dd data-diag-value="render-organize">0</dd></div>
        <div><dt>Página</dt><dd data-diag-value="render-page">0</dd></div>
      </dl>
    </section>
    <section class="pdfp-diagnostics-section pdfp-diagnostics-events-section">
      <h2>Actividad reciente</h2>
      <ol class="pdfp-diagnostics-events" data-diag-events></ol>
    </section>
    <footer>Atajo: <kbd>Ctrl</kbd> + <kbd>Mayús</kbd> + <kbd>D</kbd></footer>
  `;

  document.body.append(toggleButton, panel);
  toggleButton.addEventListener("click", () => setPanelOpen(panel.hidden));
  panel.addEventListener("click", (event) => {
    const action = event.target.closest?.("[data-diag-action]")?.dataset.diagAction;
    if (!action) return;
    if (action === "close") setPanelOpen(false);
    if (action === "toggle-recording") {
      session.recording = !session.recording;
      addEvent(session.recording ? "grabación-reanudada" : "grabación-pausada");
      renderRows();
    }
    if (action === "reset") resetSession();
    if (action === "export-txt") saveReport("txt");
    if (action === "export-json") saveReport("json");
  });

  let shouldOpen = false;
  try { shouldOpen = localStorage.getItem(STORAGE_KEY) === "1"; } catch { /* almacenamiento opcional */ }
  setPanelOpen(shouldOpen);
}

function initialize() {
  createUi();
  attachScrollSampling();
  startLongTaskObserver();
  sampleMemory();
  memoryTimer = window.setInterval(sampleMemory, MEMORY_SAMPLE_INTERVAL_MS);
  updateTimer = window.setInterval(renderRows, 500);
  window.addEventListener("resize", () => { session.environment.viewport = `${window.innerWidth}x${window.innerHeight}`; });
  window.addEventListener("error", (event) => {
    recordError(event.error || event.message, "error-global", { source: "window" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    recordError(event.reason, "promesa-no-controlada");
  });
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      setPanelOpen(panel.hidden);
    }
  });
  addEvent("diagnóstico-iniciado", { localOnly: true });
  renderRows();
}

const api = Object.freeze({
  emit,
  start: startOperation,
  end: endOperation,
  fail: failOperation,
  error: recordError,
  context: updateContext,
  nextRenderId: () => ++renderSequence,
  report: buildReport,
});

window.PDFPrivadoDiagnostics = api;

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
else initialize();

window.addEventListener("beforeunload", () => {
  window.clearInterval(memoryTimer);
  window.clearInterval(updateTimer);
  longTaskObserver?.disconnect();
});
