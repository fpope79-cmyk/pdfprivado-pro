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
  fileInput.value = "";
  setStatus("Selector de archivos abierto.");
  fileInput.click();
}

function removeFile(key) {
  const index = selectedFiles.findIndex((item) => item.key === key);

  if (index >= 0) {
    selectedFiles.splice(index, 1);
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
    removeButton.addEventListener("click", () => removeFile(item.key));

    row.append(dragHandle, position, details, removeButton);
    fileList.append(row);
  }

  const count = selectedFiles.length;
  emptyState.hidden = count > 0;
  addMoreButton.hidden = count === 0;
  clearButton.disabled = count === 0;
  summary.textContent =
    `${count} ${count === 1 ? "archivo" : "archivos"} · ${formatBytes(totalBytes())}`;

  if (mergeCardStatus) {
    mergeCardStatus.textContent =
      count === 0
        ? "Abrir herramienta"
        : `${count} ${count === 1 ? "archivo preparado" : "archivos preparados"}`;
    mergeCardStatus.dataset.hasFiles = count > 0 ? "true" : "false";
  }
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
  selectedFiles.length = 0;
  fileInput.value = "";
  renderFiles();
  setStatus("Lista temporal vaciada.");
  setFeedback("La lista temporal se ha vaciado.", "info");
});

renderFiles();
