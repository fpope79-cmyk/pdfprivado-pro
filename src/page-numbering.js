/* PDFPRIVADO_PAGE_NUMBERING_PREMIUM_V1 */
import * as pdfjsLib from "./vendor/pdfjs/pdf.mjs";
import {
  applyPageNumbering,
  formatPageLabel,
  selectedPagesForMode,
  verifyNumberedPdf,
} from "./page-numbering-core.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.mjs", import.meta.url).href;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const dialog = $("#page-numbering-dialog");
if (!dialog) throw new Error("Falta #page-numbering-dialog");

const els = {
  open: $$('[data-open-tool="page-numbering"]'),
  close: $$("[data-page-numbering-close]"),
  useViewer: $("#page-numbering-use-viewer"),
  chooseFile: $("#page-numbering-choose-file"),
  removeFile: $("#page-numbering-remove-file"),
  fileName: $("#page-numbering-file-name"),
  fileMeta: $("#page-numbering-file-meta"),
  previewCanvas: $("#page-numbering-preview-canvas"),
  previewLabel: $("#page-numbering-preview-label"),
  previewPage: $("#page-numbering-preview-page"),
  previewPrev: $("#page-numbering-preview-prev"),
  previewNext: $("#page-numbering-preview-next"),
  pageMode: $("#page-numbering-page-mode"),
  expression: $("#page-numbering-expression"),
  manualGrid: $("#page-numbering-manual-grid"),
  selectionSummary: $("#page-numbering-selection-summary"),
  position: $("#page-numbering-position"),
  marginX: $("#page-numbering-margin-x"),
  marginY: $("#page-numbering-margin-y"),
  initialNumber: $("#page-numbering-initial"),
  restartPage: $("#page-numbering-restart-page"),
  skipCover: $("#page-numbering-skip-cover"),
  format: $("#page-numbering-format"),
  digits: $("#page-numbering-digits"),
  prefix: $("#page-numbering-prefix"),
  suffix: $("#page-numbering-suffix"),
  fontSize: $("#page-numbering-font-size"),
  color: $("#page-numbering-color"),
  opacity: $("#page-numbering-opacity"),
  bold: $("#page-numbering-bold"),
  background: $("#page-numbering-background"),
  backgroundColor: $("#page-numbering-background-color"),
  backgroundOpacity: $("#page-numbering-background-opacity"),
  border: $("#page-numbering-border"),
  borderWidth: $("#page-numbering-border-width"),
  paddingX: $("#page-numbering-padding-x"),
  paddingY: $("#page-numbering-padding-y"),
  progress: $("#page-numbering-progress"),
  status: $("#page-numbering-status"),
  save: $("#page-numbering-save"),
  reset: $("#page-numbering-reset"),
  template: $("#page-numbering-template"),
  presetSelect: $("#page-numbering-preset-select"),
  presetName: $("#page-numbering-preset-name"),
  presetApply: $("#page-numbering-preset-apply"),
  presetSave: $("#page-numbering-preset-save"),
  presetOverwrite: $("#page-numbering-preset-overwrite"),
  presetDelete: $("#page-numbering-preset-delete"),
  presetExport: $("#page-numbering-preset-export"),
  presetImport: $("#page-numbering-preset-import"),
  presetFile: $("#page-numbering-preset-file"),
  modeTabs: $$("[data-page-numbering-mode]"),
  modePanels: $$("[data-page-numbering-panel]"),
  batchRoot: $("#page-numbering-batch"),
  batchAdd: $("#page-numbering-batch-add"),
  batchClear: $("#page-numbering-batch-clear"),
  batchProcess: $("#page-numbering-batch-process"),
  batchNamePattern: $("#page-numbering-batch-name-pattern"),
  batchList: $("#page-numbering-batch-list"),
  batchEmpty: $("#page-numbering-batch-empty"),
  batchSummary: $("#page-numbering-batch-summary"),
  batchProgressWrap: $("#page-numbering-batch-progress-wrap"),
  batchProgress: $("#page-numbering-batch-progress"),
  batchProgressValue: $("#page-numbering-batch-progress-value"),
  batchStatus: $("#page-numbering-batch-status"),
  batchCurrent: $("#page-numbering-batch-current"),
  batchPreviewName: $("#page-numbering-batch-preview-name"),
  batchPreviewMeta: $("#page-numbering-batch-preview-meta"),
  batchPreviewCanvas: $("#page-numbering-batch-preview-canvas"),
  batchPreviewLabel: $("#page-numbering-batch-preview-label"),
  batchPreviewPage: $("#page-numbering-batch-preview-page"),
  batchPreviewPrev: $("#page-numbering-batch-preview-prev"),
  batchPreviewNext: $("#page-numbering-batch-preview-next"),
  batchConfigSummary: $("#page-numbering-batch-config-summary"),
  batchConfigToggle: $("#page-numbering-batch-config-toggle"),
  batchConfigBody: $("#page-numbering-batch-config-body"),
  batchPreset: $("#page-numbering-batch-preset"),
  batchPresetApply: $("#page-numbering-batch-preset-apply"),
  batchConfig: {
    pageMode: $("#page-numbering-batch-page-mode"),
    pageExpression: $("#page-numbering-batch-expression"),
    position: $("#page-numbering-batch-position"),
    initialNumber: $("#page-numbering-batch-initial"),
    marginX: $("#page-numbering-batch-margin-x"),
    marginY: $("#page-numbering-batch-margin-y"),
    restartPage: $("#page-numbering-batch-restart"),
    skipCover: $("#page-numbering-batch-skip-cover"),
    format: $("#page-numbering-batch-format"),
    digits: $("#page-numbering-batch-digits"),
    template: $("#page-numbering-batch-template"),
    prefix: $("#page-numbering-batch-prefix"),
    suffix: $("#page-numbering-batch-suffix"),
    fontSize: $("#page-numbering-batch-font-size"),
    color: $("#page-numbering-batch-color"),
    opacity: $("#page-numbering-batch-opacity"),
    bold: $("#page-numbering-batch-bold"),
    background: $("#page-numbering-batch-background"),
    backgroundColor: $("#page-numbering-batch-background-color"),
    backgroundOpacity: $("#page-numbering-batch-background-opacity"),
    border: $("#page-numbering-batch-border"),
    borderWidth: $("#page-numbering-batch-border-width"),
    paddingX: $("#page-numbering-batch-padding-x"),
    paddingY: $("#page-numbering-batch-padding-y"),
  },
};

const state = {
  bytes: null,
  info: null,
  source: null,
  pdfDocument: null,
  previewPage: 1,
  manualPages: new Set(),
  busy: false,
  lastTrigger: null,
  previewSerial: 0,
  previewTimer: null,
  previewTask: null,
  customPresets: [],
  mode: "single",
  batchItems: [],
  batchBusy: false,
  batchCancelRequested: false,
  batchDestination: "",
  batchResults: [],
  batchDragId: null,
  batchSelectedId: null,
  batchPreviewDocument: null,
  batchPreviewPage: 1,
  batchPreviewTask: null,
  batchPreviewSerial: 0,
};

const PRESET_STORAGE_KEY = "pdfprivado.page-numbering.presets.v2";
const BUILTIN_PRESETS = Object.freeze([
  { id: "builtin-page-total", name: "Página X de N", builtIn: true, values: { format: "page-total", position: "bottom-center", fontSize: 11, opacity: 90, marginX: 24, marginY: 20 } },
  { id: "builtin-legal", name: "Numeración jurídica", builtIn: true, values: { format: "custom-template", template: "Folio {numero} de {total}", position: "top-right", bold: true, fontSize: 10, marginX: 28, marginY: 24 } },
  { id: "builtin-roman", name: "Preliminares romanos", builtIn: true, values: { format: "roman-lower", position: "bottom-center", fontSize: 11, opacity: 85 } },
  { id: "builtin-file-page", name: "Expediente y página", builtIn: true, values: { format: "custom-template", template: "{nombre} · pág. {pagina}/{total}", position: "bottom-right", fontSize: 9, opacity: 75 } },
  { id: "builtin-discreet", name: "Pie discreto", builtIn: true, values: { format: "number", position: "bottom-center", fontSize: 8, color: "#64748b", opacity: 60, marginY: 14 } },
]);

function safePresetValues(values = {}) {
  const allowed = [
    "pageMode", "pageExpression", "position", "marginX", "marginY",
    "initialNumber", "restartPage", "skipCover", "format", "digits",
    "template", "prefix", "suffix", "fontSize", "color", "opacity",
    "bold", "background", "backgroundColor", "backgroundOpacity",
    "border", "borderWidth", "paddingX", "paddingY",
  ];
  return Object.fromEntries(
    allowed.filter((key) => Object.prototype.hasOwnProperty.call(values, key))
      .map((key) => [key, values[key]])
  );
}

function loadCustomPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || "[]");
    state.customPresets = Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.name === "string" && item.values)
          .map((item) => ({ id: String(item.id || `custom-${Date.now()}`), name: item.name.slice(0, 60), builtIn: false, values: safePresetValues(item.values) }))
      : [];
  } catch {
    state.customPresets = [];
  }
}

function saveCustomPresets() {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(state.customPresets));
}

function allPresets() {
  return [...BUILTIN_PRESETS, ...state.customPresets];
}

function renderPresetSelect(selectedId = "") {
  const current = selectedId || els.presetSelect.value;
  els.presetSelect.replaceChildren();
  const builtInGroup = document.createElement("optgroup");
  builtInGroup.label = "Incluidos";
  for (const preset of BUILTIN_PRESETS) builtInGroup.append(new Option(preset.name, preset.id));
  const customGroup = document.createElement("optgroup");
  customGroup.label = "Mis presets";
  if (state.customPresets.length === 0) {
    const empty = new Option("Todavía no hay presets personalizados", "");
    empty.disabled = true;
    customGroup.append(empty);
  } else {
    for (const preset of state.customPresets) customGroup.append(new Option(preset.name, preset.id));
  }
  els.presetSelect.append(builtInGroup, customGroup);
  const exists = allPresets().some((preset) => preset.id === current);
  els.presetSelect.value = exists ? current : BUILTIN_PRESETS[0].id;
  updatePresetButtons();
}

function currentPreset() {
  return allPresets().find((preset) => preset.id === els.presetSelect.value) || null;
}

function currentPresetValues() {
  const value = options();
  delete value.manualPages;
  delete value.fileName;
  return safePresetValues(value);
}

function setControlValue(element, value) {
  if (!element || value === undefined) return;
  if (element.type === "checkbox") element.checked = Boolean(value);
  else element.value = String(value);
}

function applyPresetValues(values = {}) {
  const map = {
    pageMode: els.pageMode, pageExpression: els.expression, position: els.position,
    marginX: els.marginX, marginY: els.marginY, initialNumber: els.initialNumber,
    restartPage: els.restartPage, skipCover: els.skipCover, format: els.format,
    digits: els.digits, template: els.template, prefix: els.prefix, suffix: els.suffix,
    fontSize: els.fontSize, color: els.color, opacity: els.opacity, bold: els.bold,
    background: els.background, backgroundColor: els.backgroundColor,
    backgroundOpacity: els.backgroundOpacity, border: els.border,
    borderWidth: els.borderWidth, paddingX: els.paddingX, paddingY: els.paddingY,
  };
  for (const [key, element] of Object.entries(map)) setControlValue(element, values[key]);
  updateControls();
  schedulePreview();
}

function applySelectedPreset() {
  const preset = currentPreset();
  if (!preset) return;
  applyPresetValues(preset.values);
  els.presetName.value = preset.builtIn ? "" : preset.name;
  setStatus(`Preset aplicado: ${preset.name}.`, "success");
}

function createCustomPreset() {
  const name = els.presetName.value.trim();
  if (!name) {
    setStatus("Escribe un nombre para guardar el preset.", "warning");
    els.presetName.focus();
    return;
  }
  const preset = { id: `custom-${Date.now()}-${Math.random()}`, name: name.slice(0, 60), builtIn: false, values: currentPresetValues() };
  state.customPresets.push(preset);
  saveCustomPresets();
  renderPresetSelect(preset.id);
  renderBatchPresetOptions();
  setStatus(`Preset guardado localmente: ${preset.name}.`, "success");
}

function overwriteCustomPreset() {
  const preset = currentPreset();
  if (!preset || preset.builtIn) {
    setStatus("Selecciona un preset personalizado para sobrescribirlo.", "warning");
    return;
  }
  const name = els.presetName.value.trim();
  if (name) preset.name = name.slice(0, 60);
  preset.values = currentPresetValues();
  saveCustomPresets();
  renderPresetSelect(preset.id);
  renderBatchPresetOptions();
  setStatus(`Preset actualizado: ${preset.name}.`, "success");
}

function deleteCustomPreset() {
  const preset = currentPreset();
  if (!preset || preset.builtIn) {
    setStatus("Los presets incluidos no pueden eliminarse.", "warning");
    return;
  }
  state.customPresets = state.customPresets.filter((item) => item.id !== preset.id);
  saveCustomPresets();
  renderPresetSelect();
  renderBatchPresetOptions();
  els.presetName.value = "";
  setStatus(`Preset eliminado: ${preset.name}.`, "info");
}

function exportCustomPresets() {
  const payload = { type: "PDFPrivadoPageNumberingPresets", version: 2, exportedAt: new Date().toISOString(), presets: state.customPresets.map(({ id, name, values }) => ({ id, name, values })) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "PDFPrivado-presets-numeracion-v2.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  setStatus(`${state.customPresets.length} presets personalizados exportados.`, "success");
}

async function importPresetFile(file) {
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed?.type !== "PDFPrivadoPageNumberingPresets" || !Array.isArray(parsed.presets)) throw new Error("El JSON no pertenece a Numeración PDF Pro.");
    const imported = parsed.presets.filter((item) => item && typeof item.name === "string" && item.values)
      .map((item) => ({ id: `custom-${Date.now()}-${Math.random()}`, name: item.name.slice(0, 60), builtIn: false, values: safePresetValues(item.values) }));
    state.customPresets.push(...imported);
    saveCustomPresets();
    renderPresetSelect(imported.at(-1)?.id);
    renderBatchPresetOptions();
    setStatus(`${imported.length} presets importados correctamente.`, "success");
  } catch (error) {
    setStatus(error?.message || "No se pudieron importar los presets.", "error");
  }
}

function updatePresetButtons() {
  const preset = currentPreset();
  const editable = Boolean(preset && !preset.builtIn);
  els.presetOverwrite.disabled = state.busy || !editable;
  els.presetDelete.disabled = state.busy || !editable;
  els.presetApply.disabled = state.busy || !preset;
  els.presetExport.disabled = state.busy || state.customPresets.length === 0;
}

const BATCH_CONFIG_MAP = Object.freeze({
  pageMode: els.pageMode,
  pageExpression: els.expression,
  position: els.position,
  initialNumber: els.initialNumber,
  marginX: els.marginX,
  marginY: els.marginY,
  restartPage: els.restartPage,
  skipCover: els.skipCover,
  format: els.format,
  digits: els.digits,
  template: els.template,
  prefix: els.prefix,
  suffix: els.suffix,
  fontSize: els.fontSize,
  color: els.color,
  opacity: els.opacity,
  bold: els.bold,
  background: els.background,
  backgroundColor: els.backgroundColor,
  backgroundOpacity: els.backgroundOpacity,
  border: els.border,
  borderWidth: els.borderWidth,
  paddingX: els.paddingX,
  paddingY: els.paddingY,
});

function copyControlValue(source, target) {
  if (!source || !target) return;
  if (source.type === "checkbox") target.checked = source.checked;
  else target.value = source.value;
}

function formatLabelText(format) {
  return {
    number: "1, 2, 3",
    page: "Página 1",
    "page-total": "Página X de N",
    padded: "001, 002, 003",
    "roman-upper": "Romanos I, II, III",
    "roman-lower": "Romanos i, ii, iii",
    "alpha-upper": "Letras A, B, C",
    "alpha-lower": "Letras a, b, c",
    "custom-template": "Plantilla personalizada",
  }[format] || format;
}

function pageModeLabelText(mode) {
  return {
    all: "Todas las páginas",
    range: "Rango",
    even: "Páginas pares",
    odd: "Páginas impares",
    manual: "Selección manual",
  }[mode] || mode;
}

function positionLabelText(position) {
  return {
    "top-left": "Superior izquierda",
    "top-center": "Superior centro",
    "top-right": "Superior derecha",
    "bottom-left": "Inferior izquierda",
    "bottom-center": "Inferior centro",
    "bottom-right": "Inferior derecha",
  }[position] || position;
}

function updateBatchConfigSummary() {
  const opts = options();
  const style = [
    `${opts.fontSize} pt`,
    `${Math.round(opts.opacity * 100)} %`,
    opts.bold ? "Negrita" : "",
    opts.background ? "Con fondo" : "",
    opts.border ? "Con borde" : "",
  ].filter(Boolean).join(" · ");
  els.batchConfigSummary.textContent =
    `${formatLabelText(opts.format)} · ${positionLabelText(opts.position)} · ${pageModeLabelText(opts.pageMode)} · ${style}`;
}

function refreshBatchConfigEnabled() {
  els.batchConfig.pageExpression.disabled = els.batchConfig.pageMode.value !== "range";
  els.batchConfig.digits.disabled = els.batchConfig.format.value !== "padded";
  els.batchConfig.template.disabled = els.batchConfig.format.value !== "custom-template";
  els.batchConfig.backgroundColor.disabled = !els.batchConfig.background.checked;
  els.batchConfig.backgroundOpacity.disabled = !els.batchConfig.background.checked;
  els.batchConfig.border.disabled = !els.batchConfig.background.checked;
  els.batchConfig.borderWidth.disabled =
    !els.batchConfig.background.checked || !els.batchConfig.border.checked;
  els.batchConfig.paddingX.disabled = !els.batchConfig.background.checked;
  els.batchConfig.paddingY.disabled = !els.batchConfig.background.checked;
}

function syncIndividualToBatch() {
  for (const [key, source] of Object.entries(BATCH_CONFIG_MAP)) {
    copyControlValue(source, els.batchConfig[key]);
  }
  renderBatchPresetOptions();
  refreshBatchConfigEnabled();
  updateBatchConfigSummary();
}

function syncBatchToIndividual(changedKey = "") {
  for (const [key, target] of Object.entries(BATCH_CONFIG_MAP)) {
    if (changedKey && key !== changedKey) continue;
    copyControlValue(els.batchConfig[key], target);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }
  refreshBatchConfigEnabled();
  updateBatchConfigSummary();
  updateControls();
  if (state.mode === "batch") void renderBatchPreview();
}

function renderBatchPresetOptions() {
  const current = els.batchPreset.value;
  els.batchPreset.replaceChildren();
  const included = document.createElement("optgroup");
  included.label = "Incluidos";
  for (const preset of BUILTIN_PRESETS) included.append(new Option(preset.name, preset.id));
  const custom = document.createElement("optgroup");
  custom.label = "Mis presets";
  if (state.customPresets.length) {
    for (const preset of state.customPresets) custom.append(new Option(preset.name, preset.id));
  } else {
    const empty = new Option("Sin presets personalizados", "");
    empty.disabled = true;
    custom.append(empty);
  }
  els.batchPreset.append(included, custom);
  els.batchPreset.value = allPresets().some((preset) => preset.id === current)
    ? current
    : BUILTIN_PRESETS[0].id;
}

function applyBatchPreset() {
  const preset = allPresets().find((item) => item.id === els.batchPreset.value);
  if (!preset) return;
  applyPresetValues(preset.values);
  syncIndividualToBatch();
  void renderBatchPreview();
  setBatchStatus(`Preset aplicado al lote: ${preset.name}.`, "success");
}

function toggleBatchConfig() {
  const expanded = els.batchConfigBody.hidden;
  els.batchConfigBody.hidden = !expanded;
  els.batchRoot.classList.toggle("is-config-open", expanded);
  els.batchConfigToggle.setAttribute("aria-expanded", String(expanded));
  els.batchConfigToggle.textContent = expanded ? "Ocultar configuración" : "Editar configuración";
  if (expanded) syncIndividualToBatch();
  requestAnimationFrame(() => void renderBatchPreview());
}

async function destroyBatchPreviewDocument() {
  try { state.batchPreviewTask?.cancel?.(); } catch {}
  state.batchPreviewTask = null;
  try { await state.batchPreviewDocument?.destroy?.(); } catch {}
  state.batchPreviewDocument = null;
}

function selectedBatchItem() {
  return state.batchItems.find((item) => item.id === state.batchSelectedId) || null;
}

function setBatchCurrent(message = "") {
  els.batchCurrent.textContent = message;
  els.batchCurrent.hidden = !message;
}

function updateBatchProgress(done, total, phase = "") {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeDone = Math.max(0, Math.min(safeTotal, Number(done) || 0));
  els.batchProgressWrap.hidden = false;
  els.batchProgress.max = safeTotal;
  els.batchProgress.value = safeDone;
  const percent = Math.round((safeDone / safeTotal) * 100);
  els.batchProgressValue.textContent = `${percent} % · ${safeDone} / ${total}`;
  if (phase) els.batchProgressWrap.dataset.phase = phase;
}

function batchPreviewLabelForPage(item, pageNumber) {
  if (!item) return "";
  const opts = { ...options(), manualPages: new Set(), fileName: item.name };
  const selected = selectedPagesForMode(
    opts.pageMode,
    item.pageCount,
    opts.pageExpression,
    new Set()
  );
  if (!selected.has(pageNumber) || (opts.skipCover && pageNumber === 1) || pageNumber < opts.restartPage) return "";
  return formatPageLabel(pageNumber, item.pageCount, opts);
}

async function renderBatchPreview() {
  const item = selectedBatchItem();
  if (!item?.bytes || item.status === "error") {
    await destroyBatchPreviewDocument();
    const context = els.batchPreviewCanvas.getContext("2d");
    context?.clearRect(0, 0, els.batchPreviewCanvas.width, els.batchPreviewCanvas.height);
    els.batchPreviewName.textContent = "Vista previa del lote";
    els.batchPreviewMeta.textContent = "Selecciona un archivo preparado.";
    els.batchPreviewLabel.textContent = "Vista previa pendiente";
    els.batchPreviewPrev.disabled = true;
    els.batchPreviewNext.disabled = true;
    els.batchPreviewPage.disabled = true;
    return;
  }

  const serial = ++state.batchPreviewSerial;
  try {
    await destroyBatchPreviewDocument();
    const loadingTask = pdfjsLib.getDocument({
      data: item.bytes.slice(),
      disableAutoFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      wasmUrl: new URL("./vendor/pdfjs/wasm/", import.meta.url).href,
    });
    state.batchPreviewDocument = await loadingTask.promise;
    if (serial !== state.batchPreviewSerial) return;

    const pageNumber = Math.max(1, Math.min(item.pageCount, Number(state.batchPreviewPage) || 1));
    state.batchPreviewPage = pageNumber;
    const page = await state.batchPreviewDocument.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const targetWidth = 330;
    const targetHeight = 360;
    const scale = Math.min(1.25, targetWidth / base.width, targetHeight / base.height);
    const viewport = page.getViewport({ scale });
    const canvas = els.batchPreviewCanvas;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
    canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    state.batchPreviewTask = page.render({
      canvasContext: context,
      viewport,
      transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
    });
    await state.batchPreviewTask.promise;
    state.batchPreviewTask = null;
    if (serial !== state.batchPreviewSerial) return;

    els.batchPreviewName.textContent = item.name;
    els.batchPreviewMeta.textContent = `Archivo ${state.batchItems.indexOf(item) + 1} de ${state.batchItems.length} · página ${pageNumber} de ${item.pageCount}`;
    els.batchPreviewPage.value = String(pageNumber);
    els.batchPreviewPage.max = String(item.pageCount);
    els.batchPreviewPage.disabled = false;
    els.batchPreviewPrev.disabled = pageNumber <= 1;
    els.batchPreviewNext.disabled = pageNumber >= item.pageCount;

    const label = batchPreviewLabelForPage(item, pageNumber);
    const opts = options();
    els.batchPreviewLabel.textContent = label || "Esta página no se numerará";
    els.batchPreviewLabel.style.fontSize = `${Math.max(10, Number(els.fontSize.value))}px`;
    els.batchPreviewLabel.style.color = els.color.value;
    els.batchPreviewLabel.style.opacity = String(Number(els.opacity.value) / 100);
    els.batchPreviewLabel.style.fontWeight = els.bold.checked ? "800" : "400";
    els.batchPreviewLabel.style.background = els.background.checked ? els.backgroundColor.value : "transparent";

    const canvasLeft = canvas.offsetLeft;
    const canvasTop = canvas.offsetTop;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const previewScaleX = canvasWidth / base.width;
    const previewScaleY = canvasHeight / base.height;
    const marginX = Math.max(0, Number(opts.marginX) || 0) * previewScaleX;
    const marginY = Math.max(0, Number(opts.marginY) || 0) * previewScaleY;
    const [vertical, horizontal] = opts.position.split("-");

    els.batchPreviewLabel.style.left = "0";
    els.batchPreviewLabel.style.top = "0";
    els.batchPreviewLabel.style.right = "auto";
    els.batchPreviewLabel.style.bottom = "auto";
    els.batchPreviewLabel.style.transform = "none";
    els.batchPreviewLabel.style.whiteSpace = "nowrap";
    els.batchPreviewLabel.style.width = "max-content";
    els.batchPreviewLabel.style.maxWidth = `${Math.max(1, canvasWidth - marginX * 2)}px`;

    const labelWidth = Math.min(els.batchPreviewLabel.offsetWidth, canvasWidth);
    const labelHeight = Math.min(els.batchPreviewLabel.offsetHeight, canvasHeight);
    let x = canvasLeft + marginX;
    if (horizontal === "center") x = canvasLeft + (canvasWidth - labelWidth) / 2;
    if (horizontal === "right") x = canvasLeft + canvasWidth - marginX - labelWidth;
    let y = canvasTop + marginY;
    if (vertical === "bottom") y = canvasTop + canvasHeight - marginY - labelHeight;

    els.batchPreviewLabel.style.left = `${Math.max(canvasLeft, Math.min(canvasLeft + canvasWidth - labelWidth, x))}px`;
    els.batchPreviewLabel.style.top = `${Math.max(canvasTop, Math.min(canvasTop + canvasHeight - labelHeight, y))}px`;
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") {
      setBatchStatus(error?.message || "No se pudo generar la vista previa del lote.", "error");
    }
  }
}

function setBatchStatus(message = "", kind = "info") {
  els.batchStatus.textContent = message;
  els.batchStatus.dataset.kind = kind;
  els.batchStatus.hidden = !message;
}

function batchActiveItems() {
  return state.batchItems.filter((item) => item.included);
}

function safeBatchStem(value) {
  return String(value || "documento")
    .replace(/\.pdf$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120) || "documento";
}

function pathJoin(directory, name) {
  const separator = String(directory).includes("\\") ? "\\" : "/";
  return `${String(directory).replace(/[\\/]+$/g, "")}${separator}${name}`;
}

function batchOutputName(item, index) {
  const pattern = els.batchNamePattern.value.trim() || "{nombre}_numerado";
  const stem = pattern
    .replaceAll("{nombre}", safeBatchStem(item.name))
    .replaceAll("{indice}", String(index + 1).padStart(2, "0"));
  return `${safeBatchStem(stem)}.pdf`;
}

async function freeBatchName(fs, directory, desired) {
  if (typeof fs.exists !== "function") return desired;
  const stem = desired.replace(/\.pdf$/i, "");
  for (let index = 1; index < 10000; index += 1) {
    const candidate = index === 1 ? desired : `${stem} (${index}).pdf`;
    if (!(await fs.exists(pathJoin(directory, candidate)))) return candidate;
  }
  throw new Error("No se pudo encontrar un nombre de salida libre.");
}

function setBatchBusy(busy) {
  state.batchBusy = busy;
  els.batchAdd.disabled = busy;
  els.batchClear.disabled = busy || state.batchItems.length === 0;
  els.batchNamePattern.disabled = busy;
  for (const tab of els.modeTabs) tab.disabled = busy;
  els.batchProcess.disabled = !busy && (
    batchActiveItems().length === 0 ||
    els.pageMode.value === "manual"
  );
  els.batchProcess.textContent = busy
    ? "Cancelar después del archivo actual"
    : "Elegir carpeta y procesar";
}

function updateBatchSummary() {
  const included = batchActiveItems();
  const errors = state.batchItems.filter((item) => item.status === "error").length;
  els.batchEmpty.hidden = state.batchItems.length > 0;
  els.batchSummary.textContent = state.batchItems.length
    ? `${state.batchItems.length} archivos · ${included.length} incluidos${errors ? ` · ${errors} con error` : ""}`
    : "No hay archivos añadidos.";
  els.batchClear.disabled = state.batchBusy || state.batchItems.length === 0;
  els.batchProcess.disabled = state.batchBusy
    ? false
    : included.length === 0 || els.pageMode.value === "manual";
  if (els.pageMode.value === "manual" && included.length) {
    setBatchStatus(
      "La selección manual visual pertenece al documento individual. Elige Todas, Rango, Pares o Impares para procesar el lote.",
      "warning"
    );
  }
}

function moveBatchItem(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId || state.batchBusy) return;
  const from = state.batchItems.findIndex((item) => item.id === sourceId);
  const to = state.batchItems.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0) return;
  const [moved] = state.batchItems.splice(from, 1);
  state.batchItems.splice(to, 0, moved);
  renderBatch();
}

function renderBatch() {
  const rows = state.batchItems.map((item, index) => {
    const row = document.createElement("article");
    row.className = `page-numbering-batch-item is-${item.status}`;
    row.dataset.id = item.id;
    row.draggable = !state.batchBusy;
    row.classList.toggle("is-selected", item.id === state.batchSelectedId);
    row.addEventListener("click", (event) => {
      if (event.target.closest("button, input")) return;
      state.batchSelectedId = item.id;
      state.batchPreviewPage = 1;
      renderBatch();
      void renderBatchPreview();
    });

    row.addEventListener("dragstart", () => {
      state.batchDragId = item.id;
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragend", () => {
      state.batchDragId = null;
      row.classList.remove("is-dragging");
    });
    row.addEventListener("dragover", (event) => event.preventDefault());
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      moveBatchItem(state.batchDragId, item.id);
    });

    const handle = document.createElement("span");
    handle.className = "page-numbering-batch-handle";
    handle.textContent = "⋮⋮";
    handle.title = "Arrastra para cambiar el orden";

    const include = document.createElement("input");
    include.type = "checkbox";
    include.checked = item.included;
    include.disabled = state.batchBusy || item.status === "error";
    include.setAttribute("aria-label", `Incluir ${item.name}`);
    include.addEventListener("change", () => {
      item.included = include.checked;
      updateBatchSummary();
    });

    const copy = document.createElement("div");
    copy.className = "page-numbering-batch-copy";
    const title = document.createElement("strong");
    title.textContent = item.name;
    const meta = document.createElement("span");
    meta.textContent = item.status === "error"
      ? item.error
      : `${item.pageCount} páginas · ${formatBytes(item.size)}`;
    copy.append(title, meta);

    const order = document.createElement("span");
    order.className = "page-numbering-batch-order";
    order.textContent = String(index + 1);

    const badge = document.createElement("span");
    badge.className = "page-numbering-batch-state";
    badge.textContent = {
      ready: "Preparado",
      processing: "Procesando",
      success: "Correcto",
      warning: "Revisar",
      error: "Error",
      cancelled: "Cancelado",
    }[item.status] || "Pendiente";

    const remove = document.createElement("button");
    remove.className = "secondary-button";
    remove.type = "button";
    remove.textContent = "Quitar";
    remove.disabled = state.batchBusy;
    remove.addEventListener("click", () => {
      state.batchItems = state.batchItems.filter((candidate) => candidate.id !== item.id);
      renderBatch();
    });

    row.append(handle, include, order, copy, badge, remove);
    return row;
  });
  els.batchList.replaceChildren(...rows);
  if (!selectedBatchItem()) {
    const first = state.batchItems.find((item) => item.bytes && item.status !== "error");
    state.batchSelectedId = first?.id || null;
  }
  updateBatchSummary();
}

async function addBatchFiles() {
  if (state.batchBusy) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,application/pdf";
  input.multiple = true;
  input.style.position = "fixed";
  input.style.left = "-10000px";
  document.body.append(input);

  input.addEventListener("change", async () => {
    const files = [...(input.files || [])];
    input.remove();
    if (!files.length) return;

    const existing = new Set(
      state.batchItems.map((item) => `${item.name.toLowerCase()}|${item.size}`)
    );
    let added = 0;
    let analyzed = 0;
    let failed = 0;
    updateBatchProgress(0, files.length, "preparing");
    setBatchCurrent(`Preparando 0 de ${files.length}`);
    setBatchStatus(`Analizando ${files.length} archivo(s) localmente…`, "info");

    for (const file of files) {
      const key = `${file.name.toLowerCase()}|${file.size}`;
      if (existing.has(key)) {
        analyzed += 1;
        updateBatchProgress(analyzed, files.length, "preparing");
        continue;
      }
      setBatchCurrent(`Preparando ${analyzed + 1} de ${files.length} · ${file.name}`);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pdf = await window.PDFLib.PDFDocument.load(bytes.slice(), {
          ignoreEncryption: false,
          updateMetadata: false,
        });
        state.batchItems.push({
          id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          name: file.name,
          size: bytes.byteLength,
          bytes,
          pageCount: pdf.getPageCount(),
          included: true,
          status: "ready",
          error: "",
        });
        existing.add(key);
        added += 1;
      } catch (error) {
        failed += 1;
        state.batchItems.push({
          id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          bytes: null,
          pageCount: 0,
          included: false,
          status: "error",
          error: error?.message || "No se pudo leer el PDF.",
        });
      }
      analyzed += 1;
      updateBatchProgress(analyzed, files.length, "preparing");
      renderBatch();
      if (!state.batchSelectedId) {
        state.batchSelectedId = state.batchItems.find((item) => item.bytes)?.id || null;
      }
    }

    setBatchCurrent("");
    setBatchStatus(
      failed
        ? `Preparación terminada: ${added} preparados y ${failed} con error.`
        : added
          ? `${added} archivo(s) preparados para el lote.`
          : "No se añadieron archivos nuevos.",
      failed ? "warning" : added ? "success" : "info"
    );
    void renderBatchPreview();
  }, { once: true });

  input.addEventListener("cancel", () => input.remove(), { once: true });
  input.click();
}

function buildBatchReports(results, destination) {
  const ok = results.filter((item) => item.status === "success").length;
  const warning = results.filter((item) => item.status === "warning").length;
  const error = results.filter((item) => item.status === "error").length;
  const lines = [
    "PDFPRIVADO PRO — INFORME DE NUMERACIÓN POR LOTES",
    `Fecha: ${new Date().toLocaleString("es-ES")}`,
    `Carpeta de salida: ${destination}`,
    `Total procesados: ${results.length}`,
    `Correctos: ${ok}`,
    `Advertencias: ${warning}`,
    `Errores: ${error}`,
    "",
  ];
  for (const result of results) {
    lines.push(`[${result.status.toUpperCase()}] ${result.name}`);
    lines.push(`Salida: ${result.outputPath || "—"}`);
    lines.push(`Detalle: ${result.message || "—"}`);
    lines.push("");
  }
  lines.push("Procesamiento 100 % local. Ningún original ha sido modificado.");

  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    ["archivo", "estado", "salida", "paginas", "numeradas", "detalle"].map(quote).join(","),
    ...results.map((item) => [
      item.name, item.status, item.outputPath || "", item.pageCount || "",
      item.applied || "", item.message || "",
    ].map(quote).join(",")),
  ].join("\r\n");
  return { txt: lines.join("\n"), csv };
}

async function processBatch() {
  if (state.batchBusy) {
    state.batchCancelRequested = true;
    setBatchStatus(
      "Cancelación solicitada. El proceso se detendrá después del archivo actual.",
      "warning"
    );
    return;
  }

  const items = batchActiveItems().filter((item) => item.bytes);
  if (!items.length) return;
  if (els.pageMode.value === "manual") {
    setBatchStatus("La selección manual no puede aplicarse a documentos con distinto número de páginas.", "warning");
    return;
  }

  try {
    const dialogApi = window.__TAURI__?.dialog;
    const fsApi = window.__TAURI__?.fs;
    if (!dialogApi?.open || !fsApi?.writeFile) {
      throw new Error("Las API locales de Tauri no están disponibles.");
    }

    const selected = await dialogApi.open({
      directory: true,
      multiple: false,
      title: "Elige la carpeta para las copias numeradas",
    });
    const directory = Array.isArray(selected) ? selected[0] : selected;
    if (!directory) return;

    state.batchDestination = String(directory);
    state.batchResults = [];
    state.batchCancelRequested = false;
    setBatchBusy(true);
    els.batchProgressWrap.hidden = false;
    updateBatchProgress(0, items.length, "processing");
    setBatchCurrent(`Procesando 0 de ${items.length}`);

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (state.batchCancelRequested) {
        item.status = "cancelled";
        renderBatch();
        break;
      }

      item.status = "processing";
      state.batchSelectedId = item.id;
      state.batchPreviewPage = 1;
      renderBatch();
      void renderBatchPreview();
      setBatchCurrent(`Procesando ${index + 1} de ${items.length} · ${item.name}`);
      setBatchStatus(`Archivo actual: ${item.name}`, "info");

      try {
        const batchOptions = {
          ...options(),
          manualPages: new Set(),
          fileName: item.name,
        };
        const result = await applyPageNumbering(item.bytes, batchOptions);
        const verification = await verifyNumberedPdf(result.bytes, item.pageCount);
        const desired = batchOutputName(item, index);
        const outputName = await freeBatchName(fsApi, directory, desired);
        const outputPath = pathJoin(directory, outputName);
        await fsApi.writeFile(outputPath, result.bytes);

        item.status = verification.ok ? "success" : "warning";
        state.batchResults.push({
          name: item.name,
          status: item.status,
          outputPath,
          pageCount: verification.pageCount,
          applied: result.applied,
          message: verification.ok
            ? "Copia numerada y verificada correctamente."
            : "La copia se guardó, pero la verificación requiere revisión.",
        });
      } catch (error) {
        item.status = "error";
        item.error = error?.message || String(error);
        state.batchResults.push({
          name: item.name,
          status: "error",
          outputPath: "",
          pageCount: item.pageCount,
          applied: 0,
          message: item.error,
        });
      }

      updateBatchProgress(index + 1, items.length, "processing");
      renderBatch();
    }

    const reports = buildBatchReports(state.batchResults, directory);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fsApi.writeFile(
      pathJoin(directory, `PDFPrivado-informe-numeracion-lote-${stamp}.txt`),
      new TextEncoder().encode(reports.txt)
    );
    await fsApi.writeFile(
      pathJoin(directory, `PDFPrivado-informe-numeracion-lote-${stamp}.csv`),
      new TextEncoder().encode(reports.csv)
    );

    const errors = state.batchResults.filter((item) => item.status === "error").length;
    const warnings = state.batchResults.filter((item) => item.status === "warning").length;
    const correct = state.batchResults.length - errors - warnings;
    setBatchCurrent("");
    setBatchStatus(
      state.batchCancelRequested
        ? `Lote cancelado: ${state.batchResults.length} archivo(s) procesados antes de detenerse.`
        : `Lote terminado: ${correct} correctos, ${warnings} para revisar y ${errors} con error.`,
      errors || warnings ? "warning" : "success"
    );
  } catch (error) {
    setBatchStatus(error?.message || "No se pudo procesar el lote.", "error");
  } finally {
    setBatchBusy(false);
    renderBatch();
  }
}

function switchNumberingMode(mode) {
  state.mode = mode === "batch" ? "batch" : "single";
  dialog.dataset.pageNumberingMode = state.mode;
  for (const tab of els.modeTabs) {
    const active = tab.dataset.pageNumberingMode === state.mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  }
  for (const panel of els.modePanels) {
    panel.hidden = panel.dataset.pageNumberingPanel !== state.mode;
  }
  if (state.mode === "batch") {
    els.batchRoot.classList.toggle("is-config-open", !els.batchConfigBody.hidden);
    syncIndividualToBatch();
    updateBatchSummary();
    void renderBatchPreview();
    els.batchAdd.focus?.({ preventScroll: true });
  } else {
    els.fileName.focus?.({ preventScroll: true });
  }
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

function setStatus(message = "", kind = "info") {
  els.status.textContent = message;
  els.status.dataset.kind = kind;
  els.status.hidden = !message;
}

function setBusy(busy, message = "") {
  state.busy = busy;
  for (const control of dialog.querySelectorAll("button, input, select")) control.disabled = busy;
  els.close.forEach((button) => { button.disabled = false; });
  els.progress.hidden = !busy;
  els.progress.value = busy ? 55 : 0;
  if (message) setStatus(message, "info");
  updateControls();
}

function options() {
  return {
    pageMode: els.pageMode.value,
    pageExpression: els.expression.value,
    manualPages: state.manualPages,
    position: els.position.value,
    marginX: Number(els.marginX.value),
    marginY: Number(els.marginY.value),
    initialNumber: Number(els.initialNumber.value),
    restartPage: Number(els.restartPage.value),
    skipCover: els.skipCover.checked,
    format: els.format.value,
    digits: Number(els.digits.value),
    template: els.template.value,
    prefix: els.prefix.value,
    suffix: els.suffix.value,
    fontSize: Number(els.fontSize.value),
    color: els.color.value,
    opacity: Number(els.opacity.value) / 100,
    bold: els.bold.checked,
    background: els.background.checked,
    backgroundColor: els.backgroundColor.value,
    backgroundOpacity: Number(els.backgroundOpacity.value) / 100,
    border: els.border.checked,
    borderWidth: Number(els.borderWidth.value),
    paddingX: Number(els.paddingX.value),
    paddingY: Number(els.paddingY.value),
    fileName: state.info?.name || "Documento.pdf",
  };
}

function selectedPages() {
  return selectedPagesForMode(
    els.pageMode.value,
    state.info?.pages || 0,
    els.expression.value,
    state.manualPages
  );
}

function updateControls() {
  const ready = Boolean(state.bytes && state.info?.pages);
  const selected = ready ? selectedPages() : new Set();
  els.save.disabled = state.busy || !ready || selected.size === 0;
  els.removeFile.disabled = state.busy || !ready;
  els.useViewer.disabled = state.busy;
  els.chooseFile.disabled = state.busy;
  els.previewPrev.disabled = state.busy || !ready || state.previewPage <= 1;
  els.previewNext.disabled = state.busy || !ready || state.previewPage >= (state.info?.pages || 0);
  els.expression.disabled = state.busy || els.pageMode.value !== "range";
  els.manualGrid.hidden = els.pageMode.value !== "manual";
  els.digits.disabled = els.format.value !== "padded";
  els.template.disabled = els.format.value !== "custom-template";
  els.backgroundColor.disabled = !els.background.checked;
  els.backgroundOpacity.disabled = !els.background.checked;
  els.border.disabled = !els.background.checked;
  els.borderWidth.disabled = !els.background.checked || !els.border.checked;
  els.paddingX.disabled = !els.background.checked;
  els.paddingY.disabled = !els.background.checked;
  els.selectionSummary.textContent = ready
    ? `${selected.size} de ${state.info.pages} páginas recibirán numeración`
    : "Ningún documento preparado";
  updatePresetButtons();
  if (els.batchRoot) {
    updateBatchSummary();
    updateBatchConfigSummary();
  }
}

async function bridge() {
  const started = Date.now();
  while (!window.PDFPrivadoProtectionBridge) {
    if (Date.now() - started > 1800) return null;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return window.PDFPrivadoProtectionBridge;
}

async function destroyPreviewDocument() {
  try { await state.pdfDocument?.destroy?.(); } catch {}
  state.pdfDocument = null;
}

async function loadBytes(bytes, info, source) {
  if (!(bytes instanceof Uint8Array)) throw new Error("No se recibieron bytes PDF válidos.");
  setBusy(true, "Analizando el documento y preparando la vista previa…");
  try {
    await destroyPreviewDocument();
    const loadingTask = pdfjsLib.getDocument({
      data: bytes.slice(),
      disableAutoFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      wasmUrl: new URL("./vendor/pdfjs/wasm/", import.meta.url).href,
    });
    state.pdfDocument = await loadingTask.promise;
    state.bytes = bytes.slice();
    state.info = {
      name: info?.name || "Documento.pdf",
      pages: state.pdfDocument.numPages,
      sizeLabel: info?.sizeLabel || formatBytes(bytes.byteLength),
    };
    state.source = source;
    state.previewPage = 1;
    state.manualPages = new Set(Array.from({ length: state.info.pages }, (_, index) => index + 1));
    els.fileName.textContent = state.info.name;
    els.fileMeta.textContent = `${state.info.pages} páginas · ${state.info.sizeLabel} · ${source === "viewer" ? "Documento del visor" : "Archivo local"}`;
    els.restartPage.max = String(state.info.pages);
    els.previewPage.max = String(state.info.pages);
    renderManualGrid();
    await renderPreview();
    setStatus("Documento preparado. Configura una numeración profesional y revisa la vista previa.", "success");
  } finally {
    setBusy(false);
  }
}

async function loadViewerDocument() {
  try {
    const api = await bridge();
    if (!api) throw new Error("El visor todavía no está disponible.");
    const info = await api.getCurrentDocumentInfo();
    if (!info?.hasDocument) throw new Error("No hay ningún PDF abierto en el visor.");
    if (info.encryptedSource) throw new Error("El documento del visor está cifrado. Elige una copia sin cifrar.");
    const built = await api.buildCurrentDocumentBytes();
    await loadBytes(built.bytes, info, "viewer");
  } catch (error) {
    setStatus(error?.message || "No se pudo usar el documento del visor.", "error");
  }
}

function chooseLocalFile() {
  if (state.busy) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,application/pdf";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      await loadBytes(new Uint8Array(await file.arrayBuffer()), {
        name: file.name,
        sizeLabel: formatBytes(file.size),
      }, "local");
    } catch (error) {
      setStatus(error?.message || "No se pudo abrir el PDF.", "error");
    }
  }, { once: true });
  input.click();
}

function clearDocument() {
  if (state.busy) return;
  void destroyPreviewDocument();
  state.bytes = null;
  state.info = null;
  state.source = null;
  state.previewPage = 1;
  state.manualPages.clear();
  els.fileName.textContent = "Ningún documento seleccionado";
  els.fileMeta.textContent = "Elige un PDF local o usa el abierto en el visor.";
  els.manualGrid.replaceChildren();
  const context = els.previewCanvas.getContext("2d");
  context?.clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);
  els.previewLabel.textContent = "Vista previa pendiente";
  setStatus("Documento retirado de la herramienta. El original no se ha modificado.", "info");
  updateControls();
}

function renderManualGrid() {
  els.manualGrid.replaceChildren();
  for (let page = 1; page <= (state.info?.pages || 0); page += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-numbering-page-chip is-selected";
    button.textContent = String(page);
    button.setAttribute("aria-pressed", "true");
    button.addEventListener("click", () => {
      if (state.manualPages.has(page)) state.manualPages.delete(page);
      else state.manualPages.add(page);
      const selected = state.manualPages.has(page);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      updateControls();
      void renderPreview();
    });
    els.manualGrid.append(button);
  }
}

function previewLabelForPage(page) {
  const opts = options();
  const selected = selectedPages();
  if (!selected.has(page) || (opts.skipCover && page === 1) || page < opts.restartPage) return "";
  return formatPageLabel(page, state.info.pages, opts);
}

async function renderPreview() {
  if (!state.pdfDocument || !state.info) return;

  const serial = ++state.previewSerial;
  const previewStage = els.previewCanvas.closest(".page-numbering-preview-stage");
  previewStage?.classList.add("is-rendering");

  try {
    if (state.previewTask) {
      try { state.previewTask.cancel(); } catch {}
      state.previewTask = null;
    }

    const pageNumber = Math.max(1, Math.min(state.info.pages, Number(state.previewPage) || 1));
    state.previewPage = pageNumber;
    els.previewPage.value = String(pageNumber);

    const page = await state.pdfDocument.getPage(pageNumber);
    if (serial !== state.previewSerial) return;

    const base = page.getViewport({ scale: 1 });
    const targetWidth = 430;
    const targetHeight = 484;
    const scale = Math.min(1.35, targetWidth / base.width, targetHeight / base.height);
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

    const label = previewLabelForPage(pageNumber);
    const previewOptions = options();
    els.previewLabel.textContent = label || "Esta página no se numerará";
    els.previewLabel.dataset.position = previewOptions.position;
    els.previewLabel.style.fontSize = `${Math.max(10, Number(els.fontSize.value))}px`;
    els.previewLabel.style.color = els.color.value;
    els.previewLabel.style.opacity = String(Number(els.opacity.value) / 100);
    els.previewLabel.style.fontWeight = els.bold.checked ? "800" : "400";
    els.previewLabel.style.background = els.background.checked ? els.backgroundColor.value : "transparent";
    els.previewLabel.style.setProperty("--preview-background-opacity", String(Number(els.backgroundOpacity.value) / 100));
    els.previewLabel.classList.toggle("has-background", els.background.checked);
    els.previewLabel.classList.toggle("has-border", els.background.checked && els.border.checked);

    const canvasLeft = canvas.offsetLeft;
    const canvasTop = canvas.offsetTop;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const previewScaleX = canvasWidth / base.width;
    const previewScaleY = canvasHeight / base.height;
    const marginX = Math.max(0, Number(previewOptions.marginX) || 0) * previewScaleX;
    const marginY = Math.max(0, Number(previewOptions.marginY) || 0) * previewScaleY;
    const [vertical, horizontal] = previewOptions.position.split("-");

    els.previewLabel.style.left = "0";
    els.previewLabel.style.right = "auto";
    els.previewLabel.style.top = "0";
    els.previewLabel.style.bottom = "auto";
    els.previewLabel.style.transform = "none";
    els.previewLabel.style.whiteSpace = "nowrap";
    els.previewLabel.style.width = "max-content";
    els.previewLabel.style.maxWidth = `${Math.max(1, canvasWidth - marginX * 2)}px`;

    const labelWidth = Math.min(els.previewLabel.offsetWidth, canvasWidth);
    const labelHeight = Math.min(els.previewLabel.offsetHeight, canvasHeight);
    const minX = canvasLeft;
    const maxX = canvasLeft + canvasWidth - labelWidth;
    const minY = canvasTop;
    const maxY = canvasTop + canvasHeight - labelHeight;

    let labelX = canvasLeft + marginX;
    if (horizontal === "center") {
      labelX = canvasLeft + (canvasWidth - labelWidth) / 2;
    } else if (horizontal === "right") {
      labelX = canvasLeft + canvasWidth - marginX - labelWidth;
    }

    let labelY = canvasTop + marginY;
    if (vertical === "bottom") {
      labelY = canvasTop + canvasHeight - marginY - labelHeight;
    }

    els.previewLabel.style.left = `${Math.min(maxX, Math.max(minX, labelX))}px`;
    els.previewLabel.style.top = `${Math.min(maxY, Math.max(minY, labelY))}px`;
    updateControls();
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") {
      setStatus(error?.message || "No se pudo actualizar la vista previa.", "error");
    }
  } finally {
    if (serial === state.previewSerial) {
      previewStage?.classList.remove("is-rendering");
    }
  }
}

function schedulePreview() {
  if (state.previewTimer) window.clearTimeout(state.previewTimer);
  state.previewTimer = window.setTimeout(() => {
    state.previewTimer = null;
    void renderPreview();
  }, 90);
}

function resetOptions() {
  els.pageMode.value = "all";
  els.expression.value = "";
  els.position.value = "bottom-center";
  els.marginX.value = "24";
  els.marginY.value = "20";
  els.initialNumber.value = "1";
  els.restartPage.value = "1";
  els.skipCover.checked = false;
  els.format.value = "page-total";
  els.digits.value = "3";
  els.template.value = "{numero}";
  els.prefix.value = "";
  els.suffix.value = "";
  els.fontSize.value = "11";
  els.color.value = "#334155";
  els.opacity.value = "90";
  els.bold.checked = false;
  els.background.checked = false;
  els.backgroundColor.value = "#ffffff";
  els.backgroundOpacity.value = "88";
  els.border.checked = false;
  els.borderWidth.value = "0.75";
  els.paddingX.value = "5";
  els.paddingY.value = "3";
  updateControls();
  void renderPreview();
  setStatus("Configuración profesional restablecida.", "info");
}

async function chooseSaveTarget(suggestedName) {
  const dialogApi = window.__TAURI__?.dialog;
  const fsApi = window.__TAURI__?.fs;
  if (typeof dialogApi?.save === "function" && typeof fsApi?.writeFile === "function") {
    const path = await dialogApi.save({
      defaultPath: suggestedName,
      title: "Guardar copia numerada",
      filters: [{ name: "Documento PDF", extensions: ["pdf"] }],
    });
    if (!path) return null;
    return { kind: "tauri", path, fs: fsApi };
  }
  return { kind: "download", name: suggestedName };
}

async function writeResult(target, bytes) {
  if (target.kind === "tauri") {
    await target.fs.writeFile(target.path, bytes);
    return target.path;
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = target.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return target.name;
}

async function saveNumberedPdf() {
  if (!state.bytes || !state.info || state.busy) return;
  setBusy(true, "Aplicando numeración profesional y verificando la copia…");
  try {
    const stem = state.info.name.replace(/\.pdf$/i, "") || "Documento";
    const target = await chooseSaveTarget(`${stem}_numerado.pdf`);
    if (!target) {
      setStatus("Guardado cancelado. No se creó ningún archivo.", "info");
      return;
    }
    const result = await applyPageNumbering(state.bytes, options());
    const verification = await verifyNumberedPdf(result.bytes, state.info.pages);
    if (!verification.ok) throw new Error("La verificación detectó un número de páginas distinto al original.");
    const saved = await writeResult(target, result.bytes);
    setStatus(
      `Copia numerada y verificada: ${result.applied} páginas · ${verification.pageCount} páginas conservadas · ${formatBytes(result.bytes.byteLength)} · ${saved}`,
      "success"
    );
  } catch (error) {
    setStatus(error?.message || "No se pudo crear la copia numerada.", "error");
  } finally {
    setBusy(false);
  }
}

function openDialog(trigger) {
  state.lastTrigger = trigger instanceof HTMLElement ? trigger : null;
  if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  else dialog.setAttribute("open", "");
  switchNumberingMode(state.mode);
  if (state.mode === "single" && !state.bytes) void loadViewerDocument();
  requestAnimationFrame(() => els.fileName.focus?.({ preventScroll: true }));
}

function closeDialog() {
  if (state.busy || state.batchBusy) return;
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.removeAttribute("open");
  state.lastTrigger?.focus?.({ preventScroll: true });
}

for (const button of els.open) button.addEventListener("click", () => openDialog(button));
for (const button of els.close) button.addEventListener("click", closeDialog);
els.useViewer.addEventListener("click", loadViewerDocument);
els.chooseFile.addEventListener("click", chooseLocalFile);
els.removeFile.addEventListener("click", clearDocument);
els.reset.addEventListener("click", resetOptions);
els.save.addEventListener("click", saveNumberedPdf);
els.presetApply.addEventListener("click", applySelectedPreset);
els.presetSave.addEventListener("click", createCustomPreset);
els.presetOverwrite.addEventListener("click", overwriteCustomPreset);
els.presetDelete.addEventListener("click", deleteCustomPreset);
els.presetExport.addEventListener("click", exportCustomPresets);
els.presetImport.addEventListener("click", () => {
  els.presetFile.value = "";
  els.presetFile.click();
});
els.presetFile.addEventListener("change", () => {
  const file = els.presetFile.files?.[0];
  if (file) void importPresetFile(file);
});
els.presetSelect.addEventListener("change", () => {
  const preset = currentPreset();
  els.presetName.value = preset && !preset.builtIn ? preset.name : "";
  updatePresetButtons();
  applySelectedPreset();
});
for (const tab of els.modeTabs) {
  tab.addEventListener("click", () => switchNumberingMode(tab.dataset.pageNumberingMode));
}
els.batchAdd.addEventListener("click", addBatchFiles);
els.batchClear.addEventListener("click", () => {
  if (state.batchBusy) return;
  state.batchItems = [];
  state.batchResults = [];
  renderBatch();
  setBatchStatus("Lista de lote vaciada. No se modificó ningún archivo.", "info");
});
els.batchProcess.addEventListener("click", processBatch);
els.batchNamePattern.addEventListener("input", updateBatchSummary);
els.batchPreviewPrev.addEventListener("click", () => {
  state.batchPreviewPage -= 1;
  void renderBatchPreview();
});
els.batchPreviewNext.addEventListener("click", () => {
  state.batchPreviewPage += 1;
  void renderBatchPreview();
});
els.batchPreviewPage.addEventListener("change", () => {
  state.batchPreviewPage = Number(els.batchPreviewPage.value);
  void renderBatchPreview();
});
els.batchConfigToggle.addEventListener("click", toggleBatchConfig);
els.batchPresetApply.addEventListener("click", applyBatchPreset);
els.batchPreset.addEventListener("change", applyBatchPreset);
for (const [key, control] of Object.entries(els.batchConfig)) {
  control.addEventListener("input", () => syncBatchToIndividual(key));
  control.addEventListener("change", () => syncBatchToIndividual(key));
}
els.previewPrev.addEventListener("click", () => { state.previewPage -= 1; void renderPreview(); });
els.previewNext.addEventListener("click", () => { state.previewPage += 1; void renderPreview(); });
els.previewPage.addEventListener("change", () => { state.previewPage = Number(els.previewPage.value); void renderPreview(); });

for (const element of dialog.querySelectorAll("input, select")) {
  element.addEventListener("input", () => {
    updateControls();
    schedulePreview();
    if (state.mode === "batch") void renderBatchPreview();
  });
  element.addEventListener("change", () => {
    updateControls();
    schedulePreview();
    if (state.mode === "batch") void renderBatchPreview();
  });
}

dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDialog();
});

loadCustomPresets();
renderPresetSelect();
resetOptions();
renderBatch();
renderBatchPresetOptions();
syncIndividualToBatch();
switchNumberingMode("single");
updateControls();
