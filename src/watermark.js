/* PDFPRIVADO_WATERMARK_UI_V1_4B_COMPACT_LAYOUTS */
import {
  applyImageWatermark,
  applyTextWatermark,
  resolveImageTilePlacements,
  resolveImageWatermarkSize,
  resolveWatermarkPlacement,
  selectedPagesForMode,
} from "./watermark-core.js";

const $ = (selector) => document.querySelector(selector);

const els = {
  dialog: $("#watermark-dialog"),
  fileInput: $("#watermark-file-input"),
  imageInput: $("#watermark-image-input"),
  typeText: $("#watermark-type-text"),
  typeImage: $("#watermark-type-image"),
  textField: $("#watermark-text-field"),
  imagePanel: $("#watermark-image-panel"),
  chooseImage: $("#watermark-choose-image"),
  removeImage: $("#watermark-remove-image"),
  imageName: $("#watermark-image-name"),
  imageMeta: $("#watermark-image-meta"),
  imageScale: $("#watermark-image-scale"),
  imageFit: $("#watermark-image-fit"),
  imageLayout: $("#watermark-image-layout"),
  imageTileControls: $("#watermark-image-tile-controls"),
  imageTileToggle: $("#watermark-image-tile-toggle"),
  imageGapX: $("#watermark-image-gap-x"),
  imageGapY: $("#watermark-image-gap-y"),
  imageRowOffset: $("#watermark-image-row-offset"),
  presetField: $("#watermark-preset-field"),
  fontSizeField: $("#watermark-font-size-field"),
  colorField: $("#watermark-color-field"),
  textChecks: $("#watermark-text-checks"),
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
  imageFile: null,
  imageBytes: null,
  imageMime: "",
  imageElement: null,
  imageUrl: "",
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

function currentMarkType() {
  return els.typeImage?.checked ? "image" : "text";
}
function options() {
  return {
    markType: currentMarkType(),
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
    imageScale: Number(els.imageScale?.value || 24),
    imageFit: els.imageFit?.value || "width",
    imageLayout: els.imageLayout?.value || "single",
    imageGapX: Number(els.imageGapX?.value || 80),
    imageGapY: Number(els.imageGapY?.value || 80),
    imageRowOffset: Number(els.imageRowOffset?.value || 50),
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
      if (els.pageMode) els.pageMode.value = "manual";
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
  const imageMode = opts.markType === "image";
  const textField = els.textField || els.text?.closest(".watermark-field");
  const presetField = els.presetField || els.preset?.closest(".watermark-field");
  const fontSizeField = els.fontSizeField || els.fontSize?.closest(".watermark-field");
  const colorField = els.colorField || els.color?.closest(".watermark-field");
  const textChecks = els.textChecks || els.bold?.closest(".watermark-checks");
  if (textField) textField.hidden = imageMode;
  if (els.imagePanel) els.imagePanel.hidden = !imageMode;
  if (presetField) presetField.hidden = imageMode;
  if (fontSizeField) fontSizeField.hidden = imageMode;
  if (colorField) colorField.hidden = imageMode;
  if (textChecks) textChecks.hidden = imageMode;
  els.expression.disabled = !rangeMode || state.busy;
  if (els.expressionField) els.expressionField.hidden = !rangeMode;
  if (els.manualPanel) els.manualPanel.hidden = !state.pageCount;
  els.choose.disabled = state.busy;
  els.remove.disabled = state.busy || !state.file;
  const selected = state.pageCount ? currentSelection() : new Set();
  const contentReady = imageMode ? Boolean(state.imageBytes) : Boolean(opts.text.trim());
  els.save.disabled = state.busy || !state.file || !contentReady || selected.size === 0;
  if (els.chooseImage) els.chooseImage.disabled = state.busy;
  if (els.removeImage) els.removeImage.disabled = state.busy || !state.imageBytes;
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


function revokeWatermarkImageUrl() {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = "";
}

async function loadWatermarkImage(file) {
  if (!file || state.busy) return;

  const mime = String(file.type || "").toLowerCase();
  const isPng = mime === "image/png" || /\.png$/i.test(file.name);
  const isJpeg = mime === "image/jpeg" || mime === "image/jpg" || /\.jpe?g$/i.test(file.name);

  if (!isPng && !isJpeg) {
    setStatus("Selecciona una imagen PNG o JPG.", "error");
    return;
  }

  try {
    revokeWatermarkImageUrl();

    const bytes = new Uint8Array(await file.arrayBuffer());
    const normalizedMime = isPng ? "image/png" : "image/jpeg";
    const url = URL.createObjectURL(new Blob([bytes], { type: normalizedMime }));
    const image = new Image();
    image.decoding = "async";

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
      image.src = url;
    });

    state.imageFile = file;
    state.imageBytes = bytes;
    state.imageMime = normalizedMime;
    state.imageElement = image;
    state.imageUrl = url;

    if (els.imageName) els.imageName.textContent = file.name;
    if (els.imageMeta) {
      els.imageMeta.textContent =
        `${image.naturalWidth} × ${image.naturalHeight} px · ${formatBytes(file.size)}`;
    }

    setStatus("Imagen preparada localmente.", "success");
    refresh();
    schedulePreview();
  } catch (error) {
    revokeWatermarkImageUrl();
    state.imageFile = null;
    state.imageBytes = null;
    state.imageMime = "";
    state.imageElement = null;
    setStatus(error?.message || "No se pudo preparar la imagen.", "error");
    refresh();
  }
}

function removeWatermarkImage() {
  revokeWatermarkImageUrl();
  state.imageFile = null;
  state.imageBytes = null;
  state.imageMime = "";
  state.imageElement = null;

  if (els.imageInput) els.imageInput.value = "";
  if (els.imageName) els.imageName.textContent = "Ninguna imagen seleccionada";
  if (els.imageMeta) {
    els.imageMeta.textContent = "PNG o JPG local. El archivo no sale del equipo.";
  }

  refresh();
  schedulePreview();
}

function syncWatermarkImageLayoutMode() {
  const opts = options();
  const imageMode = opts.markType === "image";
  const tileMode = imageMode && opts.imageLayout !== "single";
  const diagonalMode = imageMode && opts.imageLayout === "tile-diagonal";
  const popoverOpen = Boolean(els.imageTileToggle?.getAttribute("aria-expanded") === "true");

  if (els.imageTileToggle) {
    els.imageTileToggle.hidden = !tileMode;
    els.imageTileToggle.setAttribute("aria-expanded", String(tileMode && popoverOpen));
  }

  if (els.imageTileControls) {
    els.imageTileControls.hidden = !tileMode || !popoverOpen;
  }

  const positionField = els.position?.closest(".watermark-field");
  const marginXField = els.marginX?.closest(".watermark-field");
  const marginYField = els.marginY?.closest(".watermark-field");
  const rowOffsetField = els.imageRowOffset?.closest(".watermark-field");

  if (positionField) positionField.hidden = tileMode;
  if (marginXField) marginXField.hidden = tileMode;
  if (marginYField) marginYField.hidden = tileMode;
  if (rowOffsetField) rowOffsetField.hidden = !diagonalMode;

  if (!tileMode && els.imageTileToggle) {
    els.imageTileToggle.setAttribute("aria-expanded", "false");
  }
}
function syncWatermarkImageMode() {
  const imageMode = Boolean(els.typeImage?.checked);

  const textField = els.textField || els.text?.closest(".watermark-field");
  const presetField = els.presetField || els.preset?.closest(".watermark-field");
  const fontSizeField = els.fontSizeField || els.fontSize?.closest(".watermark-field");
  const colorField = els.colorField || els.color?.closest(".watermark-field");
  const textChecks = els.textChecks || els.bold?.closest(".watermark-checks");
  if (textField) textField.hidden = imageMode;
  if (els.imagePanel) els.imagePanel.hidden = !imageMode;
  if (presetField) presetField.hidden = imageMode;
  if (fontSizeField) fontSizeField.hidden = imageMode;
  if (colorField) colorField.hidden = imageMode;
  if (textChecks) textChecks.hidden = imageMode;

  document.querySelectorAll(".watermark-type-option").forEach((option) => {
    const input = option.querySelector('input[name="watermark-type"]');
    option.classList.toggle("is-active", Boolean(input?.checked));
  });

  refresh();
  schedulePreview();
}

function resetOptions() {
  els.typeText.checked = true;
  els.typeImage.checked = false;
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
  els.imageScale.value = "24";
  els.imageFit.value = "width";
  if (els.imageLayout) els.imageLayout.value = "single";
  if (els.imageGapX) els.imageGapX.value = "80";
  if (els.imageGapY) els.imageGapY.value = "80";
  if (els.imageRowOffset) els.imageRowOffset.value = "50";
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
  if (!currentSelection().has(state.previewPage)) return;

  const scale = viewport.width / baseViewport.width;
  const pageProxy = { getSize: () => ({ width: baseViewport.width, height: baseViewport.height }) };
  context.save();
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  if (opts.markType === "image") {
    if (!state.imageElement) {
      context.restore();
      return;
    }

    const placements = resolveImageTilePlacements(
      pageProxy,
      state.imageElement.naturalWidth,
      state.imageElement.naturalHeight,
      opts
    );

    context.globalAlpha = Math.max(.03, Math.min(1, opts.opacity));
    for (const placement of placements) {
      const x = placement.x * scale;
      const y = viewport.height - placement.y * scale;
      const width = placement.width * scale;
      const height = placement.height * scale;

      context.save();
      context.translate(x, y);
      context.rotate(-opts.rotation * Math.PI / 180);
      context.drawImage(state.imageElement, 0, -height, width, height);
      context.restore();
    }

    context.restore();
    return;
  }

  if (!opts.text.trim()) {
    context.restore();
    return;
  }

  const fontSizePdf = Math.max(8, Math.min(180, opts.fontSize));
  const fontSizeCanvas = fontSizePdf * scale;
  context.font = `${opts.bold ? "700" : "400"} ${fontSizeCanvas}px Helvetica, Arial, sans-serif`;
  context.textBaseline = "alphabetic";

  const textWidthCanvas = context.measureText(opts.text.trim()).width;
  const textHeightCanvas = fontSizeCanvas * 0.86;
  const textWidthPdf = textWidthCanvas / scale;
  const textHeightPdf = textHeightCanvas / scale;
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
    const opts = options();
    const result = opts.markType === "image"
      ? await applyImageWatermark(state.bytes, state.imageBytes, state.imageMime, opts)
      : await applyTextWatermark(state.bytes, opts);
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


els.removeImage?.addEventListener("click", removeWatermarkImage);


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
  els.imageScale, els.imageFit,
].forEach((control) => {
  control?.addEventListener("input", () => { refresh(); schedulePreview(); });
  control?.addEventListener("change", () => { refresh(); schedulePreview(); });
});

refresh();
/* PDFPRIVADO_WATERMARK_IMAGE_EVENTS_V1_3G */
els.typeText?.addEventListener("change", syncWatermarkImageMode);
els.typeImage?.addEventListener("change", syncWatermarkImageMode);

els.imageInput?.addEventListener("change", () => {
  const file = els.imageInput?.files?.[0];
  if (file) void loadWatermarkImage(file);
});

els.removeImage?.addEventListener("click", removeWatermarkImage);

[els.imageScale, els.imageFit].forEach((control) => {
  control?.addEventListener("input", () => {
    refresh();
    schedulePreview();
  });
  control?.addEventListener("change", () => {
    refresh();
    schedulePreview();
  });
});

syncWatermarkImageMode();
/* PDFPRIVADO_WATERMARK_NATIVE_IMAGE_PICKER_V1_3J */
els.chooseImage?.addEventListener("keydown", (event) => {
  if (state.busy) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    els.imageInput?.click();
  }
});
[els.imageLayout, els.imageGapX, els.imageGapY, els.imageRowOffset].forEach((control) => {
  control?.addEventListener("input", () => {
    syncWatermarkImageLayoutMode();
    refresh();
    schedulePreview();
  });
  control?.addEventListener("change", () => {
    syncWatermarkImageLayoutMode();
    refresh();
    schedulePreview();
  });
});
/* PDFPRIVADO_WATERMARK_TILE_POPOVER_V1_4B */
els.imageTileToggle?.addEventListener("click", () => {
  const open = els.imageTileToggle.getAttribute("aria-expanded") === "true";
  els.imageTileToggle.setAttribute("aria-expanded", String(!open));
  syncWatermarkImageLayoutMode();
});

document.addEventListener("click", (event) => {
  if (!els.imageTileControls || !els.imageTileToggle) return;
  if (els.imageTileControls.hidden) return;
  const target = event.target;
  if (els.imageTileControls.contains(target) || els.imageTileToggle.contains(target)) return;
  els.imageTileToggle.setAttribute("aria-expanded", "false");
  syncWatermarkImageLayoutMode();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !els.imageTileToggle) return;
  els.imageTileToggle.setAttribute("aria-expanded", "false");
  syncWatermarkImageLayoutMode();
});
