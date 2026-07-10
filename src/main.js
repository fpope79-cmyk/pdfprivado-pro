const year = document.querySelector("#current-year");
const homeView = document.querySelector("#home-view");
const mergeView = document.querySelector("#merge-view");
const mergeTitle = document.querySelector("#merge-title");
const backHomeButton = document.querySelector("#back-home-button");
const openMergeButtons = document.querySelectorAll('[data-open-tool="merge"]');
const mergeCardStatus = document.querySelector("#merge-card-status");
const fileInput = document.querySelector("#pdf-file-input");
const emptyAddButton = document.querySelector("#empty-add-button");
const addMoreButton = document.querySelector("#add-more-files-button");
const clearButton = document.querySelector("#clear-files-button");
const fileList = document.querySelector("#file-list");
const emptyState = document.querySelector("#empty-state");
const summary = document.querySelector("#selection-summary");
const selectorStatus = document.querySelector("#selector-status");
const selectionFeedback = document.querySelector("#selection-feedback");
const outputNameInput = document.querySelector("#output-name-input");
const mergeButton = document.querySelector("#merge-pdf-button");
const mergeRequirement = document.querySelector("#merge-requirement");
const mergeProgressPanel = document.querySelector("#merge-progress-panel");
const mergeProgress = document.querySelector("#merge-progress");
const mergeProgressTitle = document.querySelector("#merge-progress-title");
const mergeProgressValue = document.querySelector("#merge-progress-value");
const mergeProgressDetail = document.querySelector("#merge-progress-detail");

const selectedFiles = [];
const rowAnimations = new WeakMap();
const dragState = {
  key: null,
  pointerId: null,
  handle: null,
  sourceRow: null,
  preview: null,
  startX: 0,
  startY: 0,
  initialIndex: -1,
  currentIndex: -1,
  active: false,
};
let mergeInProgress = false;

if (year) {
  year.textContent = String(new Date().getFullYear());
}

let lastMergeTrigger = null;

function showMergeView(trigger = null) {
  lastMergeTrigger = trigger instanceof HTMLElement ? trigger : null;
  homeView.hidden = true;
  mergeView.hidden = false;
  document.title = "Unir PDF | PDFPrivado Pro";
  window.scrollTo({ top: 0, behavior: "auto" });

  requestAnimationFrame(() => {
    mergeTitle?.focus({ preventScroll: true });
  });
}

function showHomeView() {
  mergeView.hidden = true;
  homeView.hidden = false;
  document.title = "PDFPrivado Pro";
  window.scrollTo({ top: 0, behavior: "auto" });

  requestAnimationFrame(() => {
    lastMergeTrigger?.focus({ preventScroll: true });
  });
}

function fileKey(file) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

function formatBytes(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value < 0) {
    return "Tamaño no disponible";
  }

  if (value === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );
  const amount = value / 1024 ** unitIndex;
  const decimals = unitIndex === 0 || amount >= 100 ? 0 : 1;

  return `${amount.toFixed(decimals)} ${units[unitIndex]}`;
}

function totalBytes() {
  return selectedFiles.reduce((total, item) => total + item.file.size, 0);
}

function setStatus(message, kind = "normal") {
  selectorStatus.textContent = message;
  selectorStatus.dataset.kind = kind;
}

function setFeedback(message, kind = "info") {
  selectionFeedback.textContent = message;
  selectionFeedback.dataset.kind = kind;
  selectionFeedback.hidden = false;
}

function openFileSelector() {
  if (mergeInProgress) {
    return;
  }

  fileInput.value = "";
  setStatus("Selector de archivos abierto.");
  fileInput.click();
}

function removeFile(key) {
  if (mergeInProgress) {
    return;
  }

  const index = selectedFiles.findIndex((item) => item.key === key);

  if (index >= 0) {
    selectedFiles.splice(index, 1);
    resetMergeProgress();
    renderFiles();
    setStatus("Archivo retirado de la lista temporal.");
  }
}

function focusMovedFile(targetIndex, selector = ".drag-handle") {
  requestAnimationFrame(() => {
    const movedRow = fileList.children.item(targetIndex);
    movedRow?.querySelector(selector)?.focus();
  });
}

function reorderSelectedFiles(fromIndex, targetIndex) {
  if (
    fromIndex < 0 ||
    fromIndex >= selectedFiles.length ||
    selectedFiles.length < 2
  ) {
    return null;
  }

  const boundedTarget = Math.max(
    0,
    Math.min(targetIndex, selectedFiles.length - 1)
  );

  if (fromIndex === boundedTarget) {
    return null;
  }

  const [movedItem] = selectedFiles.splice(fromIndex, 1);
  selectedFiles.splice(boundedTarget, 0, movedItem);
  return movedItem;
}

function moveFileToIndex(key, targetIndex) {
  const currentIndex = selectedFiles.findIndex((item) => item.key === key);
  const movedItem = reorderSelectedFiles(currentIndex, targetIndex);

  if (!movedItem) {
    return false;
  }

  const finalIndex = selectedFiles.findIndex((item) => item.key === key);
  resetMergeProgress();
  renderFiles();

  const message = `${movedItem.file.name} movido a la posición ${finalIndex + 1}.`;
  setStatus(message);
  setFeedback(message, "info");
  focusMovedFile(finalIndex);

  return true;
}

function updateVisiblePositions() {
  Array.from(fileList.children).forEach((row, index) => {
    const position = row.querySelector(".file-position");

    if (position) {
      position.textContent = String(index + 1).padStart(2, "0");
    }
  });

  if (dragState.preview && dragState.currentIndex >= 0) {
    const previewPosition = dragState.preview.querySelector(".file-position");

    if (previewPosition) {
      previewPosition.textContent = String(dragState.currentIndex + 1).padStart(
        2,
        "0"
      );
    }
  }
}

function captureRowPositions() {
  const positions = new Map();

  Array.from(fileList.children).forEach((row) => {
    if (row !== dragState.sourceRow) {
      positions.set(row, row.getBoundingClientRect().top);
    }
  });

  return positions;
}

function animateShiftedRows(previousPositions) {
  Array.from(fileList.children).forEach((row) => {
    if (row === dragState.sourceRow || !previousPositions.has(row)) {
      return;
    }

    const previousTop = previousPositions.get(row);
    const currentTop = row.getBoundingClientRect().top;
    const delta = previousTop - currentTop;

    if (Math.abs(delta) < 1 || typeof row.animate !== "function") {
      return;
    }

    rowAnimations.get(row)?.cancel();
    const animation = row.animate(
      [
        { transform: `translateY(${delta}px)` },
        { transform: "translateY(0)" },
      ],
      {
        duration: 170,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      }
    );
    rowAnimations.set(row, animation);
  });
}

function calculateLiveTargetIndex(clientY) {
  const otherRows = Array.from(fileList.children).filter(
    (row) => row !== dragState.sourceRow
  );

  for (const [index, row] of otherRows.entries()) {
    const bounds = row.getBoundingClientRect();

    if (clientY < bounds.top + bounds.height / 2) {
      return index;
    }
  }

  return otherRows.length;
}

function reorderDuringDrag(targetIndex) {
  const sourceRow = dragState.sourceRow;

  if (!sourceRow || targetIndex === dragState.currentIndex) {
    return;
  }

  const previousPositions = captureRowPositions();
  const otherRows = Array.from(fileList.children).filter(
    (row) => row !== sourceRow
  );
  const referenceRow = otherRows[targetIndex] ?? null;

  if (referenceRow) {
    fileList.insertBefore(sourceRow, referenceRow);
  } else {
    fileList.append(sourceRow);
  }

  const movedItem = reorderSelectedFiles(dragState.currentIndex, targetIndex);

  if (!movedItem) {
    return;
  }

  dragState.currentIndex = targetIndex;
  updateVisiblePositions();
  animateShiftedRows(previousPositions);
  setStatus(
    `Moviendo ${movedItem.file.name} a la posición ${targetIndex + 1}.`
  );
}

function createFloatingPreview(row) {
  const bounds = row.getBoundingClientRect();
  const preview = row.cloneNode(true);

  preview.classList.remove("is-dragging-placeholder");
  preview.classList.add("drag-preview");
  preview.setAttribute("aria-hidden", "true");
  preview.style.left = `${bounds.left}px`;
  preview.style.top = `${bounds.top}px`;
  preview.style.width = `${bounds.width}px`;
  preview.style.height = `${bounds.height}px`;

  preview.querySelectorAll("button").forEach((button) => {
    button.tabIndex = -1;
  });

  document.body.append(preview);
  return preview;
}

function positionFloatingPreview(event) {
  if (!dragState.preview) {
    return;
  }

  const horizontalMovement = Math.max(
    -22,
    Math.min(22, event.clientX - dragState.startX)
  );
  const verticalMovement = event.clientY - dragState.startY;

  dragState.preview.style.transform =
    `translate3d(${horizontalMovement}px, ${verticalMovement}px, 0)`;
}

function resetPointerDrag() {
  window.removeEventListener("pointermove", continuePointerDrag, true);
  window.removeEventListener("pointerup", endPointerDrag, true);
  window.removeEventListener("pointercancel", cancelPointerDrag, true);

  dragState.sourceRow?.classList.remove("is-dragging-placeholder");
  dragState.preview?.remove();
  document.body.classList.remove("is-reordering-files");

  dragState.key = null;
  dragState.pointerId = null;
  dragState.handle = null;
  dragState.sourceRow = null;
  dragState.preview = null;
  dragState.startX = 0;
  dragState.startY = 0;
  dragState.initialIndex = -1;
  dragState.currentIndex = -1;
  dragState.active = false;
}

function activatePointerDrag(item, row, event) {
  dragState.active = true;
  dragState.preview = createFloatingPreview(row);
  row.classList.add("is-dragging-placeholder");
  document.body.classList.add("is-reordering-files");
  positionFloatingPreview(event);
  setStatus(`Arrastrando ${item.file.name}.`);
}

function beginPointerDrag(event, item, row, handle) {
  if (mergeInProgress) {
    return;
  }

  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  handle.focus({ preventScroll: true });

  const currentIndex = selectedFiles.findIndex(
    (selectedItem) => selectedItem.key === item.key
  );

  dragState.key = item.key;
  dragState.pointerId = event.pointerId;
  dragState.handle = handle;
  dragState.sourceRow = row;
  dragState.preview = null;
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  dragState.initialIndex = currentIndex;
  dragState.currentIndex = currentIndex;
  dragState.active = false;

  window.addEventListener("pointermove", continuePointerDrag, true);
  window.addEventListener("pointerup", endPointerDrag, true);
  window.addEventListener("pointercancel", cancelPointerDrag, true);
}

function continuePointerDrag(event) {
  if (dragState.pointerId !== event.pointerId || !dragState.key) {
    return;
  }

  event.preventDefault();

  const item = selectedFiles.find(
    (selectedItem) => selectedItem.key === dragState.key
  );
  const row = dragState.sourceRow;

  if (!item || !row) {
    resetPointerDrag();
    return;
  }

  if (!dragState.active) {
    const distance = Math.hypot(
      event.clientX - dragState.startX,
      event.clientY - dragState.startY
    );

    if (distance < 5) {
      return;
    }

    activatePointerDrag(item, row, event);
  }

  positionFloatingPreview(event);
  reorderDuringDrag(calculateLiveTargetIndex(event.clientY));
}

function endPointerDrag(event) {
  if (dragState.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();

  const wasActive = dragState.active;
  const draggedKey = dragState.key;
  const initialIndex = dragState.initialIndex;
  const finalIndex = dragState.currentIndex;
  const draggedItem = selectedFiles.find((item) => item.key === draggedKey);

  resetPointerDrag();

  if (!wasActive) {
    return;
  }

  resetMergeProgress();
  renderFiles();

  if (draggedItem && initialIndex !== finalIndex) {
    const message =
      `${draggedItem.file.name} movido a la posición ${finalIndex + 1}.`;
    setStatus(message);
    setFeedback(message, "info");
  } else {
    setStatus("El archivo conserva la misma posición.");
  }

  focusMovedFile(Math.max(0, finalIndex));
}

function cancelPointerDrag(event) {
  if (dragState.pointerId !== event.pointerId) {
    return;
  }

  const wasActive = dragState.active;
  const draggedKey = dragState.key;
  const initialIndex = dragState.initialIndex;
  const currentIndex = dragState.currentIndex;

  if (wasActive && initialIndex >= 0 && currentIndex >= 0) {
    reorderSelectedFiles(currentIndex, initialIndex);
  }

  resetPointerDrag();

  if (wasActive) {
    renderFiles();
    setStatus("Movimiento cancelado. La lista conserva el orden anterior.");
    setFeedback("Movimiento cancelado. No se cambió el orden.", "info");
    const restoredIndex = selectedFiles.findIndex((item) => item.key === draggedKey);
    focusMovedFile(Math.max(0, restoredIndex));
  }
}

function createDragHandle(item, row) {
  const handle = document.createElement("button");
  handle.className = "drag-handle";
  handle.type = "button";
  handle.title = "Arrastrar para cambiar el orden";
  handle.setAttribute("aria-describedby", "reorder-instructions");
  handle.setAttribute(
    "aria-label",
    `Arrastrar ${item.file.name} para cambiar su posición. También puedes usar las flechas arriba y abajo del teclado.`
  );

  const grip = document.createElement("span");
  grip.className = "grip-dots";
  grip.setAttribute("aria-hidden", "true");
  handle.append(grip);

  handle.addEventListener("pointerdown", (event) =>
    beginPointerDrag(event, item, row, handle)
  );
  handle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }

    event.preventDefault();
    const currentIndex = selectedFiles.findIndex(
      (selectedItem) => selectedItem.key === item.key
    );
    const direction = event.key === "ArrowUp" ? -1 : 1;
    moveFileToIndex(item.key, currentIndex + direction);
  });

  return handle;
}

function renderFiles() {
  fileList.replaceChildren();

  for (const [index, item] of selectedFiles.entries()) {
    const row = document.createElement("li");
    row.className = "file-item";
    row.dataset.fileKey = item.key;

    const dragHandle = createDragHandle(item, row);
    dragHandle.disabled = mergeInProgress;

    const position = document.createElement("span");
    position.className = "file-position";
    position.textContent = String(index + 1).padStart(2, "0");

    const details = document.createElement("div");
    details.className = "file-details";

    const name = document.createElement("strong");
    name.textContent = item.file.name;
    name.title = item.file.name;

    const metadata = document.createElement("span");
    metadata.textContent = formatBytes(item.file.size);

    details.append(name, metadata);

    const removeButton = document.createElement("button");
    removeButton.className = "remove-button";
    removeButton.type = "button";
    removeButton.textContent = "Quitar";
    removeButton.setAttribute("aria-label", `Quitar ${item.file.name}`);
    removeButton.disabled = mergeInProgress;
    removeButton.addEventListener("click", () => removeFile(item.key));

    row.append(dragHandle, position, details, removeButton);
    fileList.append(row);
  }

  const count = selectedFiles.length;
  emptyState.hidden = count > 0;
  addMoreButton.hidden = count === 0;
  addMoreButton.disabled = mergeInProgress;
  clearButton.disabled = count === 0 || mergeInProgress;
  summary.textContent =
    `${count} ${count === 1 ? "archivo" : "archivos"} · ${formatBytes(totalBytes())}`;

  if (mergeCardStatus) {
    mergeCardStatus.textContent =
      count === 0
        ? "Abrir herramienta"
        : `${count} ${count === 1 ? "archivo preparado" : "archivos preparados"}`;
    mergeCardStatus.dataset.hasFiles = count > 0 ? "true" : "false";
  }

  updateMergeControls();
}

function addSelectedFiles(fileCollection) {
  const existingKeys = new Set(selectedFiles.map((item) => item.key));
  let added = 0;
  let ignored = 0;
  let rejected = 0;

  for (const file of Array.from(fileCollection)) {
    const looksLikePdf =
      file.name.toLocaleLowerCase().endsWith(".pdf") ||
      file.type === "application/pdf";

    if (!looksLikePdf) {
      rejected += 1;
      continue;
    }

    const key = fileKey(file);

    if (existingKeys.has(key)) {
      ignored += 1;
      continue;
    }

    selectedFiles.push({ key, file });
    existingKeys.add(key);
    added += 1;
  }

  if (added > 0) {
    resetMergeProgress();
  }

  renderFiles();

  if (added > 0 && ignored === 0 && rejected === 0) {
    const message =
      `${added} ${added === 1 ? "archivo añadido" : "archivos añadidos"} correctamente.`;
    setStatus(message);
    setFeedback(message, "success");
  } else if (added > 0) {
    const message =
      `${added} añadidos. ${ignored} omitidos por estar repetidos. ` +
      `${rejected} rechazados por no ser PDF.`;
    setStatus(message);
    setFeedback(message, "warning");
  } else if (ignored > 0) {
    const message =
      ignored === 1
        ? "No se añadió el archivo porque ya estaba en la lista."
        : `No se añadieron los ${ignored} archivos porque ya estaban en la lista.`;
    setStatus(message);
    setFeedback(message, "warning");
  } else if (rejected > 0) {
    const message = "No se añadió nada: solo se admiten documentos PDF.";
    setStatus(message, "error");
    setFeedback(message, "error");
  } else {
    setStatus("Selección cancelada.");
    setFeedback("No se realizaron cambios en la lista.", "info");
  }

  fileInput.value = "";
}


function hasLocalPdfEngine() {
  return Boolean(
    window.PDFLib &&
      window.PDFLib.PDFDocument &&
      typeof window.PDFLib.PDFDocument.create === "function"
  );
}

function normalizeOutputName(value) {
  let name = String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/[. ]+$/g, "");

  if (!name) {
    name = "PDFPrivado_Unido";
  }

  if (!name.toLocaleLowerCase().endsWith(".pdf")) {
    name += ".pdf";
  }

  if (name.length > 120) {
    name = `${name.slice(0, 116)}.pdf`;
  }

  return name;
}

function updateMergeControls() {
  if (!mergeButton || !mergeRequirement || !outputNameInput) {
    return;
  }

  const count = selectedFiles.length;
  const engineReady = hasLocalPdfEngine();
  const enoughFiles = count >= 2;

  mergeButton.disabled = mergeInProgress || !engineReady || !enoughFiles;
  outputNameInput.disabled = mergeInProgress;
  mergeButton.classList.toggle("is-processing", mergeInProgress);
  mergeButton.textContent = mergeInProgress ? "Uniendo..." : "Unir y guardar";

  if (!engineReady) {
    mergeRequirement.textContent = "No se pudo cargar el motor PDF local.";
    mergeRequirement.dataset.kind = "error";
  } else if (mergeInProgress) {
    mergeRequirement.textContent = "Procesando los documentos únicamente en este equipo.";
    mergeRequirement.dataset.kind = "working";
  } else if (!enoughFiles) {
    mergeRequirement.textContent = "Añade al menos 2 PDF para comenzar.";
    mergeRequirement.dataset.kind = "normal";
  } else {
    mergeRequirement.textContent =
      `Se unirán ${count} PDF siguiendo exactamente el orden mostrado.`;
    mergeRequirement.dataset.kind = "ready";
  }
}

function setMergeProgress(percent, title, detail) {
  const boundedValue = Math.max(0, Math.min(100, Math.round(percent)));

  mergeProgressPanel.hidden = false;
  mergeProgress.value = boundedValue;
  mergeProgress.textContent = `${boundedValue} %`;
  mergeProgressValue.textContent = `${boundedValue} %`;
  mergeProgressTitle.textContent = title;
  mergeProgressDetail.textContent = detail;
}

function resetMergeProgress() {
  if (!mergeProgressPanel) {
    return;
  }

  mergeProgressPanel.hidden = true;
  mergeProgress.value = 0;
  mergeProgress.textContent = "0 %";
  mergeProgressValue.textContent = "0 %";
  mergeProgressTitle.textContent = "Preparando la unión";
  mergeProgressDetail.textContent = "Esperando para comenzar.";
  mergeProgressPanel.dataset.kind = "normal";
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function fileNameFromPath(path, fallbackName) {
  const parts = String(path ?? "").split(/[\\/]/);
  return parts.at(-1) || fallbackName;
}

async function chooseOutputTarget(suggestedName) {
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "Documento PDF",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
        excludeAcceptAllOption: true,
      });

      return {
        kind: "file-system-access",
        handle,
        name: handle.name || suggestedName,
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        return null;
      }
      throw error;
    }
  }

  const tauriDialog = window.__TAURI__?.dialog;
  const tauriFs = window.__TAURI__?.fs;

  if (
    typeof tauriDialog?.save === "function" &&
    typeof tauriFs?.writeFile === "function"
  ) {
    const path = await tauriDialog.save({
      defaultPath: suggestedName,
      filters: [{ name: "Documento PDF", extensions: ["pdf"] }],
    });

    if (!path) {
      return null;
    }

    return {
      kind: "tauri",
      path,
      writeFile: tauriFs.writeFile,
      name: fileNameFromPath(path, suggestedName),
    };
  }

  return {
    kind: "download",
    name: suggestedName,
  };
}

async function writeOutputTarget(target, bytes) {
  if (target.kind === "file-system-access") {
    const writable = await target.handle.createWritable();

    try {
      await writable.write(bytes);
      await writable.close();
    } catch (error) {
      if (typeof writable.abort === "function") {
        await writable.abort().catch(() => {});
      }
      throw error;
    }

    return { usedDownloadFallback: false };
  }

  if (target.kind === "tauri") {
    await target.writeFile(target.path, bytes);
    return { usedDownloadFallback: false };
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = target.name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);

  return { usedDownloadFallback: true };
}

function describePdfLoadError(error, fileName) {
  const detail = String(error?.message ?? error ?? "");

  if (/encrypt|password/i.test(detail)) {
    return new Error(
      `${fileName} está protegido con contraseña o cifrado y no puede unirse en esta versión.`
    );
  }

  return new Error(
    `No se pudo leer ${fileName}. El documento puede estar dañado o usar una estructura no compatible.`
  );
}

async function mergeAndSavePdfs() {
  if (mergeInProgress || selectedFiles.length < 2) {
    return;
  }

  if (!hasLocalPdfEngine()) {
    setFeedback("No se pudo cargar el motor PDF local.", "error");
    updateMergeControls();
    return;
  }

  const outputName = normalizeOutputName(outputNameInput.value);
  outputNameInput.value = outputName;

  let outputTarget;

  try {
    outputTarget = await chooseOutputTarget(outputName);
  } catch (error) {
    setFeedback(
      "No se pudo abrir el selector de guardado. No se ha creado ningún archivo.",
      "error"
    );
    setStatus("No se pudo elegir la ubicación de salida.", "error");
    return;
  }

  if (!outputTarget) {
    setFeedback("Guardado cancelado. No se ha creado ningún archivo.", "info");
    setStatus("Guardado cancelado.");
    return;
  }

  mergeInProgress = true;
  renderFiles();
  setMergeProgress(
    3,
    "Preparando la unión",
    "Los documentos siguen dentro de este equipo."
  );
  setFeedback("Uniendo los PDF localmente...", "info");

  try {
    const { PDFDocument } = window.PDFLib;
    const outputPdf = await PDFDocument.create();
    let totalPages = 0;

    for (const [index, item] of selectedFiles.entries()) {
      const baseProgress = 8 + (index / selectedFiles.length) * 68;
      setMergeProgress(
        baseProgress,
        `Leyendo PDF ${index + 1} de ${selectedFiles.length}`,
        item.file.name
      );
      setStatus(`Procesando ${item.file.name}.`);
      await nextPaint();

      const sourceBytes = await item.file.arrayBuffer();
      let sourcePdf;

      try {
        sourcePdf = await PDFDocument.load(sourceBytes, {
          ignoreEncryption: false,
        });
      } catch (error) {
        throw describePdfLoadError(error, item.file.name);
      }

      const pageIndices = sourcePdf.getPageIndices();
      const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndices);

      for (const page of copiedPages) {
        outputPdf.addPage(page);
      }

      totalPages += copiedPages.length;
      setMergeProgress(
        8 + ((index + 1) / selectedFiles.length) * 68,
        `PDF ${index + 1} de ${selectedFiles.length} incorporado`,
        `${item.file.name} · ${copiedPages.length} ${copiedPages.length === 1 ? "página" : "páginas"}`
      );
      await nextPaint();
    }

    if (totalPages === 0) {
      throw new Error("Los documentos seleccionados no contienen páginas para unir.");
    }

    outputPdf.setCreator("PDFPrivado Pro");
    outputPdf.setProducer("PDFPrivado Pro");

    setMergeProgress(
      82,
      "Creando el PDF nuevo",
      `${totalPages} ${totalPages === 1 ? "página preparada" : "páginas preparadas"}.`
    );
    await nextPaint();

    const mergedBytes = await outputPdf.save({
      addDefaultPage: false,
      useObjectStreams: true,
    });

    setMergeProgress(
      94,
      "Guardando el resultado",
      outputTarget.name
    );
    await writeOutputTarget(outputTarget, mergedBytes).then((saveResult) => {
      outputTarget.usedDownloadFallback = saveResult.usedDownloadFallback;
    });

    const successMessage =
      `${outputTarget.name} guardado correctamente · ` +
      `${totalPages} ${totalPages === 1 ? "página" : "páginas"} · ` +
      `${formatBytes(mergedBytes.length)}.`;

    setMergeProgress(100, "PDF unido y guardado", successMessage);
    mergeProgressPanel.dataset.kind = "success";
    setFeedback(successMessage, "success");
    setStatus(successMessage);

    if (outputTarget.usedDownloadFallback) {
      setFeedback(
        `${successMessage} El sistema utilizó la descarga local; revisa la carpeta Descargas.`,
        "success"
      );
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo completar la unión de los documentos.";

    setMergeProgress(0, "No se pudo completar la unión", message);
    mergeProgressPanel.dataset.kind = "error";
    setFeedback(message, "error");
    setStatus(message, "error");
  } finally {
    mergeInProgress = false;
    renderFiles();
  }
}

openMergeButtons.forEach((button) => {
  button.addEventListener("click", () => showMergeView(button));
});

backHomeButton?.addEventListener("click", showHomeView);
emptyAddButton?.addEventListener("click", openFileSelector);
addMoreButton?.addEventListener("click", openFileSelector);

fileInput?.addEventListener("change", () => {
  if (fileInput.files) {
    addSelectedFiles(fileInput.files);
  }
});

fileInput?.addEventListener("cancel", () => {
  setStatus("Selección cancelada.");
  setFeedback("No se realizaron cambios en la lista.", "info");
});

clearButton?.addEventListener("click", () => {
  if (mergeInProgress) {
    return;
  }

  selectedFiles.length = 0;
  fileInput.value = "";
  resetMergeProgress();
  renderFiles();
  setStatus("Lista temporal vaciada.");
  setFeedback("La lista temporal se ha vaciado.", "info");
});

outputNameInput?.addEventListener("blur", () => {
  outputNameInput.value = normalizeOutputName(outputNameInput.value);
});

mergeButton?.addEventListener("click", mergeAndSavePdfs);

renderFiles();
