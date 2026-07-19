import {
  METADATA_PROFILES,
  applyProfile,
  buildMetadataReport,
  compareMetadata,
  inspectPdfMetadata,
  privacyAssessment,
  verifyPdfMetadata,
  writePdfMetadata,
} from "./metadata-core.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const dialog = $("#metadata-dialog");
if (!dialog) throw new Error("Falta #metadata-dialog");

const fieldIds = ["title", "author", "subject", "keywords", "creator", "producer"];
const labels = {
  title: "Título", author: "Autor", subject: "Asunto", keywords: "Palabras clave",
  creator: "Creador", producer: "Productor", creationDate: "Fecha de creación",
  modificationDate: "Fecha de modificación",
};

const els = {
  open: $$('[data-open-tool="metadata"]'),
  close: $$("[data-metadata-close]"),
  tabs: $$("[data-metadata-mode]"),
  body: $(".metadata-body"),
  batch: $("#metadata-batch"),
  documentName: $("#metadata-document-name"),
  documentMeta: $("#metadata-document-meta"),
  useViewer: $("#metadata-use-viewer"),
  chooseFile: $("#metadata-choose-file"),
  removeFile: $("#metadata-remove-file"),
  profile: $("#metadata-profile"),
  fields: Object.fromEntries(fieldIds.map((id) => [id, $(`#metadata-${id}`)])),
  creationDate: $("#metadata-creation-date"),
  modificationDate: $("#metadata-modification-date"),
  preserveCreation: $("#metadata-preserve-creation"),
  updateModification: $("#metadata-update-modification"),
  riskBadge: $("#metadata-risk-badge"),
  riskScore: $("#metadata-risk-score"),
  findings: $("#metadata-findings"),
  comparison: $("#metadata-comparison-body"),
  status: $("#metadata-status"),
  progress: $("#metadata-progress"),
  save: $("#metadata-save"),
  exportReport: $("#metadata-export-report"),
  reset: $("#metadata-reset"),
};

const state = {
  info: null,
  bytes: null,
  original: null,
  outputBytes: null,
  verification: null,
  report: "",
  busy: false,
  source: null,
  lastTrigger: null,
  mode: "single",
};

const singleChildren = [...els.body.children].filter((child) => child !== els.batch);

async function bridge() {
  const started = Date.now();
  while (!window.PDFPrivadoProtectionBridge) {
    if (Date.now() - started > 1500) return null;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return window.PDFPrivadoProtectionBridge;
}

function setStatus(message = "", kind = "info") {
  els.status.textContent = message;
  els.status.dataset.kind = kind;
  els.status.hidden = !message;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

function setFormEnabled(enabled) {
  for (const input of [
    els.profile,
    ...Object.values(els.fields),
    els.creationDate,
    els.modificationDate,
    els.preserveCreation,
    els.updateModification,
  ]) {
    input.disabled = !enabled || state.busy;
  }
  els.reset.disabled = !enabled || state.busy;
  els.save.disabled = !enabled || state.busy;
  els.exportReport.disabled = !enabled || state.busy || !state.report;
  els.removeFile.disabled = !enabled || state.busy;
}

function setBusy(busy, message = "") {
  state.busy = busy;
  els.progress.hidden = !busy;
  els.progress.value = busy ? 45 : 0;
  els.chooseFile.disabled = busy;
  els.useViewer.disabled = busy;
  setFormEnabled(Boolean(state.original));
  if (message) setStatus(message, "info");
}

function currentValues() {
  if (!state.original) return {};
  return {
    ...state.original,
    ...Object.fromEntries(fieldIds.map((id) => [id, els.fields[id].value])),
    creationDate: els.creationDate.value,
    modificationDate: els.modificationDate.value,
  };
}

function clearVisualValues() {
  for (const id of fieldIds) els.fields[id].value = "";
  els.creationDate.value = "";
  els.modificationDate.value = "";
  els.riskBadge.textContent = "—";
  els.riskBadge.className = "metadata-risk-badge risk-low";
  els.riskScore.textContent = "0/100";
  els.findings.replaceChildren(
    Object.assign(document.createElement("li"), {
      textContent: "Selecciona un PDF o usa el documento abierto en el visor.",
    })
  );
  els.comparison.replaceChildren();
}

function clearDocument(message = "Selecciona un PDF para comenzar.") {
  state.info = null;
  state.bytes = null;
  state.original = null;
  state.outputBytes = null;
  state.verification = null;
  state.report = "";
  state.source = null;
  els.documentName.textContent = "Ningún documento seleccionado";
  els.documentMeta.textContent = "Puedes elegir un PDF local o usar el abierto en el visor.";
  els.profile.value = "preserve";
  els.preserveCreation.checked = true;
  els.updateModification.checked = false;
  clearVisualValues();
  setFormEnabled(false);
  setStatus(message, "info");
}

function fill(values) {
  for (const id of fieldIds) els.fields[id].value = values[id] || "";
  els.creationDate.value = values.creationDate || "";
  els.modificationDate.value = values.modificationDate || "";
  refresh();
}

function riskClass(level) {
  return level === "alto" ? "risk-high" : level === "medio" ? "risk-medium" : "risk-low";
}

function refresh() {
  if (!state.original) return;
  const proposed = currentValues();
  state.report = buildMetadataReport({
    name: state.info?.name,
    original: state.original,
    proposed,
    verified: state.verification,
    outputBytes: state.outputBytes?.byteLength || 0,
  });
  els.exportReport.disabled = state.busy;
  els.exportReport.title = state.verification?.ok
    ? "Exportar informe con verificación de la copia"
    : "Exportar informe del análisis actual";

  const risk = privacyAssessment(proposed);
  els.riskBadge.textContent = risk.level.toUpperCase();
  els.riskBadge.className = `metadata-risk-badge ${riskClass(risk.level)}`;
  els.riskScore.textContent = `${risk.score}/100`;
  els.findings.replaceChildren(...(risk.findings.length
    ? risk.findings.map((finding) => {
        const li = document.createElement("li");
        li.textContent = `${finding.label}: ${finding.value}`;
        return li;
      })
    : [Object.assign(document.createElement("li"), {
        textContent: "No se detectan campos personales principales.",
      })]));

  els.comparison.replaceChildren(...compareMetadata(state.original, proposed).map((item) => {
    const tr = document.createElement("tr");
    tr.className = item.changed ? "is-changed" : "";
    for (const value of [labels[item.field] || item.field, item.before || "—", item.after || "—"]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }
    return tr;
  }));

  setFormEnabled(true);
}

async function analyzeBytes(bytes, info, source) {
  setBusy(true, `Analizando ${info?.name || "el documento"}…`);
  try {
    state.info = info;
    state.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    state.original = await inspectPdfMetadata(state.bytes, {
      pdfjsLib: window.pdfjsLib,
      PDFDocument: window.PDFLib?.PDFDocument,
    });
    state.outputBytes = null;
    state.verification = null;
    state.report = "";
    state.source = source;
    els.documentName.textContent = info?.name || "Documento seleccionado";
    els.documentMeta.textContent =
      `${state.original.pageCount} páginas · ${info?.sizeLabel || formatBytes(state.bytes.byteLength)} · ${
        source === "viewer" ? "Documento del visor" : "Archivo local"
      }`;
    els.profile.value = "preserve";
    els.preserveCreation.checked = true;
    els.updateModification.checked = false;
    fill(state.original);
    setStatus("Análisis completado. Puedes editar, limpiar, exportar el informe o guardar una copia.", "success");
  } finally {
    setBusy(false);
  }
}

async function loadViewerDocument({ silent = false } = {}) {
  try {
    const api = await bridge();
    if (!api) {
      if (!silent) setStatus("El visor todavía no está disponible.", "warning");
      return false;
    }
    const info = await api.getCurrentDocumentInfo();
    if (!info?.hasDocument || info.encryptedSource) {
      if (!silent) {
        setStatus(
          info?.encryptedSource
            ? "El documento del visor está cifrado. Elige un PDF sin cifrar."
            : "No hay ningún PDF abierto en el visor.",
          "warning"
        );
      }
      return false;
    }
    const document = await api.buildCurrentDocumentBytes();
    if (!(document?.bytes instanceof Uint8Array)) {
      throw new Error("No se pudieron obtener los bytes del documento del visor.");
    }
    await analyzeBytes(document.bytes, info, "viewer");
    return true;
  } catch (error) {
    if (!silent) setStatus(error?.message || "No se pudo usar el documento del visor.", "error");
    return false;
  }
}

async function chooseLocalFile() {
  if (state.busy) return;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf,.pdf";
  input.style.position = "fixed";
  input.style.left = "-10000px";
  document.body.appendChild(input);

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await analyzeBytes(bytes, {
        name: file.name,
        sizeLabel: formatBytes(file.size),
        hasDocument: true,
        encryptedSource: false,
      }, "local");
    } catch (error) {
      setStatus(error?.message || "No se pudo analizar el PDF seleccionado.", "error");
      setBusy(false);
    }
  }, { once: true });

  input.addEventListener("cancel", () => input.remove(), { once: true });
  input.click();
}

function applySelectedProfile() {
  if (!state.original) return;
  const profile = METADATA_PROFILES[els.profile.value];
  if (profile?.clearDates) {
    els.preserveCreation.checked = false;
    els.updateModification.checked = false;
  }
  fill(applyProfile(state.original, els.profile.value));
  setStatus(profile?.description || "", "info");
}

async function tauriApis() {
  const dialogApi = window.__TAURI__?.dialog;
  const fsApi = window.__TAURI__?.fs;
  if (!dialogApi || !fsApi) throw new Error("Las API locales de Tauri no están disponibles.");
  return { dialogApi, fsApi };
}

function suggestedName(name) {
  return `${String(name || "documento.pdf").replace(/\.pdf$/i, "")}_metadatos.pdf`;
}

async function savePdf() {
  if (!state.original || !state.bytes) return;
  setBusy(true, "Aplicando cambios y verificando la copia…");
  try {
    const proposed = currentValues();
    const output = await writePdfMetadata(state.bytes, proposed, {
      PDFDocument: window.PDFLib?.PDFDocument,
      preserveCreationDate: els.preserveCreation.checked,
      updateModificationDate: els.updateModification.checked,
    });
    els.progress.value = 70;

    const expected = {
      ...proposed,
      creationDate: els.preserveCreation.checked
        ? state.original.creationDate
        : proposed.creationDate,
    };
    const verification = await verifyPdfMetadata(output, expected, {
      pdfjsLib: window.pdfjsLib,
      PDFDocument: window.PDFLib?.PDFDocument,
    });

    const { dialogApi, fsApi } = await tauriApis();
    const path = await dialogApi.save({
      title: "Guardar copia con metadatos",
      defaultPath: suggestedName(state.info?.name),
      filters: [{ name: "Documento PDF", extensions: ["pdf"] }],
    });
    if (!path) {
      setStatus("Guardado cancelado. No se creó ningún archivo.", "info");
      return;
    }

    await fsApi.writeFile(path, output);
    state.outputBytes = output;
    state.verification = verification;
    state.report = buildMetadataReport({
      name: state.info?.name,
      original: state.original,
      proposed,
      verified: verification,
      outputBytes: output.byteLength,
    });
    els.progress.value = 100;
    setStatus(
      verification.ok
        ? `Copia guardada y verificada correctamente: ${path}`
        : `Copia guardada, pero algunos campos necesitan revisión: ${path}`,
      verification.ok ? "success" : "warning"
    );
  } catch (error) {
    console.error(error);
    setStatus(error?.message || "No se pudo guardar la copia.", "error");
  } finally {
    setBusy(false);
  }
}

async function exportReport() {
  if (!state.report) return;
  try {
    const { dialogApi, fsApi } = await tauriApis();
    const path = await dialogApi.save({
      title: "Guardar informe de metadatos",
      defaultPath: `${String(state.info?.name || "documento").replace(/\.pdf$/i, "")}_informe_metadatos.txt`,
      filters: [{ name: "Informe de texto", extensions: ["txt"] }],
    });
    if (!path) return;
    await fsApi.writeFile(path, new TextEncoder().encode(state.report));
    setStatus(`Informe guardado: ${path}`, "success");
  } catch (error) {
    setStatus(error?.message || "No se pudo guardar el informe.", "error");
  }
}

function switchMode(mode) {
  state.mode = mode === "batch" ? "batch" : "single";
  dialog.dataset.metadataMode = state.mode;

  for (const tab of els.tabs) {
    const active = tab.dataset.metadataMode === state.mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  }

  for (const child of singleChildren) child.hidden = state.mode !== "single";
  if (els.batch) els.batch.hidden = state.mode !== "batch";

  if (state.mode === "single") {
    els.documentName?.focus?.({ preventScroll: true });
  } else {
    $("#metadata-batch-add")?.focus?.({ preventScroll: true });
  }
}

async function openDialog(trigger) {
  state.lastTrigger = trigger;
  dialog.showModal();
  switchMode(state.mode);
  if (!state.original) {
    clearDocument("Puedes elegir un PDF local, usar el documento abierto o trabajar por lotes.");
    await loadViewerDocument({ silent: true });
  }
}

els.open.forEach((button) => button.addEventListener("click", () => void openDialog(button)));
els.close.forEach((button) => button.addEventListener("click", () => dialog.close()));
dialog.addEventListener("close", () => state.lastTrigger?.focus?.());

els.tabs.forEach((tab) => tab.addEventListener("click", () => switchMode(tab.dataset.metadataMode)));
els.useViewer.addEventListener("click", () => void loadViewerDocument());
els.chooseFile.addEventListener("click", () => void chooseLocalFile());
els.removeFile.addEventListener("click", () => clearDocument("Documento quitado. Elige otro PDF o cambia al modo por lotes."));
els.profile.addEventListener("change", applySelectedProfile);

[...Object.values(els.fields), els.creationDate, els.modificationDate]
  .forEach((input) => input.addEventListener("input", refresh));
els.preserveCreation.addEventListener("change", refresh);
els.updateModification.addEventListener("change", refresh);

els.reset.addEventListener("click", () => {
  if (!state.original) return;
  els.profile.value = "preserve";
  els.preserveCreation.checked = true;
  els.updateModification.checked = false;
  fill(state.original);
  setStatus("Valores originales restaurados en el formulario.", "info");
});

els.save.addEventListener("click", () => void savePdf());
els.exportReport.addEventListener("click", () => void exportReport());

clearDocument();
switchMode("single");
