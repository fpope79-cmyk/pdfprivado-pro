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
  documentName: $("#metadata-document-name"),
  documentMeta: $("#metadata-document-meta"),
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
};

async function bridge() {
  const started = Date.now();
  while (!window.PDFPrivadoProtectionBridge) {
    if (Date.now() - started > 5000) throw new Error("El visor todavía no está preparado.");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return window.PDFPrivadoProtectionBridge;
}

function setStatus(message = "", kind = "info") {
  els.status.textContent = message;
  els.status.dataset.kind = kind;
  els.status.hidden = !message;
}

function setBusy(busy, message = "") {
  state.busy = busy;
  els.save.disabled = busy || !state.original;
  els.profile.disabled = busy || !state.original;
  els.progress.hidden = !busy;
  els.progress.value = busy ? 45 : 0;
  if (message) setStatus(message, "info");
}

function currentValues() {
  return {
    ...state.original,
    ...Object.fromEntries(fieldIds.map((id) => [id, els.fields[id].value])),
    creationDate: els.creationDate.value,
    modificationDate: els.modificationDate.value,
  };
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
  /* PDFPRIVADO_METADATA_REPORT_REFRESH_V3
     Disponible tras analizar y actualizado con cada cambio. */
  state.report = buildMetadataReport({
    name: state.info?.name,
    original: state.original,
    proposed,
    verified: state.verification,
    outputBytes: state.outputBytes?.byteLength || 0,
  });
  els.exportReport.disabled = false;
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
    : [Object.assign(document.createElement("li"), { textContent: "No se detectan campos personales principales." })]));

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
  els.save.disabled = state.busy;
}

async function loadCurrent() {
  setBusy(true, "Analizando los metadatos del documento actual…");
  try {
    const api = await bridge();
    const info = await api.getCurrentDocumentInfo();
    if (!info?.hasDocument || info.encryptedSource) {
      throw new Error("Abre primero un PDF sin cifrar en el visor.");
    }
    const document = await api.buildCurrentDocumentBytes();
    if (!(document?.bytes instanceof Uint8Array)) throw new Error("No se pudieron obtener los bytes del documento.");
    state.info = info;
    state.bytes = document.bytes;
    state.original = await inspectPdfMetadata(state.bytes, {
      pdfjsLib: window.pdfjsLib,
      PDFDocument: window.PDFLib?.PDFDocument,
    });
    state.outputBytes = null;
    state.verification = null;
    state.report = "";
    els.documentName.textContent = info.name || "Documento actual";
    els.documentMeta.textContent = `${state.original.pageCount} páginas · ${info.sizeLabel || ""}`;
    els.profile.value = "preserve";
    els.preserveCreation.checked = true;
    els.updateModification.checked = false;
    fill(state.original);
    els.exportReport.disabled = false;
    setStatus("Análisis completado. Ya puedes exportar el informe o guardar una copia verificada.", "success");
  } finally {
    setBusy(false);
  }
}

function applySelectedProfile() {
  if (!state.original) return;
  fill(applyProfile(state.original, els.profile.value));
  setStatus(METADATA_PROFILES[els.profile.value]?.description || "", "info");
}

async function tauriApis() {
  const core = window.__TAURI__?.core;
  const dialogApi = window.__TAURI__?.dialog;
  const fsApi = window.__TAURI__?.fs;
  if (!core || !dialogApi || !fsApi) throw new Error("Las API locales de Tauri no están disponibles.");
  return { dialogApi, fsApi };
}

function suggestedName(name) {
  return `${String(name || "documento.pdf").replace(/\.pdf$/i, "")}_metadatos.pdf`;
}

async function savePdf() {
  setBusy(true, "Aplicando cambios y verificando la copia…");
  try {
    const proposed = currentValues();
    const output = await writePdfMetadata(state.bytes, proposed, {
      PDFDocument: window.PDFLib?.PDFDocument,
      preserveCreationDate: els.preserveCreation.checked,
      updateModificationDate: els.updateModification.checked,
    });
    els.progress.value = 70;
    const verification = await verifyPdfMetadata(output, proposed, {
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
    els.exportReport.disabled = false;
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

async function openDialog(trigger) {
  state.lastTrigger = trigger;
  dialog.showModal();
  try {
    await loadCurrent();
  } catch (error) {
    setStatus(error?.message || "No se pudo analizar el documento.", "error");
    setBusy(false);
  }
}

els.open.forEach((button) => button.addEventListener("click", () => void openDialog(button)));
els.close.forEach((button) => button.addEventListener("click", () => dialog.close()));
dialog.addEventListener("close", () => state.lastTrigger?.focus?.());
els.profile.addEventListener("change", applySelectedProfile);
[...Object.values(els.fields), els.creationDate, els.modificationDate].forEach((input) => input.addEventListener("input", refresh));
els.preserveCreation.addEventListener("change", refresh);
els.updateModification.addEventListener("change", refresh);
els.reset.addEventListener("click", () => {
  els.profile.value = "preserve";
  fill(state.original);
  setStatus("Valores originales restaurados en el formulario.", "info");
});
els.save.addEventListener("click", () => void savePdf());
els.exportReport.addEventListener("click", () => void exportReport());
