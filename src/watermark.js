/* PDFPRIVADO_WATERMARK_UI_V1_8D_QUICK_ROW_REORDER */
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
  typeCombined: $("#watermark-type-combined"),
  combinedTextTitle: $("#watermark-combined-text-title"),
  combinedImageTitle: $("#watermark-combined-image-title"),
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
  imageDesignPanel: $("#watermark-image-design-panel"),
  imagePosition: $("#watermark-image-position"),
  imageOpacity: $("#watermark-image-opacity"),
  imageRotation: $("#watermark-image-rotation"),
  imageMarginX: $("#watermark-image-margin-x"),
  imageMarginY: $("#watermark-image-margin-y"),
  textDesignTitle: $("#watermark-text-design-title"),
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
  customPresetList: $("#watermark-custom-preset-list"),
  customPresetSave: $("#watermark-custom-preset-save"),
  customPresetUpdate: $("#watermark-custom-preset-update"),
  customPresetDelete: $("#watermark-custom-preset-delete"),
  modeQuick: $("#watermark-mode-quick"),
  modeAdvanced: $("#watermark-mode-advanced"),
  textAdvancedToggle: $("#watermark-text-advanced-toggle"),
  imageAdvancedToggle: $("#watermark-image-advanced-toggle"),
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

const WATERMARK_UX_STORAGE_KEY = "pdfprivado.watermark.ux.v1";

function readWatermarkUxState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WATERMARK_UX_STORAGE_KEY) || "{}");
    return {
      mode: parsed.mode === "advanced" ? "advanced" : "quick",
      textOpen: Boolean(parsed.textOpen),
      imageOpen: Boolean(parsed.imageOpen),
    };
  } catch {
    return { mode: "quick", textOpen: false, imageOpen: false };
  }
}

const watermarkUxState = readWatermarkUxState();

function saveWatermarkUxState() {
  try {
    localStorage.setItem(WATERMARK_UX_STORAGE_KEY, JSON.stringify(watermarkUxState));
  } catch {}
}

function setAdvancedFieldVisibility(selector, visible) {
  document.querySelectorAll(selector).forEach((element) => {
    const field = element.matches(".watermark-field, .watermark-checks")
      ? element
      : element.closest(".watermark-field, .watermark-checks");
    if (field) field.hidden = !visible;
  });
}

function markWatermarkCompactField(control, className) {
  const field = control?.closest(".watermark-field");
  if (field) field.classList.add(className);
}

function moveWatermarkNode(node, target) {
  if (!node || !target) return;
  if (node.parentElement !== target) target.append(node);
}

function ensureWatermarkImageQuickRows() {
  const imagePanel = els.imagePanel;
  if (!imagePanel) return;

  const scaleField = els.imageScale?.closest(".watermark-field");
  const positionField = els.imagePosition?.closest(".watermark-field");
  const opacityField = els.imageOpacity?.closest(".watermark-field");
  const layoutField = els.imageLayout?.closest(".watermark-field");
  const imageAdvancedToggle = els.imageAdvancedToggle;
  const tileToggle = els.imageTileToggle;
  const tileControls = els.imageTileControls;

  const primaryRow = $("#watermark-image-primary-row");
  const secondaryRow = $("#watermark-image-secondary-row");

  if (!primaryRow || !secondaryRow) return;

  moveWatermarkNode(scaleField, primaryRow);
  moveWatermarkNode(positionField, primaryRow);
  moveWatermarkNode(opacityField, primaryRow);

  moveWatermarkNode(layoutField, secondaryRow);
  if (imageAdvancedToggle) {
    imageAdvancedToggle.classList.add("watermark-image-secondary-advanced-toggle");
    imageAdvancedToggle.textContent = "Más opciones de imagen";
    moveWatermarkNode(imageAdvancedToggle, secondaryRow);
  }

  if (tileToggle) {
    tileToggle.classList.add("watermark-image-tile-toggle-row");
    tileToggle.textContent = "Opciones de mosaico";
    if (tileToggle.parentElement !== imagePanel) {
      imagePanel.append(tileToggle);
    }
  }

  if (tileControls) {
    tileControls.classList.add("watermark-inline-tile-controls");
    if (tileControls.parentElement !== imagePanel) {
      imagePanel.append(tileControls);
    }
  }

  if (scaleField) scaleField.classList.add("watermark-image-primary-scale");
  if (positionField) positionField.classList.add("watermark-image-primary-position");
  if (opacityField) opacityField.classList.add("watermark-image-primary-opacity");
  if (layoutField) layoutField.classList.add("watermark-image-secondary-layout");
}

function ensureWatermarkImagePrimaryLayout() {
  const imagePanel = els.imagePanel;
  if (!imagePanel) return;

  const scaleField = els.imageScale?.closest(".watermark-field");
  const positionField = els.imagePosition?.closest(".watermark-field");
  const opacityField = els.imageOpacity?.closest(".watermark-field");
  const layoutField = els.imageLayout?.closest(".watermark-field");
  const tileToggle = els.imageTileToggle;
  const tileControls = els.imageTileControls;

  const originalLayoutPanel = layoutField?.closest(".watermark-image-layout-panel") || layoutField?.closest(".watermark-grid");

  let primaryRow = $("#watermark-image-primary-row");
  if (!primaryRow) {
    primaryRow = document.createElement("div");
    primaryRow.id = "watermark-image-primary-row";
    primaryRow.className = "watermark-grid watermark-image-primary-row";
    imagePanel.append(primaryRow);
  }

  let secondaryRow = $("#watermark-image-secondary-row");
  if (!secondaryRow) {
    secondaryRow = document.createElement("div");
    secondaryRow.id = "watermark-image-secondary-row";
    secondaryRow.className = "watermark-grid watermark-image-secondary-row";
    imagePanel.append(secondaryRow);
  }

  moveWatermarkNode(scaleField, primaryRow);
  moveWatermarkNode(positionField, primaryRow);
  moveWatermarkNode(opacityField, primaryRow);

  moveWatermarkNode(layoutField, secondaryRow);
  moveWatermarkNode(tileToggle, secondaryRow);

  if (tileControls) {
    tileControls.classList.add("watermark-inline-tile-controls");
    if (tileControls.parentElement !== imagePanel) {
      imagePanel.append(tileControls);
    }
  }

  if (scaleField) scaleField.classList.add("watermark-image-primary-scale");
  if (positionField) positionField.classList.add("watermark-image-primary-position");
  if (opacityField) opacityField.classList.add("watermark-image-primary-opacity");
  if (layoutField) layoutField.classList.add("watermark-image-secondary-layout");
  if (tileToggle) {
    tileToggle.classList.add("watermark-image-secondary-toggle");
    tileToggle.textContent = "Opciones de mosaico";
  }

  if (originalLayoutPanel) {
    originalLayoutPanel.classList.add("watermark-image-layout-panel-migrated");
  }
}

function applyCompactWatermarkLayoutHints() {
  els.imagePanel?.classList.add("watermark-panel-compact");
  els.imageDesignPanel?.classList.add("watermark-panel-compact");
  markWatermarkCompactField(els.imageScale, "watermark-field-compact-narrow");
  markWatermarkCompactField(els.imageFit, "watermark-field-compact-wide");
  markWatermarkCompactField(els.imageLayout, "watermark-field-compact-wide");
  markWatermarkCompactField(els.imagePosition, "watermark-field-compact-wide");
  markWatermarkCompactField(els.imageOpacity, "watermark-field-compact-narrow");
  markWatermarkCompactField(els.imageRotation, "watermark-field-compact-narrow");
  markWatermarkCompactField(els.imageMarginX, "watermark-field-compact-narrow");
  markWatermarkCompactField(els.imageMarginY, "watermark-field-compact-narrow");
  markWatermarkCompactField(els.position, "watermark-field-compact-wide");
  markWatermarkCompactField(els.opacity, "watermark-field-compact-narrow");
  markWatermarkCompactField(els.fontSize, "watermark-field-compact-narrow");
  markWatermarkCompactField(els.color, "watermark-field-compact-wide");
  markWatermarkCompactField(els.rotation, "watermark-field-compact-narrow");
  markWatermarkCompactField(els.marginX, "watermark-field-compact-narrow");
  markWatermarkCompactField(els.marginY, "watermark-field-compact-narrow");
}

function applyWatermarkProgressiveUi() {
  const advancedMode = watermarkUxState.mode === "advanced";
  const textVisible = advancedMode || watermarkUxState.textOpen;
  const imageVisible = advancedMode || watermarkUxState.imageOpen;

  if (els.modeQuick) els.modeQuick.checked = !advancedMode;
  if (els.modeAdvanced) els.modeAdvanced.checked = advancedMode;

  setAdvancedFieldVisibility("[data-watermark-text-advanced]", textVisible);
  setAdvancedFieldVisibility("[data-watermark-text-advanced-control]", textVisible);
  setAdvancedFieldVisibility("#watermark-text-checks", textVisible);

  setAdvancedFieldVisibility("[data-watermark-image-advanced-control]", imageVisible);

  if (els.textAdvancedToggle) {
    els.textAdvancedToggle.hidden = advancedMode;
    els.textAdvancedToggle.setAttribute("aria-expanded", String(textVisible));
    els.textAdvancedToggle.textContent = textVisible
      ? "Ocultar opciones de texto"
      : "Más opciones de texto";
  }

  if (els.imageAdvancedToggle) {
    els.imageAdvancedToggle.hidden = advancedMode;
    els.imageAdvancedToggle.setAttribute("aria-expanded", String(imageVisible));
    els.imageAdvancedToggle.textContent = imageVisible
      ? "Ocultar opciones de imagen"
      : "Más opciones de imagen";
  }

  els.dialog?.classList.toggle("watermark-quick-mode", !advancedMode);
  els.dialog?.classList.toggle("watermark-advanced-mode", advancedMode);
}
const WATERMARK_PRESET_DB_NAME = "pdfprivado-pro";
const WATERMARK_PRESET_DB_VERSION = 1;
const WATERMARK_PRESET_STORE = "watermark-presets";

function openWatermarkPresetDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WATERMARK_PRESET_DB_NAME, WATERMARK_PRESET_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WATERMARK_PRESET_STORE)) {
        db.createObjectStore(WATERMARK_PRESET_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
  });
}

async function watermarkPresetTransaction(mode, action) {
  const db = await openWatermarkPresetDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(WATERMARK_PRESET_STORE, mode);
      const store = transaction.objectStore(WATERMARK_PRESET_STORE);
      let request;
      try {
        request = action(store);
      } catch (error) {
        reject(error);
        return;
      }
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo completar la operación local."));
    });
  } finally {
    db.close();
  }
}

function listWatermarkPresets() {
  return watermarkPresetTransaction("readonly", (store) => store.getAll());
}

function getWatermarkPreset(id) {
  return watermarkPresetTransaction("readonly", (store) => store.get(id));
}

function putWatermarkPreset(preset) {
  return watermarkPresetTransaction("readwrite", (store) => store.put(preset));
}

function deleteWatermarkPresetRecord(id) {
  return watermarkPresetTransaction("readwrite", (store) => store.delete(id));
}

function createPresetId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `watermark-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function serializeWatermarkPreset(name, existingId = "") {
  const opts = options();
  return {
    id: existingId || createPresetId(),
    name: String(name || "").trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    options: {
      ...opts,
      manualPages: [...opts.manualPages],
    },
    image: state.imageBytes
      ? {
          name: state.imageFile?.name || "logotipo",
          mime: state.imageMime,
          bytes: state.imageBytes.slice(),
        }
      : null,
  };
}

async function restorePresetImage(imageRecord) {
  removeWatermarkImage();
  if (!imageRecord?.bytes?.byteLength) return;

  const blob = new Blob([imageRecord.bytes], { type: imageRecord.mime || "image/png" });
  const file = new File([blob], imageRecord.name || "logotipo.png", {
    type: imageRecord.mime || "image/png",
  });
  await loadWatermarkImage(file);
}

function setControlValue(control, value) {
  if (!control || value === undefined || value === null) return;
  if (control.type === "checkbox" || control.type === "radio") {
    control.checked = Boolean(value);
  } else {
    control.value = String(value);
  }
}

async function applyWatermarkPresetRecord(record) {
  if (!record?.options) return;
  const opts = record.options;

  if (opts.markType === "combined" && els.typeCombined) els.typeCombined.checked = true;
  else if (opts.markType === "image" && els.typeImage) els.typeImage.checked = true;
  else if (els.typeText) els.typeText.checked = true;

  setControlValue(els.text, opts.text);
  setControlValue(els.pageMode, opts.pageMode);
  setControlValue(els.expression, opts.pageExpression);
  setControlValue(els.skipCover, opts.skipCover);
  setControlValue(els.position, opts.position);
  setControlValue(els.fontSize, opts.fontSize);
  setControlValue(els.color, opts.color);
  setControlValue(els.opacity, Math.round(Number(opts.opacity || .18) * 100));
  setControlValue(els.rotation, opts.rotation);
  setControlValue(els.marginX, opts.marginX);
  setControlValue(els.marginY, opts.marginY);
  setControlValue(els.bold, opts.bold);
  setControlValue(els.imageScale, opts.imageScale);
  setControlValue(els.imageFit, opts.imageFit);
  setControlValue(els.imageLayout, opts.imageLayout);
  setControlValue(els.imageGapX, opts.imageGapX);
  setControlValue(els.imageGapY, opts.imageGapY);
  setControlValue(els.imageRowOffset, opts.imageRowOffset);
  setControlValue(els.imagePosition, opts.imagePosition);
  setControlValue(els.imageOpacity, Math.round(Number(opts.imageOpacity || .18) * 100));
  setControlValue(els.imageRotation, opts.imageRotation);
  setControlValue(els.imageMarginX, opts.imageMarginX);
  setControlValue(els.imageMarginY, opts.imageMarginY);

  state.manualPages = new Set(
    Array.isArray(opts.manualPages)
      ? opts.manualPages.filter((page) => Number.isInteger(page) && page >= 1 && page <= state.pageCount)
      : Array.from({ length: state.pageCount }, (_, index) => index + 1)
  );

  await restorePresetImage(record.image);
  syncWatermarkImageMode();
  syncWatermarkImageLayoutMode();
  updateManualGridState();
  refresh();
  schedulePreview();
}

async function refreshWatermarkPresetList(selectedId = "") {
  if (!els.customPresetList) return;
  const records = await listWatermarkPresets();
  records.sort((a, b) => String(a.name).localeCompare(String(b.name), "es", { sensitivity: "base" }));

  els.customPresetList.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = records.length ? "Selecciona un preset" : "No hay presets guardados";
  els.customPresetList.append(empty);

  for (const record of records) {
    const option = document.createElement("option");
    option.value = record.id;
    option.textContent = record.name;
    els.customPresetList.append(option);
  }

  els.customPresetList.value = selectedId && records.some((record) => record.id === selectedId)
    ? selectedId
    : "";

  const selected = Boolean(els.customPresetList.value);
  if (els.customPresetUpdate) els.customPresetUpdate.disabled = !selected || state.busy;
  if (els.customPresetDelete) els.customPresetDelete.disabled = !selected || state.busy;
}

async function saveNewWatermarkPreset() {
  if (state.busy) return;
  const proposed = window.prompt("Nombre del nuevo preset:");
  const name = String(proposed || "").trim();
  if (!name) return;

  const records = await listWatermarkPresets();
  if (records.some((record) => record.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) {
    setStatus("Ya existe un preset con ese nombre. Selecciónalo y pulsa Actualizar.", "error");
    return;
  }

  const preset = serializeWatermarkPreset(name);
  await putWatermarkPreset(preset);
  await refreshWatermarkPresetList(preset.id);
  setStatus(`Preset “${name}” guardado únicamente en este equipo.`, "success");
}

async function updateSelectedWatermarkPreset() {
  const id = els.customPresetList?.value;
  if (!id || state.busy) return;
  const existing = await getWatermarkPreset(id);
  if (!existing) {
    await refreshWatermarkPresetList();
    return;
  }

  const preset = serializeWatermarkPreset(existing.name, existing.id);
  preset.createdAt = existing.createdAt || Date.now();
  await putWatermarkPreset(preset);
  await refreshWatermarkPresetList(id);
  setStatus(`Preset “${existing.name}” actualizado.`, "success");
}

async function deleteSelectedWatermarkPreset() {
  const id = els.customPresetList?.value;
  if (!id || state.busy) return;
  const existing = await getWatermarkPreset(id);
  if (!existing) return;

  if (!window.confirm(`¿Eliminar el preset “${existing.name}”?`)) return;
  await deleteWatermarkPresetRecord(id);
  await refreshWatermarkPresetList();
  setStatus("Preset eliminado del almacenamiento local.", "success");
}
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
  if (els.typeCombined?.checked) return "combined";
  if (els.typeImage?.checked) return "image";
  return "text";
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
    imagePosition: els.imagePosition?.value || "center",
    imageOpacity: Number(els.imageOpacity?.value || 18) / 100,
    imageRotation: Number(els.imageRotation?.value || 0),
    imageMarginX: Number(els.imageMarginX?.value || 24),
    imageMarginY: Number(els.imageMarginY?.value || 24),
  };
}

function imageOptionsFrom(opts) {
  return {
    ...opts,
    position: opts.imagePosition,
    opacity: opts.imageOpacity,
    rotation: opts.imageRotation,
    marginX: opts.imageMarginX,
    marginY: opts.imageMarginY,
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
  const textOnly = opts.markType === "text";
  const imageOnly = opts.markType === "image";
  const combined = opts.markType === "combined";
  const textActive = textOnly || combined;
  const imageActive = imageOnly || combined;

  const textField = els.textField || els.text?.closest(".watermark-field");
  const presetField = els.presetField || els.preset?.closest(".watermark-field");
  const fontSizeField = els.fontSizeField || els.fontSize?.closest(".watermark-field");
  const colorField = els.colorField || els.color?.closest(".watermark-field");
  const textChecks = els.textChecks || els.bold?.closest(".watermark-checks");

  if (textField) textField.hidden = !textActive;
  if (presetField) presetField.hidden = !textActive;
  if (fontSizeField) fontSizeField.hidden = !textActive;
  if (colorField) colorField.hidden = !textActive;
  if (textChecks) textChecks.hidden = !textActive;
  if (els.imagePanel) els.imagePanel.hidden = !imageActive;
  if (els.imageDesignPanel) els.imageDesignPanel.hidden = !imageActive;
  if (els.textDesignTitle) els.textDesignTitle.hidden = !textActive;
  if (els.combinedTextTitle) els.combinedTextTitle.hidden = !combined;
  if (els.combinedImageTitle) els.combinedImageTitle.hidden = !combined;

  els.expression.disabled = !rangeMode || state.busy;
  if (els.expressionField) els.expressionField.hidden = !rangeMode;
  if (els.manualPanel) els.manualPanel.hidden = !state.pageCount || opts.pageMode !== "manual";
  els.choose.disabled = state.busy;
  els.remove.disabled = state.busy || !state.file;

  const selected = state.pageCount ? currentSelection() : new Set();
  const textReady = Boolean(opts.text.trim());
  const imageReady = Boolean(state.imageBytes);
  const contentReady = combined
    ? textReady && imageReady
    : imageOnly
      ? imageReady
      : textReady;

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
    const selectedNow = currentSelection();
    if (selectedNow.size === 0) {
      els.selectionSummary.textContent = "No hay páginas seleccionadas. Elige al menos una para poder guardar.";
      els.selectionSummary.dataset.state = "warning";
    } else {
      const coverText = opts.skipCover ? " · portada omitida" : "";
      els.selectionSummary.textContent = `${selectedNow.size} de ${state.pageCount} páginas recibirán la marca${coverText}.`;
      els.selectionSummary.dataset.state = "ready";
    }
    if (els.footerSummary) {
      els.footerSummary.textContent = selectedNow.size
        ? `${selectedNow.size} página${selectedNow.size === 1 ? "" : "s"} seleccionada${selectedNow.size === 1 ? "" : "s"}`
        : "Ninguna página seleccionada";
      els.footerSummary.dataset.state = selectedNow.size ? "ready" : "warning";
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

function syncWatermarkCombinedMode() {
  const opts = options();
  const textOnly = opts.markType === "text";
  const imageOnly = opts.markType === "image";
  const combined = opts.markType === "combined";
  const textActive = textOnly || combined;
  const imageActive = imageOnly || combined;

  const textField = els.textField || els.text?.closest(".watermark-field");
  const presetField = els.presetField || els.preset?.closest(".watermark-field");
  const fontSizeField = els.fontSizeField || els.fontSize?.closest(".watermark-field");
  const colorField = els.colorField || els.color?.closest(".watermark-field");
  const textChecks = els.textChecks || els.bold?.closest(".watermark-checks");

  if (textField) textField.hidden = !textActive;
  if (presetField) presetField.hidden = !textActive;
  if (fontSizeField) fontSizeField.hidden = !textActive;
  if (colorField) colorField.hidden = !textActive;
  if (textChecks) textChecks.hidden = !textActive;

  if (els.imagePanel) els.imagePanel.hidden = !imageActive;
  if (els.imageDesignPanel) els.imageDesignPanel.hidden = !imageActive;
  if (els.textDesignTitle) els.textDesignTitle.hidden = !textActive;
  if (els.combinedNote) els.combinedNote.hidden = !combined;
}
function syncWatermarkImageLayoutMode() {
  const opts = options();
  const imageMode = opts.markType === "image" || opts.markType === "combined";
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
  const opts = options();
  const textOnly = opts.markType === "text";
  const imageOnly = opts.markType === "image";
  const combined = opts.markType === "combined";
  const textActive = textOnly || combined;
  const imageActive = imageOnly || combined;

  document.querySelectorAll(".watermark-type-option").forEach((option) => {
    const input = option.querySelector('input[name="watermark-type"]');
    option.classList.toggle("is-active", Boolean(input?.checked));
  });

  const textField = els.textField || els.text?.closest(".watermark-field");
  const presetField = els.presetField || els.preset?.closest(".watermark-field");
  const fontSizeField = els.fontSizeField || els.fontSize?.closest(".watermark-field");
  const colorField = els.colorField || els.color?.closest(".watermark-field");
  const textChecks = els.textChecks || els.bold?.closest(".watermark-checks");

  if (textField) textField.hidden = !textActive;
  if (presetField) presetField.hidden = !textActive;
  if (fontSizeField) fontSizeField.hidden = !textActive;
  if (colorField) colorField.hidden = !textActive;
  if (textChecks) textChecks.hidden = !textActive;
  if (els.imagePanel) els.imagePanel.hidden = !imageActive;
  if (els.imageDesignPanel) els.imageDesignPanel.hidden = !imageActive;
  if (els.textDesignTitle) els.textDesignTitle.hidden = !textActive;
  if (els.combinedNote) els.combinedNote.hidden = !combined;

  syncWatermarkImageLayoutMode();
  refresh();
  schedulePreview();
}

function resetOptions() {
  els.typeText.checked = true;
  els.typeImage.checked = false;
  if (els.typeCombined) els.typeCombined.checked = false;
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
  if (els.imagePosition) els.imagePosition.value = "center";
  if (els.imageOpacity) els.imageOpacity.value = "18";
  if (els.imageRotation) els.imageRotation.value = "0";
  if (els.imageMarginX) els.imageMarginX.value = "24";
  if (els.imageMarginY) els.imageMarginY.value = "24";
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
  const imageOpts = imageOptionsFrom(opts);
  if (!currentSelection().has(state.previewPage)) return;

  const scale = viewport.width / baseViewport.width;
  const pageProxy = { getSize: () => ({ width: baseViewport.width, height: baseViewport.height }) };
  const drawText = opts.markType === "text" || opts.markType === "combined";
  const drawImage = opts.markType === "image" || opts.markType === "combined";

  context.save();
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  if (drawImage && state.imageElement) {
    const placements = resolveImageTilePlacements(
      pageProxy,
      state.imageElement.naturalWidth,
      state.imageElement.naturalHeight,
      imageOpts
    );

    context.globalAlpha = Math.max(.03, Math.min(1, imageOpts.opacity));
    for (const placement of placements) {
      const x = placement.x * scale;
      const y = viewport.height - placement.y * scale;
      const width = placement.width * scale;
      const height = placement.height * scale;

      context.save();
      context.translate(x, y);
      context.rotate(-imageOpts.rotation * Math.PI / 180);
      context.drawImage(state.imageElement, 0, -height, width, height);
      context.restore();
    }
    context.globalAlpha = 1;
  }

  if (drawText && opts.text.trim()) {
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
    context.save();
    context.translate(x, y);
    context.rotate(-opts.rotation * Math.PI / 180);
    context.fillStyle = hexToCss(opts.color, opts.opacity);
    context.fillText(opts.text.trim(), 0, 0);
    context.restore();
  }

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
    const imageOpts = imageOptionsFrom(opts);
    let result;

    if (opts.markType === "combined") {
      const textResult = await applyTextWatermark(state.bytes, opts);
      result = await applyImageWatermark(
        textResult.bytes,
        state.imageBytes,
        state.imageMime,
        imageOpts
      );
    } else if (opts.markType === "image") {
      result = await applyImageWatermark(
        state.bytes,
        state.imageBytes,
        state.imageMime,
        imageOpts
      );
    } else {
      result = await applyTextWatermark(state.bytes, opts);
    }

    downloadBytes(result.bytes, state.file?.name);
    const label = opts.markType === "combined" ? "Texto e imagen aplicados" : "Marca aplicada";
    setStatus(`${label} correctamente en ${result.applied} páginas.`, "success");
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
  els.imagePosition, els.imageOpacity, els.imageRotation, els.imageMarginX, els.imageMarginY,
].forEach((control) => {
  control?.addEventListener("input", () => { refresh(); schedulePreview(); });
  control?.addEventListener("change", () => { refresh(); schedulePreview(); });
});

refresh();
/* PDFPRIVADO_WATERMARK_IMAGE_EVENTS_V1_3G */
els.typeText?.addEventListener("change", syncWatermarkImageMode);
els.typeImage?.addEventListener("change", syncWatermarkImageMode);
els.typeCombined?.addEventListener("change", syncWatermarkImageMode);

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

syncWatermarkCombinedMode();
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
/* PDFPRIVADO_WATERMARK_CUSTOM_PRESETS_V1_7A */
els.customPresetList?.addEventListener("change", async () => {
  const id = els.customPresetList.value;
  if (!id) {
    refresh();
    return;
  }

  try {
    const record = await getWatermarkPreset(id);
    if (record) {
      await applyWatermarkPresetRecord(record);
      setStatus(`Preset “${record.name}” aplicado.`, "success");
    }
  } catch (error) {
    setStatus(error?.message || "No se pudo cargar el preset.", "error");
  } finally {
    refresh();
  }
});

els.customPresetSave?.addEventListener("click", () => {
  void saveNewWatermarkPreset().catch((error) => {
    setStatus(error?.message || "No se pudo guardar el preset.", "error");
  });
});

els.customPresetUpdate?.addEventListener("click", () => {
  void updateSelectedWatermarkPreset().catch((error) => {
    setStatus(error?.message || "No se pudo actualizar el preset.", "error");
  });
});

els.customPresetDelete?.addEventListener("click", () => {
  void deleteSelectedWatermarkPreset().catch((error) => {
    setStatus(error?.message || "No se pudo eliminar el preset.", "error");
  });
});

void refreshWatermarkPresetList().catch(() => {
  setStatus("Los presets locales no están disponibles en este entorno.", "error");
});
/* PDFPRIVADO_WATERMARK_PROGRESSIVE_UX_V1_8A */
els.modeQuick?.addEventListener("change", () => {
  if (!els.modeQuick.checked) return;
  watermarkUxState.mode = "quick";
  saveWatermarkUxState();
  applyWatermarkProgressiveUi();
});

els.modeAdvanced?.addEventListener("change", () => {
  if (!els.modeAdvanced.checked) return;
  watermarkUxState.mode = "advanced";
  saveWatermarkUxState();
  applyWatermarkProgressiveUi();
});

els.textAdvancedToggle?.addEventListener("click", () => {
  watermarkUxState.textOpen = !watermarkUxState.textOpen;
  saveWatermarkUxState();
  applyWatermarkProgressiveUi();
});

els.imageAdvancedToggle?.addEventListener("click", () => {
  watermarkUxState.imageOpen = !watermarkUxState.imageOpen;
  saveWatermarkUxState();
  applyWatermarkProgressiveUi();
});

applyWatermarkProgressiveUi();

/* PDFPRIVADO_WATERMARK_COMPACT_DENSITY_V1_8B */
applyCompactWatermarkLayoutHints();

/* PDFPRIVADO_WATERMARK_ULTRACOMPACT_QUICK_V1_8C */
ensureWatermarkImagePrimaryLayout();

ensureWatermarkImageQuickRows();
