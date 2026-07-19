import {
  METADATA_PROFILES,
  applyProfile,
  buildMetadataReport,
  inspectPdfMetadata,
  privacyAssessment,
  verifyPdfMetadata,
  writePdfMetadata,
} from "./metadata-core.js";

const $ = (selector) => document.querySelector(selector);

const els = {
  root: $("#metadata-batch"),
  add: $("#metadata-batch-add"),
  clear: $("#metadata-batch-clear"),
  process: $("#metadata-batch-process"),
  profile: $("#metadata-batch-profile"),
  preserveCreation: $("#metadata-batch-preserve-creation"),
  updateModification: $("#metadata-batch-update-modification"),
  list: $("#metadata-batch-list"),
  empty: $("#metadata-batch-empty"),
  summary: $("#metadata-batch-summary"),
  progress: $("#metadata-batch-progress"),
  progressValue: $("#metadata-batch-progress-value"),
  status: $("#metadata-batch-status"),
};

if (!els.root) {
  throw new Error("Falta #metadata-batch");
}

const state = {
  items: [],
  busy: false,
  cancelRequested: false,
  destination: "",
  results: [],
};

function tauriApis() {
  const dialog = window.__TAURI__?.dialog;
  const fs = window.__TAURI__?.fs;
  if (!dialog?.open || !fs?.writeFile) {
    throw new Error("Las API locales de Tauri no están disponibles.");
  }
  return { dialog, fs };
}

function setStatus(message = "", kind = "info") {
  els.status.textContent = message;
  els.status.dataset.kind = kind;
  els.status.hidden = !message;
}

function pathJoin(directory, name) {
  const separator = String(directory).includes("\\") ? "\\" : "/";
  return `${String(directory).replace(/[\\/]+$/g, "")}${separator}${name}`;
}

function basename(path) {
  return String(path || "").split(/[\\/]/).pop() || "documento.pdf";
}

function safeStem(name) {
  return String(name || "documento")
    .replace(/\.pdf$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120) || "documento";
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

function activeItems() {
  return state.items.filter((item) => item.included);
}

function setBusy(busy) {
  state.busy = busy;
  els.add.disabled = busy;
  els.clear.disabled = busy || state.items.length === 0;
  els.profile.disabled = busy;
  els.preserveCreation.disabled = busy;
  els.updateModification.disabled = busy;
  els.process.disabled = busy || activeItems().length === 0;
  els.process.textContent = busy ? "Cancelar procesamiento" : "Elegir carpeta y procesar";
}

function updateSummary() {
  const included = activeItems();
  const ready = included.filter((item) => item.status === "ready").length;
  const errors = state.items.filter((item) => item.status === "error").length;
  els.summary.textContent = state.items.length
    ? `${state.items.length} archivos · ${included.length} incluidos · ${ready} preparados${errors ? ` · ${errors} con error` : ""}`
    : "No hay archivos añadidos.";
  els.empty.hidden = state.items.length > 0;
  els.clear.disabled = state.busy || state.items.length === 0;
  els.process.disabled = state.busy || included.length === 0 || included.some((item) => item.status === "analyzing");
}

function render() {
  els.list.replaceChildren(...state.items.map((item) => {
    const row = document.createElement("article");
    row.className = `metadata-batch-item is-${item.status}`;
    row.dataset.id = item.id;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = item.included;
    check.disabled = state.busy;
    check.setAttribute("aria-label", `Incluir ${item.name}`);
    check.addEventListener("change", () => {
      item.included = check.checked;
      updateSummary();
    });

    const copy = document.createElement("div");
    copy.className = "metadata-batch-item-copy";

    const title = document.createElement("strong");
    title.textContent = item.name;

    const meta = document.createElement("span");
    if (item.status === "analyzing") {
      meta.textContent = "Analizando…";
    } else if (item.status === "error") {
      meta.textContent = item.error || "No se pudo analizar.";
    } else if (item.metadata) {
      const risk = privacyAssessment(item.metadata);
      meta.textContent = `${item.metadata.pageCount} páginas · ${formatBytes(item.size)} · Riesgo ${risk.level.toUpperCase()} ${risk.score}/100`;
    } else {
      meta.textContent = formatBytes(item.size);
    }

    const stateBadge = document.createElement("span");
    stateBadge.className = "metadata-batch-state";
    stateBadge.textContent = {
      queued: "Pendiente",
      analyzing: "Analizando",
      ready: "Preparado",
      processing: "Procesando",
      success: "Correcto",
      warning: "Revisar",
      error: "Error",
      cancelled: "Cancelado",
    }[item.status] || item.status;

    copy.append(title, meta);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary-button metadata-batch-remove";
    remove.textContent = "Quitar";
    remove.disabled = state.busy;
    remove.addEventListener("click", () => {
      state.items = state.items.filter((candidate) => candidate.id !== item.id);
      render();
    });

    row.append(check, copy, stateBadge, remove);
    return row;
  }));
  updateSummary();
}

async function inspectItem(item) {
  item.status = "analyzing";
  render();
  try {
    item.metadata = await inspectPdfMetadata(item.bytes, {
      pdfjsLib: window.pdfjsLib,
      PDFDocument: window.PDFLib?.PDFDocument,
    });
    item.status = "ready";
    item.error = "";
  } catch (error) {
    item.status = "error";
    item.included = false;
    item.error = error?.message || String(error);
  }
  render();
}
/* PDFPRIVADO_METADATA_BATCH_HTML_PICKER_V1
   Selector múltiple local sin depender de dialog.open para leer archivos. */
async function addFiles() {
  if (state.busy) return;

  setStatus("Abriendo selector local de PDF…", "info");

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf,.pdf";
  input.multiple = true;
  input.style.position = "fixed";
  input.style.left = "-10000px";
  input.style.top = "-10000px";
  document.body.appendChild(input);

  input.addEventListener("change", async () => {
    const files = [...(input.files || [])];
    input.remove();

    if (!files.length) {
      setStatus("No se seleccionaron archivos.", "info");
      return;
    }

    try {
      const existing = new Set(
        state.items.map((item) => `${item.name.toLowerCase()}|${item.size}`)
      );
      const added = [];

      for (const file of files) {
        const key = `${file.name.toLowerCase()}|${file.size}`;
        if (existing.has(key)) continue;

        const bytes = new Uint8Array(await file.arrayBuffer());
        const item = {
          id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          path: "",
          name: file.name,
          size: bytes.byteLength,
          bytes,
          metadata: null,
          included: true,
          status: "queued",
          error: "",
        };

        state.items.push(item);
        added.push(item);
        existing.add(key);
      }

      render();

      if (!added.length) {
        setStatus("Los PDF seleccionados ya estaban añadidos.", "info");
        return;
      }

      setStatus(`Analizando ${added.length} archivo(s) de forma local…`, "info");

      for (const item of added) {
        await inspectItem(item);
      }

      const failed = added.filter((item) => item.status === "error").length;
      setStatus(
        failed
          ? `Análisis terminado: ${added.length - failed} preparados y ${failed} con error.`
          : `${added.length} archivo(s) preparados para el lote.`,
        failed ? "warning" : "success"
      );
    } catch (error) {
      setStatus(error?.message || "No se pudieron añadir los archivos.", "error");
    }
  }, { once: true });

  input.addEventListener("cancel", () => {
    input.remove();
    setStatus("Selección cancelada.", "info");
  }, { once: true });

  input.click();
}
async function freeName(fs, directory, desired) {
  const clean = `${safeStem(desired)}_metadatos.pdf`;
  if (typeof fs.exists !== "function") return clean;
  const stem = clean.replace(/\.pdf$/i, "");
  for (let index = 1; index < 10000; index += 1) {
    const name = index === 1 ? clean : `${stem} (${index}).pdf`;
    if (!(await fs.exists(pathJoin(directory, name)))) return name;
  }
  throw new Error("No se pudo encontrar un nombre libre.");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function buildGlobalReports(results, profileId, destination) {
  const ok = results.filter((item) => item.status === "success").length;
  const warning = results.filter((item) => item.status === "warning").length;
  const error = results.filter((item) => item.status === "error").length;
  const lines = [
    "PDFPRIVADO PRO — INFORME GLOBAL DE METADATOS POR LOTES",
    `Fecha: ${new Date().toLocaleString()}`,
    `Perfil: ${METADATA_PROFILES[profileId]?.label || profileId}`,
    `Carpeta de salida: ${destination}`,
    `Total: ${results.length}`,
    `Correctos: ${ok}`,
    `Advertencias: ${warning}`,
    `Errores: ${error}`,
    "",
  ];
  for (const result of results) {
    lines.push(`[${result.status.toUpperCase()}] ${result.name}`);
    lines.push(`Salida: ${result.outputPath || "—"}`);
    if (result.message) lines.push(`Detalle: ${result.message}`);
    lines.push("");
  }
  lines.push("Procesamiento 100% local. Ningún original ha sido modificado.");

  const csv = [
    ["archivo", "estado", "salida", "riesgo_original", "riesgo_resultado", "detalle"].map(csvCell).join(","),
    ...results.map((result) => [
      result.name,
      result.status,
      result.outputPath || "",
      result.beforeRisk ?? "",
      result.afterRisk ?? "",
      result.message || "",
    ].map(csvCell).join(",")),
  ].join("\r\n");

  return { txt: lines.join("\n"), csv };
}

async function processBatch() {
  if (state.busy) {
    state.cancelRequested = true;
    setStatus("Cancelación solicitada. Se detendrá después del archivo actual.", "warning");
    return;
  }

  const items = activeItems().filter((item) => item.metadata && item.bytes);
  if (!items.length) return;

  try {
    const { dialog, fs } = tauriApis();
    const selected = await dialog.open({
      directory: true,
      multiple: false,
      title: "Elige la carpeta para las copias con metadatos",
    });
    const directory = Array.isArray(selected) ? selected[0] : selected;
    if (!directory) return;

    state.destination = String(directory);
    state.results = [];
    state.cancelRequested = false;
    setBusy(true);
    els.progress.hidden = false;
    els.progress.max = items.length;
    els.progress.value = 0;
    els.progressValue.textContent = `0 / ${items.length}`;

    const profileId = els.profile.value;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (state.cancelRequested) {
        item.status = "cancelled";
        render();
        break;
      }

      item.status = "processing";
      render();
      setStatus(`Procesando ${index + 1} de ${items.length}: ${item.name}`, "info");

      try {
        const proposed = applyProfile(item.metadata, profileId);
        const output = await writePdfMetadata(item.bytes, proposed, {
          PDFDocument: window.PDFLib?.PDFDocument,
          preserveCreationDate: els.preserveCreation.checked,
          updateModificationDate: els.updateModification.checked,
        });
        const verification = await verifyPdfMetadata(output, proposed, {
          pdfjsLib: window.pdfjsLib,
          PDFDocument: window.PDFLib?.PDFDocument,
        });
        const outputName = await freeName(fs, state.destination, item.name);
        const outputPath = pathJoin(state.destination, outputName);
        await fs.writeFile(outputPath, output);

        const beforeRisk = privacyAssessment(item.metadata).score;
        const afterRisk = privacyAssessment(verification.actual || proposed).score;
        item.status = verification.ok ? "success" : "warning";
        state.results.push({
          name: item.name,
          status: item.status,
          outputPath,
          beforeRisk,
          afterRisk,
          message: verification.ok ? "Copia verificada correctamente." : "La copia se creó, pero algunos campos requieren revisión.",
        });
      } catch (error) {
        item.status = "error";
        item.error = error?.message || String(error);
        state.results.push({
          name: item.name,
          status: "error",
          outputPath: "",
          message: item.error,
        });
      }

      els.progress.value = index + 1;
      els.progressValue.textContent = `${index + 1} / ${items.length}`;
      render();
    }

    const reports = buildGlobalReports(state.results, profileId, state.destination);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.writeFile(
      pathJoin(state.destination, `PDFPrivado-informe-metadatos-lote-${stamp}.txt`),
      new TextEncoder().encode(reports.txt)
    );
    await fs.writeFile(
      pathJoin(state.destination, `PDFPrivado-informe-metadatos-lote-${stamp}.csv`),
      new TextEncoder().encode(reports.csv)
    );

    const errors = state.results.filter((item) => item.status === "error").length;
    const warnings = state.results.filter((item) => item.status === "warning").length;
    setStatus(
      state.cancelRequested
        ? "Procesamiento cancelado. Los resultados ya creados se conservaron."
        : `Lote terminado: ${state.results.length - errors - warnings} correctos, ${warnings} para revisar y ${errors} errores. Informes TXT y CSV guardados en la carpeta elegida.`,
      state.cancelRequested || errors || warnings ? "warning" : "success"
    );
  } catch (error) {
    setStatus(error?.message || "No se pudo completar el lote.", "error");
  } finally {
    setBusy(false);
    render();
  }
}

els.add.addEventListener("click", () => void addFiles());
els.clear.addEventListener("click", () => {
  if (state.busy) return;
  state.items = [];
  state.results = [];
  els.progress.hidden = true;
  setStatus("");
  render();
});
els.process.addEventListener("click", () => void processBatch());
els.profile.addEventListener("change", updateSummary);

render();
