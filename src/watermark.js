/* PDFPRIVADO_WATERMARK_UI_V1_2G */
import {
  applyTextWatermark,
  resolveWatermarkPlacement,
  selectedPagesForMode,
} from "./watermark-core.js";

const $ = (selector) => document.querySelector(selector);

const els = {
  dialog: $("#watermark-dialog"),
  fileInput: $("#watermark-file-input"),
  choose: $("#watermark-choose-file"),
  remove: $("#watermark-remove-file"),
  close: Array.from(document.querySelectorAll("[data-watermark-close]")),
  fileName: $("#watermark-file-name"),
  fileMeta: $("#watermark-file-meta"),
  text: $("#watermark-text"),
  pageMode: $("#watermark-page-mode"),
  expression: $("#watermark-expression"),
  expressionField: $("#watermark-expression-field"),
  manualPanel: $("#watermark-manual-panel"),
  manualGrid: $("#watermark-manual-grid"),
  selectAll: $("#watermark-select-all"),
  selectNone: $("#watermark-select-none"),
  selectInvert: $("#watermark-select-invert"),
  skipCover: $("#watermark-skip-cover"),
  position: $("#watermark-position"),
  fontSize: $("#watermark-font-size"),
  color: $("#watermark-color"),
  opacity: $("#watermark-opacity"),
  rotation: $("#watermark-rotation"),
  marginX: $("#watermark-margin-x"),
  marginY: $("#watermark-margin-y"),
  bold: $("#watermark-bold"),
  previewCanvas: $("#watermark-preview-canvas"),
  previewPage: $("#watermark-preview-page"),
  previewPrev: $("#watermark-preview-prev"),
  previewNext: $("#watermark-preview-next"),
  previewFirst: $("#watermark-preview-first"),
  previewLast: $("#watermark-preview-last"),
  previewCounter: $("#watermark-preview-counter"),
  selectionSummary: $("#watermark-selection-summary"),
  footerSummary: $("#watermark-footer-summary"),
  status: $("#watermark-status"),
  save: $("#watermark-save"),
  reset: $("#watermark-reset"),
  preset: $("#watermark-preset"),
};

const state = {
  file: null,
  bytes: null,
  pageCount: 0,
  busy: false,
  pdfDocument: null,
  previewPage: 1,
  previewTask: null,
  previewSerial: 0,
  manualPages: new Set(),
};

const PRESETS = Object.freeze({
  confidential: { text: "CONFIDENCIAL", position: "center", fontSize: 54, color: "#b91c1c", opacity: 18, rotation: -35, marginX: 24, marginY: 24, bold: true },
  draft: { text: "BORRADOR", position: "center", fontSize: 58, color: "#475569", opacity: 16, rotation: -35, marginX: 24, marginY: 24, bold: true },
  internal: { text: "USO INTERNO", position: "bottom-center", fontSize: 20, color: "#334155", opacity: 42, rotation: 0, marginX: 24, marginY: 22, bold: true },
});

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function setStatus(message = "", type = "info") {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.dataset.type = type;
  els.status.hidden = !message;
}

function options() {
  return {
    text: els.text.value,
    pageMode: els.pageMode.value,
    pageExpression: els.expression.value,
    manualPages: new Set(state.manualPages),
    skipCover: Boolean(els.skipCover?.checked),
    position: els.position.value,
    fontSize: Number(els.fontSize.value),
    color: els.color.value,
    opacity: Number(els.opacity.value) / 100,
    rotation: Number(els.rotation.value),
    marginX: Number(els.marginX.value),
    marginY: Number(els.marginY.value),
    bold: els.bold.checked,
  };
}

function currentSelection() {
  const opts = options();
  return selectedPagesForMode(
    opts.pageMode,
    state.pageCount,
    opts.pageExpression,
    opts.manualPages,
    opts.skipCover
  );
}

function selectedPagesSorted() {
  return [...currentSelection()].sort((a, b) => a - b);
}

function renderManualGrid() {
  if (!els.manualGrid) return;
  els.manualGrid.replaceChildren();

  for (let page = 1; page <= state.pageCount; page += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "watermark-page-chip";
    button.textContent = String(page);
    button.dataset.page = String(page);
    button.title = `Página ${page}`;
    button.setAttribute("aria-label", `Alternar página ${page}`);
    button.addEventListener("click", () => {
      if (state.manualPages.has(page)) state.manualPages.delete(page);
      else state.manualPages.add(page);
      updateManualGridState();
      refresh();
      schedulePreview();
    });
    els.manualGrid.append(button);
  }

  updateManualGridState();
}

function updateManualGridState() {
  if (!els.manualGrid) return;
  for (const button of els.manualGrid.querySelectorAll(".watermark-page-chip")) {
    const page = Number(button.dataset.page);
    const selected = state.manualPages.has(page);
    const current = page === state.previewPage;
    button.classList.toggle("is-selected", selected);
    button.classList.toggle("is-current", current);
    button.setAttribute("aria-pressed", String(selected));
  }
}

function setManualPages(mode) {
  if (!state.pageCount || state.busy) return;
  els.pageMode.value = "manual";
  if (mode === "all") {
    state.manualPages = new Set(Array.from({ length: state.pageCount }, (_, index) => index + 1));
  } else if (mode === "none") {
    state.manualPages.clear();
  } else if (mode === "invert") {
    state.manualPages = new Set(
      Array.from({ length: state.pageCount }, (_, index) => index + 1)
        .filter((page) => !state.manualPages.has(page))
    );
  }
  updateManualGridState();
  refresh();
  schedulePreview();
}


function refresh() {
  const opts = options();
  const rangeMode = opts.pageMode === "range";
  els.expression.disabled = !rangeMode || state.busy;
  if (els.expressionField) els.expressionField.hidden = !rangeMode;
  if (els.manualPanel) els.manualPanel.hidden = !state.pageCount;
  els.choose.disabled = state.busy;
  els.remove.disabled = state.busy || !state.file;
  const selected = state.pageCount ? currentSelection() : new Set();
  els.save.disabled = state.busy || !state.file || !opts.text.trim() || selected.size === 0;
  if (els.selectAll) els.selectAll.disabled = state.busy || !state.pageCount;
  if (els.selectNone) els.selectNone.disabled = state.busy || !state.pageCount;
  if (els.selectInvert) els.selectInvert.disabled = state.busy || !state.pageCount;
  els.previewPrev.disabled = state.busy || state.previewPage <= 1;
  els.previewNext.disabled = state.busy || !state.pageCount || state.previewPage >= state.pageCount;
  if (els.previewFirst) els.previewFirst.disabled = state.busy || state.previewPage <= 1;
  if (els.previewLast) els.previewLast.disabled = state.busy || !state.pageCount || state.previewPage >= state.pageCount;
  els.previewPage.disabled = state.busy || !state.pageCount;
  els.previewPage.max = String(Math.max(1, state.pageCount));

  if (state.pageCount) {
    const selected = currentSelection();
    if (selected.size === 0) {
      els.selectionSummary.textContent = "No hay páginas seleccionadas. Elige al menos una para poder guardar.";
      els.selectionSummary.dataset.state = "warning";
    } else {
      const coverText = opts.skipCover ? " · portada omitida" : "";
      els.selectionSummary.textContent = `${selected.size} de ${state.pageCount} páginas recibirán la marca${coverText}.`;
      els.selectionSummary.dataset.state = "ready";
    }
    if (els.footerSummary) {
      els.footerSummary.textContent = selected.size
        ? `${selected.size} página${selected.size === 1 ? "" : "s"} seleccionada${selected.size === 1 ? "" : "s"}`
        : "Ninguna página seleccionada";
      els.footerSummary.dataset.state = selected.size ? "ready" : "warning";
    }
    els.previewCounter.textContent = `Página ${state.previewPage} de ${state.pageCount}`;
  } else {
    els.selectionSummary.textContent = "Ningún documento preparado.";
    els.previewCounter.textContent = "Sin documento";
    els.selectionSummary.dataset.state = "empty";
    if (els.footerSummary) {
      els.footerSummary.textContent = "Carga un PDF para comenzar";
      els.footerSummary.dataset.state = "empty";
    }
  }
  updateManualGridState();
}

async function destroyPreviewDocument() {
  try { await state.pdfDocument?.destroy?.(); } catch {}
  state.pdfDocument = null;
}

async function loadFile(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    setStatus("Selecciona un archivo PDF válido.", "error");
    return;
  }

  state.busy = true;
  refresh();
  setStatus("Analizando el documento y preparando la vista previa…", "info");

  try {
    await destroyPreviewDocument();
    state.file = file;
    state.bytes = new Uint8Array(await file.arrayBuffer());

    const loadingTask = pdfjsLib.getDocument({
      data: state.bytes.slice(),
      disableAutoFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      wasmUrl: new URL("./vendor/pdfjs/wasm/", import.meta.url).href,
    });
    state.pdfDocument = await loadingTask.promise;
    state.pageCount = state.pdfDocument.numPages;
    state.previewPage = 1;
    state.manualPages = new Set(Array.from({ length: state.pageCount }, (_, index) => index + 1));
    els.previewPage.value = "1";
    els.fileName.textContent = file.name;
    els.fileMeta.textContent = `${state.pageCount} páginas · ${formatBytes(file.size)}`;
    renderManualGrid();
    setStatus("Documento preparado localmente. Revisa cada página antes de guardar.", "success");
    await renderPreview();
  } catch (error) {
    await destroyPreviewDocument();
    state.file = null;
    state.bytes = null;
    state.pageCount = 0;
    els.fileName.textContent = "Ningún documento seleccionado";
    els.fileMeta.textContent = "Elige un PDF local.";
    setStatus(error?.message || "No se pudo abrir el PDF.", "error");
  } finally {
    state.busy = false;
    refresh();
  }
}

function clearPreviewCanvas() {
  const context = els.previewCanvas?.getContext("2d");
  context?.clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);
}

async function removeFile() {
  if (state.busy) return;
  await destroyPreviewDocument();
  state.file = null;
  state.bytes = null;
  state.pageCount = 0;
  state.previewPage = 1;
  state.manualPages.clear();
  els.fileInput.value = "";
  els.fileName.textContent = "Ningún documento seleccionado";
  els.fileMeta.textContent = "Elige un PDF local.";
  els.previewPage.value = "1";
  clearPreviewCanvas();
  els.manualGrid?.replaceChildren();
  setStatus("");
  refresh();
}

function resetOptions() {
  els.text.value = "CONFIDENCIAL";
  els.pageMode.value = "all";
  els.expression.value = "";
  els.skipCover.checked = false;
  state.manualPages = new Set(Array.from({ length: state.pageCount }, (_, index) => index + 1));
  updateManualGridState();
  els.position.value = "center";
  els.fontSize.value = "54";
  els.color.value = "#b91c1c";
  els.opacity.value = "18";
  els.rotation.value = "-35";
  els.marginX.value = "24";
  els.marginY.value = "24";
  els.bold.checked = true;
  els.preset.value = "confidential";
  setStatus("Configuración restablecida.", "info");
  refresh();
  schedulePreview();
}

function applyPreset() {
  const preset = PRESETS[els.preset.value];
  if (!preset) return;
  for (const [key, value] of Object.entries(preset)) {
    const control = els[key];
    if (!control) continue;
    if (control.type === "checkbox") control.checked = Boolean(value);
    else control.value = String(value);
  }
  setStatus("Preset aplicado.", "success");
  refresh();
  schedulePreview();
}

function hexToCss(hex, opacity) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#64748b";
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(.03, Math.min(1, opacity))})`;
}

function drawWatermarkPreview(context, baseViewport, viewport, ratio) {
  const opts = options();
  if (!currentSelection().has(state.previewPage) || !opts.text.trim()) return;

  const scale = viewport.width / baseViewport.width;
  const fontSizePdf = Math.max(8, Math.min(180, opts.fontSize));
  const fontSizeCanvas = fontSizePdf * scale;
  context.save();
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.font = `${opts.bold ? "700" : "400"} ${fontSizeCanvas}px Helvetica, Arial, sans-serif`;
  context.textBaseline = "alphabetic";

  const textWidthCanvas = context.measureText(opts.text.trim()).width;
  const textHeightCanvas = fontSizeCanvas * 0.86;
  const textWidthPdf = textWidthCanvas / scale;
  const textHeightPdf = textHeightCanvas / scale;
  const pageProxy = { getSize: () => ({ width: baseViewport.width, height: baseViewport.height }) };
  const placement = resolveWatermarkPlacement(pageProxy, textWidthPdf, textHeightPdf, opts);

  const x = placement.x * scale;
  const y = viewport.height - placement.y * scale;
  context.translate(x, y);
  context.rotate(-opts.rotation * Math.PI / 180);
  context.fillStyle = hexToCss(opts.color, opts.opacity);
  context.fillText(opts.text.trim(), 0, 0);
  context.restore();
}

async function renderPreview() {
  if (!state.pdfDocument || !state.pageCount || !els.previewCanvas) return;
  const serial = ++state.previewSerial;
  const stage = els.previewCanvas.closest(".watermark-preview-stage");
  stage?.classList.add("is-rendering");

  try {
    if (state.previewTask) {
      try { state.previewTask.cancel(); } catch {}
      state.previewTask = null;
    }

    state.previewPage = Math.max(1, Math.min(state.pageCount, Number(state.previewPage) || 1));
    els.previewPage.value = String(state.previewPage);
    updateManualGridState();

    const page = await state.pdfDocument.getPage(state.previewPage);
    if (serial !== state.previewSerial) return;

    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = 430;
    const targetHeight = 500;
    const scale = Math.min(1.35, targetWidth / baseViewport.width, targetHeight / baseViewport.height);
    const viewport = page.getViewport({ scale });
    const canvas = els.previewCanvas;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
    canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    state.previewTask = page.render({
      canvasContext: context,
      viewport,
      transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
    });
    await state.previewTask.promise;
    state.previewTask = null;
    if (serial !== state.previewSerial) return;

    drawWatermarkPreview(context, baseViewport, viewport, ratio);
    refresh();
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") {
      setStatus(error?.message || "No se pudo actualizar la vista previa.", "error");
    }
  } finally {
    stage?.classList.remove("is-rendering");
  }
}

let previewTimer = null;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => void renderPreview(), 80);
}

function downloadBytes(bytes, originalName) {
  const base = String(originalName || "Documento.pdf").replace(/\.pdf$/i, "");
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${base}_marca_agua.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function saveWatermark() {
  if (!state.bytes || state.busy) return;
  state.busy = true;
  refresh();
  setStatus("Aplicando la marca de agua localmente…", "info");

  try {
    const result = await applyTextWatermark(state.bytes, options());
    downloadBytes(result.bytes, state.file?.name);
    setStatus(`Marca aplicada correctamente en ${result.applied} páginas.`, "success");
  } catch (error) {
    setStatus(error?.message || "No se pudo crear la copia con marca de agua.", "error");
  } finally {
    state.busy = false;
    refresh();
  }
}

function openDialog() {
  if (!els.dialog) return;
  if (typeof els.dialog.showModal === "function" && !els.dialog.open) els.dialog.showModal();
  els.text.focus();
  refresh();
  schedulePreview();
}

document.querySelectorAll('[data-open-tool="watermark"]').forEach((button) => button.addEventListener("click", openDialog));
els.close.forEach((button) => button.addEventListener("click", () => { if (!state.busy) els.dialog?.close(); }));
els.choose?.addEventListener("click", () => els.fileInput?.click());
els.fileInput?.addEventListener("change", () => loadFile(els.fileInput.files?.[0]));
els.remove?.addEventListener("click", removeFile);
els.reset?.addEventListener("click", resetOptions);
els.save?.addEventListener("click", saveWatermark);
els.preset?.addEventListener("change", applyPreset);
els.selectAll?.addEventListener("click", () => setManualPages("all"));
els.selectNone?.addEventListener("click", () => setManualPages("none"));
els.selectInvert?.addEventListener("click", () => setManualPages("invert"));

els.previewFirst?.addEventListener("click", () => {
  state.previewPage = 1;
  void renderPreview();
});
els.previewPrev?.addEventListener("click", () => {
  state.previewPage = Math.max(1, state.previewPage - 1);
  void renderPreview();
});
els.previewNext?.addEventListener("click", () => {
  state.previewPage = Math.min(state.pageCount, state.previewPage + 1);
  void renderPreview();
});
els.previewLast?.addEventListener("click", () => {
  state.previewPage = state.pageCount;
  void renderPreview();
});
els.previewPage?.addEventListener("change", () => {
  state.previewPage = Number(els.previewPage.value) || 1;
  void renderPreview();
});

[
  els.text, els.pageMode, els.expression, els.position, els.fontSize,
  els.color, els.opacity, els.rotation, els.marginX, els.marginY, els.bold, els.skipCover,
].forEach((control) => {
  control?.addEventListener("input", () => { refresh(); schedulePreview(); });
  control?.addEventListener("change", () => { refresh(); schedulePreview(); });
});

refresh();
