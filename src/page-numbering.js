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
};

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
  els.backgroundColor.disabled = !els.background.checked;
  els.backgroundOpacity.disabled = !els.background.checked;
  els.border.disabled = !els.background.checked;
  els.borderWidth.disabled = !els.background.checked || !els.border.checked;
  els.paddingX.disabled = !els.background.checked;
  els.paddingY.disabled = !els.background.checked;
  els.selectionSummary.textContent = ready
    ? `${selected.size} de ${state.info.pages} páginas recibirán numeración`
    : "Ningún documento preparado";
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
  setBusy(true, "Analizando el documento y preparando la vista previaâ€¦");
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
  setBusy(true, "Aplicando numeración profesional y verificando la copiaâ€¦");
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
  if (!state.bytes) void loadViewerDocument();
  requestAnimationFrame(() => els.fileName.focus?.({ preventScroll: true }));
}

function closeDialog() {
  if (state.busy) return;
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
els.previewPrev.addEventListener("click", () => { state.previewPage -= 1; void renderPreview(); });
els.previewNext.addEventListener("click", () => { state.previewPage += 1; void renderPreview(); });
els.previewPage.addEventListener("change", () => { state.previewPage = Number(els.previewPage.value); void renderPreview(); });

for (const element of dialog.querySelectorAll("input, select")) {
  element.addEventListener("input", () => {
    updateControls();
    schedulePreview();
  });
  element.addEventListener("change", () => {
    updateControls();
    schedulePreview();
  });
}

dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDialog();
});

resetOptions();
updateControls();
