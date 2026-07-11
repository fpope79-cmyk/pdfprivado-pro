import * as pdfjsLib from "./vendor/pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.mjs",
  import.meta.url
).href;

const year = document.querySelector("#current-year");
const homeView = document.querySelector("#home-view");
const mergeView = document.querySelector("#merge-view");
const viewerView = document.querySelector("#viewer-view");
const splitView = document.querySelector("#split-view");
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
const organizePagesButton = document.querySelector("#organize-pages-button");
const pageOrganizer = document.querySelector("#page-organizer");
const closePageOrganizerButton = document.querySelector("#close-page-organizer-button");
const pageOrganizerStatus = document.querySelector("#page-organizer-status");
const pagePreviewGroups = document.querySelector("#page-preview-groups");
const pageActionToolbar = document.querySelector("#page-action-toolbar");
const selectedPagesCount = document.querySelector("#selected-pages-count");
const selectAllPagesButton = document.querySelector("#select-all-pages-button");
const rotateLeftButton = document.querySelector("#rotate-left-button");
const rotateRightButton = document.querySelector("#rotate-right-button");
const duplicatePagesButton = document.querySelector("#duplicate-pages-button");
const addBlankPageButton = document.querySelector("#add-blank-page-button");
const deletePagesButton = document.querySelector("#delete-pages-button");
const undoPageChangeButton = document.querySelector("#undo-page-change-button");
const resultOptionsButton = document.querySelector("#result-options-button");
const resultOptionsPanel = document.querySelector("#result-options-panel");
const closeResultOptionsButton = document.querySelector("#close-result-options-button");
const cleanMetadataOption = document.querySelector("#clean-metadata-option");
const titleFromNameOption = document.querySelector("#title-from-name-option");
const pageNumbersOption = document.querySelector("#page-numbers-option");

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
let pageOrganizerInProgress = false;
let pageOrganizerSignature = "";
let pagePlan = [];
let pageDragState = null;
let pageDragAutoScrollFrame = null;
const selectedPageIds = new Set();
const pageHistory = [];
let pageItemSequence = 0;
let lastSelectedPageId = null;
const resultOptions = {
  cleanMetadata: true,
  titleFromName: true,
  pageNumbers: false,
};

if (year) {
  year.textContent = String(new Date().getFullYear());
}

let lastMergeTrigger = null;

function showMergeView(trigger = null) {
  lastMergeTrigger = trigger instanceof HTMLElement ? trigger : null;
  homeView.hidden = true;
  if (viewerView) viewerView.hidden = true;
  if (splitView) splitView.hidden = true;
  document.body.classList.remove("viewer-active");
  mergeView.hidden = false;
  document.title = "Unir PDF | PDFPrivado Pro";
  window.scrollTo({ top: 0, behavior: "auto" });

  requestAnimationFrame(() => {
    mergeTitle?.focus({ preventScroll: true });
  });
}

function showHomeView() {
  mergeView.hidden = true;
  if (viewerView) viewerView.hidden = true;
  if (splitView) splitView.hidden = true;
  document.body.classList.remove("viewer-active");
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
    invalidatePageOrganizer();
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
  invalidatePageOrganizer();
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

  invalidatePageOrganizer();
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
  updatePageOrganizerControls();
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
    invalidatePageOrganizer();
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



function currentSelectionSignature() {
  return selectedFiles.map((item) => item.key).join("\u001f");
}


function clonePagePlan(plan = pagePlan) {
  return plan.map((item) => ({ ...item }));
}

function pushPageHistory(snapshot = clonePagePlan()) {
  pageHistory.push(snapshot);
  if (pageHistory.length > 20) {
    pageHistory.shift();
  }
}

function clearPageSelection() {
  selectedPageIds.clear();
  lastSelectedPageId = null;
}

function selectedPageItems() {
  return pagePlan.filter((item) => selectedPageIds.has(item.id));
}

function pageOrganizerIsReady() {
  return Boolean(
    pageOrganizer &&
      !pageOrganizer.hidden &&
      pageOrganizerSignature === currentSelectionSignature() &&
      pagePlan.length > 0
  );
}

function makePageItemId(prefix = "page") {
  pageItemSequence += 1;
  return `${prefix}\u001e${Date.now()}\u001e${pageItemSequence}`;
}

function updatePageActionControls() {
  const ready = pageOrganizerIsReady();
  const selectedCount = selectedPageIds.size;
  const busy = mergeInProgress || pageOrganizerInProgress;
  const allSelected = ready && selectedCount === pagePlan.length;

  if (pageActionToolbar) {
    pageActionToolbar.dataset.ready = ready ? "true" : "false";
  }

  if (selectedPagesCount) {
    selectedPagesCount.textContent = `${selectedCount} ${selectedCount === 1 ? "seleccionada" : "seleccionadas"}`;
    selectedPagesCount.dataset.hasSelection = selectedCount > 0 ? "true" : "false";
  }

  if (selectAllPagesButton) {
    selectAllPagesButton.disabled = busy || !ready;
    selectAllPagesButton.textContent = allSelected ? "Deseleccionar todo" : "Seleccionar todo";
  }

  for (const button of [rotateLeftButton, rotateRightButton, duplicatePagesButton]) {
    if (button) {
      button.disabled = busy || !ready || selectedCount === 0;
    }
  }

  if (deletePagesButton) {
    deletePagesButton.disabled =
      busy || !ready || selectedCount === 0 || selectedCount >= pagePlan.length;
  }

  if (addBlankPageButton) {
    addBlankPageButton.disabled = busy || !ready;
  }

  if (undoPageChangeButton) {
    undoPageChangeButton.disabled = busy || !ready || pageHistory.length === 0;
  }

  if (resultOptionsButton) {
    resultOptionsButton.disabled = busy || selectedFiles.length === 0;
    const isOpen = Boolean(resultOptionsPanel && !resultOptionsPanel.hidden);
    resultOptionsButton.classList.toggle("is-active", isOpen);
    resultOptionsButton.setAttribute("aria-expanded", String(isOpen));
  }

  if (cleanMetadataOption) {
    cleanMetadataOption.checked = resultOptions.cleanMetadata;
    cleanMetadataOption.disabled = busy;
  }
  if (titleFromNameOption) {
    titleFromNameOption.checked = resultOptions.titleFromName;
    titleFromNameOption.disabled = busy || !resultOptions.cleanMetadata;
  }
  if (pageNumbersOption) {
    pageNumbersOption.checked = resultOptions.pageNumbers;
    pageNumbersOption.disabled = busy;
  }
}

function togglePageSelection(pageId, additive = true) {
  if (!pagePlan.some((item) => item.id === pageId)) {
    return;
  }

  if (!additive) {
    clearPageSelection();
  }

  if (selectedPageIds.has(pageId)) {
    selectedPageIds.delete(pageId);
  } else {
    selectedPageIds.add(pageId);
    lastSelectedPageId = pageId;
  }

  renderPagePlan();
}

function toggleAllPages() {
  if (!pageOrganizerIsReady()) {
    return;
  }

  if (selectedPageIds.size === pagePlan.length) {
    clearPageSelection();
  } else {
    selectedPageIds.clear();
    pagePlan.forEach((item) => selectedPageIds.add(item.id));
    lastSelectedPageId = pagePlan.at(-1)?.id ?? null;
  }

  renderPagePlan();
}

function rotateSelectedPages(delta) {
  const selected = selectedPageItems();
  if (selected.length === 0 || !pageOrganizerIsReady()) {
    return;
  }

  pushPageHistory();
  for (const item of selected) {
    item.rotation = ((Number(item.rotation) || 0) + delta + 360) % 360;
  }
  renderPagePlan();
  updatePageOrganizerSummary(
    `${selected.length} ${selected.length === 1 ? "página girada" : "páginas giradas"} ${delta < 0 ? "a la izquierda" : "a la derecha"}.`
  );
  resetMergeProgress();
}

function duplicateSelectedPages() {
  const selectedIds = new Set(selectedPageIds);
  if (selectedIds.size === 0 || !pageOrganizerIsReady()) {
    return;
  }

  pushPageHistory();
  const nextPlan = [];
  const duplicatedIds = [];

  for (const item of pagePlan) {
    nextPlan.push(item);
    if (selectedIds.has(item.id)) {
      const duplicate = {
        ...item,
        id: makePageItemId("duplicate"),
        duplicatedFrom: item.id,
      };
      nextPlan.push(duplicate);
      duplicatedIds.push(duplicate.id);
    }
  }

  pagePlan = nextPlan;
  selectedPageIds.clear();
  duplicatedIds.forEach((id) => selectedPageIds.add(id));
  lastSelectedPageId = duplicatedIds.at(-1) ?? null;
  renderPagePlan();
  updatePageOrganizerSummary(
    `${duplicatedIds.length} ${duplicatedIds.length === 1 ? "página duplicada" : "páginas duplicadas"}.`
  );
  resetMergeProgress();
}

function deleteSelectedPages() {
  const selectedCount = selectedPageIds.size;
  if (selectedCount === 0 || !pageOrganizerIsReady()) {
    return;
  }

  if (selectedCount >= pagePlan.length) {
    setFeedback("El resultado debe conservar al menos una página.", "warning");
    return;
  }

  pushPageHistory();
  pagePlan = pagePlan.filter((item) => !selectedPageIds.has(item.id));
  clearPageSelection();
  renderPagePlan();
  updatePageOrganizerSummary(
    `${selectedCount} ${selectedCount === 1 ? "página eliminada" : "páginas eliminadas"} del resultado.`
  );
  resetMergeProgress();
}

function createBlankPageImageUrl() {
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 424;
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    return "";
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 3;
  context.setLineDash([10, 8]);
  context.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
  context.setLineDash([]);
  context.fillStyle = "#64748b";
  context.font = "600 18px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("Página en blanco", canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

function addBlankPage() {
  if (!pageOrganizerIsReady()) {
    return;
  }

  pushPageHistory();
  const selectedIndexes = pagePlan
    .map((item, index) => (selectedPageIds.has(item.id) ? index : -1))
    .filter((index) => index >= 0);
  const insertIndex = selectedIndexes.length > 0
    ? Math.max(...selectedIndexes) + 1
    : pagePlan.length;
  const blank = {
    id: makePageItemId("blank"),
    kind: "blank",
    fileKey: "",
    fileName: "Página en blanco",
    fileIndex: -1,
    pageIndex: -1,
    pageNumber: 0,
    imageUrl: createBlankPageImageUrl(),
    rotation: 0,
    blankWidth: 595.28,
    blankHeight: 841.89,
  };

  pagePlan.splice(insertIndex, 0, blank);
  selectedPageIds.clear();
  selectedPageIds.add(blank.id);
  lastSelectedPageId = blank.id;
  renderPagePlan();
  updatePageOrganizerSummary(`Página en blanco añadida en la posición ${insertIndex + 1}.`);
  resetMergeProgress();
}

function undoPageChange() {
  const snapshot = pageHistory.pop();
  if (!snapshot || !pageOrganizerIsReady()) {
    return;
  }

  pagePlan = clonePagePlan(snapshot);
  clearPageSelection();
  renderPagePlan();
  updatePageOrganizerSummary("Se ha deshecho el último cambio de páginas.");
  resetMergeProgress();
}

function openResultOptions() {
  if (!resultOptionsPanel || resultOptionsButton?.disabled) {
    return;
  }

  resultOptionsPanel.hidden = false;
  updatePageActionControls();
  resultOptionsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeResultOptions() {
  if (!resultOptionsPanel) {
    return;
  }

  resultOptionsPanel.hidden = true;
  updatePageActionControls();
  resultOptionsButton?.focus({ preventScroll: true });
}

function invalidatePageOrganizer() {
  pageOrganizerSignature = "";
  pageOrganizerInProgress = false;
  pagePlan = [];
  pageHistory.length = 0;
  clearPageSelection();
  cancelPageDrag();

  if (pageOrganizer) {
    pageOrganizer.hidden = true;
  }

  if (pagePreviewGroups) {
    pagePreviewGroups.replaceChildren();
  }

  if (pageOrganizerStatus) {
    pageOrganizerStatus.textContent =
      "Pulsa Organizar y editar páginas para generar las miniaturas.";
    pageOrganizerStatus.dataset.kind = "normal";
  }

  updatePageActionControls();
}

function updatePageOrganizerControls() {
  if (!organizePagesButton) {
    return;
  }

  const hasFiles = selectedFiles.length > 0;
  const isOpen = Boolean(pageOrganizer && !pageOrganizer.hidden);
  const hasPreparedPlan =
    pageOrganizerSignature === currentSelectionSignature() &&
    pagePlan.length > 0;

  organizePagesButton.disabled =
    mergeInProgress || pageOrganizerInProgress || !hasFiles;
  organizePagesButton.classList.toggle("is-active", isOpen);
  organizePagesButton.setAttribute("aria-pressed", String(isOpen));

  if (pageOrganizerInProgress) {
    organizePagesButton.textContent = "Generando miniaturas...";
  } else if (hasPreparedPlan) {
    organizePagesButton.textContent = `Organizar y editar páginas · ${pagePlan.length}`;
  } else {
    organizePagesButton.textContent = "Organizar y editar páginas";
  }

  updatePageActionControls();
}

function updatePageCardPositions() {
  pagePreviewGroups
    ?.querySelectorAll(".page-preview-card")
    .forEach((card, index) => {
      const position = card.querySelector(".page-result-position");
      if (position) {
        position.textContent = String(index + 1).padStart(2, "0");
      }
      card.dataset.resultIndex = String(index);
      card.setAttribute(
        "aria-label",
        `Página ${index + 1} del resultado. ${card.dataset.sourceName}, página ${card.dataset.sourcePage}.`
      );
    });
}

function updatePageOrganizerSummary(message = "") {
  if (!pageOrganizerStatus) {
    return;
  }

  const total = pagePlan.length;
  pageOrganizerStatus.textContent =
    message ||
    `${total} ${total === 1 ? "página preparada" : "páginas preparadas"} en el orden final. Arrastra cualquier miniatura para reorganizar el resultado.`;
  pageOrganizerStatus.dataset.kind = "success";
}

function createPagePreviewCard(pageItem) {
  const card = document.createElement("article");
  const isSelected = selectedPageIds.has(pageItem.id);
  const rotation = Number(pageItem.rotation) || 0;
  card.className = "page-preview-card";
  card.classList.toggle("is-selected", isSelected);
  card.classList.toggle("is-rotated-sideways", rotation % 180 !== 0);
  card.dataset.pageId = pageItem.id;
  card.dataset.sourceName = pageItem.fileName;
  card.dataset.sourcePage = String(pageItem.pageNumber || 0);
  card.dataset.rotation = String(rotation);
  card.dataset.kind = pageItem.kind || "source";
  card.tabIndex = 0;
  card.setAttribute("aria-selected", String(isSelected));

  const dragHandle = document.createElement("button");
  dragHandle.className = "page-drag-handle";
  dragHandle.type = "button";
  dragHandle.title = "Arrastrar esta página";
  dragHandle.setAttribute(
    "aria-label",
    pageItem.kind === "blank"
      ? "Arrastrar página en blanco"
      : `Arrastrar página ${pageItem.pageNumber} de ${pageItem.fileName}`
  );
  dragHandle.innerHTML = '<span aria-hidden="true">⋮⋮</span>';

  const resultBadge = document.createElement("span");
  resultBadge.className = "page-result-position";
  resultBadge.textContent = "00";
  resultBadge.setAttribute("aria-hidden", "true");

  const selectButton = document.createElement("button");
  selectButton.className = "page-select-button";
  selectButton.type = "button";
  selectButton.setAttribute("aria-pressed", String(isSelected));
  selectButton.setAttribute(
    "aria-label",
    `${isSelected ? "Deseleccionar" : "Seleccionar"} ${pageItem.kind === "blank" ? "página en blanco" : `página ${pageItem.pageNumber} de ${pageItem.fileName}`}`
  );
  selectButton.innerHTML = '<span aria-hidden="true">✓</span>';
  selectButton.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePageSelection(pageItem.id, true);
  });

  const topControls = document.createElement("div");
  topControls.className = "page-card-controls";

  const leftControls = document.createElement("div");
  leftControls.className = "page-card-left-controls";
  leftControls.append(dragHandle, selectButton);
  topControls.append(leftControls, resultBadge);

  const imageFrame = document.createElement("div");
  imageFrame.className = "page-preview-image-frame";

  const image = document.createElement("img");
  image.className = "page-preview-image";
  image.src = pageItem.imageUrl;
  image.alt =
    pageItem.kind === "blank"
      ? "Vista previa de una página en blanco"
      : `Página ${pageItem.pageNumber} de ${pageItem.fileName}`;
  image.loading = "lazy";
  image.style.setProperty("--page-rotation", `${rotation}deg`);
  imageFrame.append(image);

  const footer = document.createElement("div");
  footer.className = "page-preview-footer";

  const sourcePage = document.createElement("strong");
  sourcePage.textContent =
    pageItem.kind === "blank" ? "En blanco" : `Pág. ${pageItem.pageNumber}`;

  const source = document.createElement("span");
  source.textContent = pageItem.fileName;
  source.title = pageItem.fileName;

  const flags = document.createElement("span");
  flags.className = "page-preview-flags";
  const flagParts = [];
  if (pageItem.duplicatedFrom) {
    flagParts.push("Duplicada");
  }
  if (rotation !== 0) {
    flagParts.push(`${rotation}°`);
  }
  flags.textContent = flagParts.join(" · ");
  flags.hidden = flagParts.length === 0;

  footer.append(sourcePage, source, flags);
  card.append(topControls, imageFrame, footer);

  card.addEventListener("click", (event) => {
    if (event.target.closest("button")) {
      return;
    }
    togglePageSelection(pageItem.id, true);
  });

  card.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target === card) {
      event.preventDefault();
      togglePageSelection(pageItem.id, true);
    }
  });

  dragHandle.addEventListener("pointerdown", (event) =>
    beginPageDrag(event, pageItem.id, card, dragHandle)
  );

  dragHandle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" &&
        event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }

    event.preventDefault();
    const fromIndex = pagePlan.findIndex((item) => item.id === pageItem.id);
    const columns = estimatePageGridColumns();
    const delta =
      event.key === "ArrowLeft" ? -1 :
      event.key === "ArrowRight" ? 1 :
      event.key === "ArrowUp" ? -columns :
      columns;
    const toIndex = Math.max(0, Math.min(pagePlan.length - 1, fromIndex + delta));

    if (fromIndex === toIndex) {
      return;
    }

    pushPageHistory();
    const [moved] = pagePlan.splice(fromIndex, 1);
    pagePlan.splice(toIndex, 0, moved);
    renderPagePlan();
    const movedCard = pagePreviewGroups.querySelector(`[data-page-id="${CSS.escape(moved.id)}"]`);
    movedCard?.querySelector(".page-drag-handle")?.focus({ preventScroll: true });
    updatePageOrganizerSummary(
      `${moved.fileName} · ${moved.kind === "blank" ? "página en blanco" : `página ${moved.pageNumber}`} movida a la posición ${toIndex + 1}.`
    );
    resetMergeProgress();
  });

  return card;
}

function renderPagePlan() {
  if (!pagePreviewGroups) {
    return;
  }

  const validIds = new Set(pagePlan.map((item) => item.id));
  for (const selectedId of Array.from(selectedPageIds)) {
    if (!validIds.has(selectedId)) {
      selectedPageIds.delete(selectedId);
    }
  }

  const fragment = document.createDocumentFragment();
  for (const item of pagePlan) {
    fragment.append(createPagePreviewCard(item));
  }
  pagePreviewGroups.replaceChildren(fragment);
  updatePageCardPositions();
  updatePageActionControls();
  updateMergeControls();
}

function estimatePageGridColumns() {
  if (!pagePreviewGroups) {
    return 1;
  }

  const cards = Array.from(pagePreviewGroups.children);
  if (cards.length < 2) {
    return 1;
  }

  const firstTop = cards[0].getBoundingClientRect().top;
  const firstRow = cards.filter(
    (card) => Math.abs(card.getBoundingClientRect().top - firstTop) < 8
  );
  return Math.max(1, firstRow.length);
}

function createPageFloatingPreview(card) {
  const bounds = card.getBoundingClientRect();
  const preview = card.cloneNode(true);
  preview.classList.add("page-drag-preview");
  preview.classList.remove("is-page-placeholder");
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

function beginPageDrag(event, pageId, card, handle) {
  if (
    mergeInProgress ||
    pageOrganizerInProgress ||
    (event.pointerType === "mouse" && event.button !== 0)
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  handle.focus({ preventScroll: true });

  const index = pagePlan.findIndex((item) => item.id === pageId);
  if (index < 0) {
    return;
  }

  pageDragState = {
    pageId,
    pointerId: event.pointerId,
    sourceCard: card,
    handle,
    preview: null,
    startX: event.clientX,
    startY: event.clientY,
    currentIndex: index,
    initialIndex: index,
    initialPlan: clonePagePlan(),
    active: false,
  };

  window.addEventListener("pointermove", continuePageDrag, true);
  window.addEventListener("pointerup", endPageDrag, true);
  window.addEventListener("pointercancel", cancelPageDrag, true);
}

function activatePageDrag(event) {
  if (!pageDragState) {
    return;
  }

  pageDragState.active = true;
  pageDragState.preview = createPageFloatingPreview(pageDragState.sourceCard);
  pageDragState.sourceCard.classList.add("is-page-placeholder");
  document.body.classList.add("is-reordering-pages");
  positionPagePreview(event);
}

function positionPagePreview(event) {
  if (!pageDragState?.preview) {
    return;
  }

  const dx = event.clientX - pageDragState.startX;
  const dy = event.clientY - pageDragState.startY;
  pageDragState.preview.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
}

function findPageTargetIndex(clientX, clientY) {
  const cards = Array.from(pagePreviewGroups.children).filter(
    (card) => card !== pageDragState?.sourceCard
  );

  if (cards.length === 0) {
    return 0;
  }

  let nearestIndex = cards.length;
  let nearestDistance = Number.POSITIVE_INFINITY;

  cards.forEach((card, index) => {
    const bounds = card.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const distance = Math.hypot(clientX - centerX, clientY - centerY);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      const after =
        clientY > centerY + bounds.height * 0.12 ||
        (Math.abs(clientY - centerY) <= bounds.height * 0.12 && clientX > centerX);
      nearestIndex = index + (after ? 1 : 0);
    }
  });

  return Math.max(0, Math.min(cards.length, nearestIndex));
}

function animatePageGrid(previousRects) {
  Array.from(pagePreviewGroups.children).forEach((card) => {
    if (card === pageDragState?.sourceCard || !previousRects.has(card)) {
      return;
    }

    const before = previousRects.get(card);
    const after = card.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;

    if ((Math.abs(dx) < 1 && Math.abs(dy) < 1) || typeof card.animate !== "function") {
      return;
    }

    card.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0, 0)" },
      ],
      { duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  });
}

function reorderPageDuringDrag(targetIndex) {
  if (!pageDragState || targetIndex === pageDragState.currentIndex) {
    return;
  }

  const sourceCard = pageDragState.sourceCard;
  const previousRects = new Map(
    Array.from(pagePreviewGroups.children).map((card) => [
      card,
      card.getBoundingClientRect(),
    ])
  );
  const otherCards = Array.from(pagePreviewGroups.children).filter(
    (card) => card !== sourceCard
  );
  const reference = otherCards[targetIndex] ?? null;

  if (reference) {
    pagePreviewGroups.insertBefore(sourceCard, reference);
  } else {
    pagePreviewGroups.append(sourceCard);
  }

  const [moved] = pagePlan.splice(pageDragState.currentIndex, 1);
  pagePlan.splice(targetIndex, 0, moved);
  pageDragState.currentIndex = targetIndex;
  updatePageCardPositions();
  animatePageGrid(previousRects);
}

function updatePageAutoScroll(clientY) {
  if (pageDragAutoScrollFrame) {
    cancelAnimationFrame(pageDragAutoScrollFrame);
    pageDragAutoScrollFrame = null;
  }

  const edge = 90;
  const speed =
    clientY < edge ? -Math.ceil((edge - clientY) / 9) :
    clientY > window.innerHeight - edge
      ? Math.ceil((clientY - (window.innerHeight - edge)) / 9)
      : 0;

  if (speed === 0) {
    return;
  }

  const tick = () => {
    if (!pageDragState?.active) {
      pageDragAutoScrollFrame = null;
      return;
    }
    window.scrollBy(0, speed);
    pageDragAutoScrollFrame = requestAnimationFrame(tick);
  };
  pageDragAutoScrollFrame = requestAnimationFrame(tick);
}

function continuePageDrag(event) {
  if (!pageDragState || pageDragState.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();

  if (!pageDragState.active) {
    const distance = Math.hypot(
      event.clientX - pageDragState.startX,
      event.clientY - pageDragState.startY
    );
    if (distance < 5) {
      return;
    }
    activatePageDrag(event);
  }

  positionPagePreview(event);
  updatePageAutoScroll(event.clientY);
  reorderPageDuringDrag(findPageTargetIndex(event.clientX, event.clientY));
}

function finishPageDrag(cancelled = false) {
  if (!pageDragState) {
    return;
  }

  const state = pageDragState;
  const movedItem = pagePlan.find((item) => item.id === state.pageId);

  window.removeEventListener("pointermove", continuePageDrag, true);
  window.removeEventListener("pointerup", endPageDrag, true);
  window.removeEventListener("pointercancel", cancelPageDrag, true);
  if (pageDragAutoScrollFrame) {
    cancelAnimationFrame(pageDragAutoScrollFrame);
    pageDragAutoScrollFrame = null;
  }

  state.preview?.remove();
  state.sourceCard?.classList.remove("is-page-placeholder");
  document.body.classList.remove("is-reordering-pages");
  pageDragState = null;

  if (cancelled && state.active) {
    pagePlan = clonePagePlan(state.initialPlan);
    renderPagePlan();
    updatePageOrganizerSummary("Movimiento cancelado. Se ha restaurado el orden anterior.");
    return;
  }

  if (state.active) {
    const finalIndex = pagePlan.findIndex((item) => item.id === state.pageId);
    if (finalIndex !== state.initialIndex) {
      pushPageHistory(state.initialPlan);
      resetMergeProgress();
    }
    renderPagePlan();
    updatePageOrganizerSummary(
      movedItem && finalIndex !== state.initialIndex
        ? `${movedItem.fileName} · ${movedItem.kind === "blank" ? "página en blanco" : `página ${movedItem.pageNumber}`} movida a la posición ${finalIndex + 1}.`
        : "La página conserva la misma posición."
    );
    const card = pagePreviewGroups.querySelector(`[data-page-id="${CSS.escape(state.pageId)}"]`);
    card?.querySelector(".page-drag-handle")?.focus({ preventScroll: true });
  }
}

function endPageDrag(event) {
  if (!pageDragState || pageDragState.pointerId !== event.pointerId) {
    return;
  }
  event.preventDefault();
  finishPageDrag(false);
}

function cancelPageDrag(event) {
  if (event && pageDragState && pageDragState.pointerId !== event.pointerId) {
    return;
  }
  finishPageDrag(true);
}

async function appendPdfPagesToPlan(item, fileIndex) {
  const sourceBytes = new Uint8Array(await item.file.arrayBuffer());
  let loadingTask;

  try {
    loadingTask = pdfjsLib.getDocument({
      data: sourceBytes,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const pdfDocument = await loadingTask.promise;

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      pageOrganizerStatus.textContent =
        `Generando miniatura ${pageNumber} de ${pdfDocument.numPages} · ${item.file.name}`;

      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const targetWidth = 170;
      const scale = Math.min(1.45, Math.max(0.35, targetWidth / baseViewport.width));
      const viewport = page.getViewport({ scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 1.5);

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      const context = canvas.getContext("2d", { alpha: false });

      if (!context) {
        throw new Error("No se pudo crear el lienzo local para la miniatura.");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport,
        transform:
          outputScale === 1
            ? null
            : [outputScale, 0, 0, outputScale, 0, 0],
      }).promise;

      pagePlan.push({
        id: `${item.key}\u001e${pageNumber}`,
        kind: "source",
        fileKey: item.key,
        fileName: item.file.name,
        fileIndex,
        pageIndex: pageNumber - 1,
        pageNumber,
        imageUrl: canvas.toDataURL("image/jpeg", 0.82),
        rotation: 0,
      });

      page.cleanup();
      await nextPaint();
    }

    await pdfDocument.destroy();
  } catch (error) {
    loadingTask?.destroy?.();
    throw describePdfLoadError(error, item.file.name);
  }
}

async function openPageOrganizer() {
  if (
    pageOrganizerInProgress ||
    mergeInProgress ||
    selectedFiles.length === 0
  ) {
    return;
  }

  const signature = currentSelectionSignature();

  if (
    pageOrganizerSignature === signature &&
    pagePlan.length > 0 &&
    pagePreviewGroups.childElementCount > 0
  ) {
    pageOrganizer.hidden = false;
    updatePageOrganizerControls();
    pageOrganizer.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  pageOrganizerInProgress = true;
  updatePageOrganizerControls();
  pageOrganizer.hidden = false;
  pagePreviewGroups.replaceChildren();
  pagePlan = [];
  pageHistory.length = 0;
  clearPageSelection();
  pageOrganizerStatus.dataset.kind = "working";
  pageOrganizerStatus.textContent =
    "Preparando las miniaturas dentro de este equipo...";

  try {
    for (const [fileIndex, item] of selectedFiles.entries()) {
      pageOrganizerStatus.textContent =
        `Leyendo PDF ${fileIndex + 1} de ${selectedFiles.length} · ${item.file.name}`;
      await appendPdfPagesToPlan(item, fileIndex);
    }

    pageOrganizerSignature = signature;
    renderPagePlan();
    updatePageOrganizerSummary();
    setStatus("Organizador visual preparado localmente.");
    setFeedback(
      "Ya puedes organizar y editar las miniaturas. El orden visual se utilizará al unir y guardar.",
      "success"
    );
    pageOrganizer.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    pageOrganizerSignature = "";
    pagePlan = [];
    pagePreviewGroups.replaceChildren();
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron generar las miniaturas.";
    pageOrganizerStatus.textContent = message;
    pageOrganizerStatus.dataset.kind = "error";
    setStatus(message, "error");
    setFeedback(message, "error");
  } finally {
    pageOrganizerInProgress = false;
    updatePageOrganizerControls();
  }
}

function closePageOrganizer() {
  if (!pageOrganizer || pageOrganizerInProgress) {
    return;
  }

  pageOrganizer.hidden = true;
  updatePageOrganizerControls();
  organizePagesButton?.focus({ preventScroll: true });
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
  const visualOrderIsReady =
    pageOrganizerSignature === currentSelectionSignature() && pagePlan.length > 0;

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
  } else if (visualOrderIsReady) {
    const changes = [];
    const rotated = pagePlan.filter((item) => (Number(item.rotation) || 0) !== 0).length;
    const duplicates = pagePlan.filter((item) => item.duplicatedFrom).length;
    const blanks = pagePlan.filter((item) => item.kind === "blank").length;
    if (rotated > 0) changes.push(`${rotated} giradas`);
    if (duplicates > 0) changes.push(`${duplicates} duplicadas`);
    if (blanks > 0) changes.push(`${blanks} en blanco`);
    if (resultOptions.pageNumbers) changes.push("numeración activa");
    mergeRequirement.textContent =
      `${pagePlan.length} páginas en el orden visual${changes.length ? ` · ${changes.join(" · ")}` : ""}.`;
    mergeRequirement.dataset.kind = "ready";
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
    const { PDFDocument, StandardFonts, degrees, rgb } = window.PDFLib;
    const outputPdf = await PDFDocument.create();
    let totalPages = 0;
    const visualOrderIsReady =
      pageOrganizerSignature === currentSelectionSignature() &&
      pagePlan.length > 0;

    if (visualOrderIsReady) {
      const loadedSources = new Map();

      for (const [index, pageItem] of pagePlan.entries()) {
        const rotation = Number(pageItem.rotation) || 0;

        if (pageItem.kind === "blank") {
          const blankPage = outputPdf.addPage([
            Number(pageItem.blankWidth) || 595.28,
            Number(pageItem.blankHeight) || 841.89,
          ]);
          if (rotation !== 0) {
            blankPage.setRotation(degrees(rotation));
          }
          totalPages += 1;
          setMergeProgress(
            8 + ((index + 1) / pagePlan.length) * 68,
            `Página ${index + 1} de ${pagePlan.length} incorporada`,
            "Página en blanco"
          );
          await nextPaint();
          continue;
        }

        const sourceItem = selectedFiles.find(
          (item) => item.key === pageItem.fileKey
        );

        if (!sourceItem) {
          throw new Error(
            "El orden visual ya no coincide con los archivos seleccionados. Vuelve a abrir Organizar páginas."
          );
        }

        let sourcePdf = loadedSources.get(pageItem.fileKey);

        if (!sourcePdf) {
          setMergeProgress(
            8 + (index / pagePlan.length) * 68,
            "Leyendo documentos del orden visual",
            sourceItem.file.name
          );
          const sourceBytes = await sourceItem.file.arrayBuffer();

          try {
            sourcePdf = await PDFDocument.load(sourceBytes, {
              ignoreEncryption: false,
            });
          } catch (error) {
            throw describePdfLoadError(error, sourceItem.file.name);
          }

          loadedSources.set(pageItem.fileKey, sourcePdf);
        }

        if (pageItem.pageIndex < 0 || pageItem.pageIndex >= sourcePdf.getPageCount()) {
          throw new Error(
            `No se encontró la página ${pageItem.pageNumber} de ${pageItem.fileName}.`
          );
        }

        const [copiedPage] = await outputPdf.copyPages(sourcePdf, [
          pageItem.pageIndex,
        ]);
        if (rotation !== 0) {
          const originalRotation = Number(copiedPage.getRotation()?.angle) || 0;
          copiedPage.setRotation(degrees((originalRotation + rotation + 360) % 360));
        }
        outputPdf.addPage(copiedPage);
        totalPages += 1;

        setMergeProgress(
          8 + ((index + 1) / pagePlan.length) * 68,
          `Página ${index + 1} de ${pagePlan.length} incorporada`,
          `${pageItem.fileName} · página original ${pageItem.pageNumber}${rotation ? ` · giro ${rotation}°` : ""}`
        );
        await nextPaint();
      }
    } else {
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
    }

    if (totalPages === 0) {
      throw new Error("Los documentos seleccionados no contienen páginas para unir.");
    }

    if (resultOptions.cleanMetadata) {
      const internalTitle = resultOptions.titleFromName
        ? outputTarget.name.replace(/\.pdf$/i, "")
        : "";
      outputPdf.setTitle(internalTitle);
      outputPdf.setAuthor("");
      outputPdf.setSubject("");
      outputPdf.setKeywords([]);
      outputPdf.setCreator("PDFPrivado Pro");
      outputPdf.setProducer("PDFPrivado Pro");
    } else {
      outputPdf.setCreator("PDFPrivado Pro");
      outputPdf.setProducer("PDFPrivado Pro");
    }

    if (resultOptions.pageNumbers) {
      const pageNumberFont = await outputPdf.embedFont(StandardFonts.Helvetica);
      const pages = outputPdf.getPages();
      for (const [index, page] of pages.entries()) {
        const label = String(index + 1);
        const fontSize = 9;
        const textWidth = pageNumberFont.widthOfTextAtSize(label, fontSize);
        const { width } = page.getSize();
        page.drawText(label, {
          x: Math.max(18, (width - textWidth) / 2),
          y: 14,
          size: fontSize,
          font: pageNumberFont,
          color: rgb(0.38, 0.43, 0.5),
          opacity: 0.86,
        });
      }
    }

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


window.addEventListener("pdfprivado:open-merge-file", (event) => {
  const file = event.detail?.file;
  if (!(file instanceof File)) return;

  const key = fileKey(file);
  const existingIndex = selectedFiles.findIndex((item) => item.key === key);
  if (existingIndex >= 0) selectedFiles.splice(existingIndex, 1);
  selectedFiles.unshift({ key, file });
  invalidatePageOrganizer();
  resetMergeProgress();
  renderFiles();

  showMergeView();
  setStatus(`${file.name} preparado como primer documento.`);
  setFeedback(`${file.name} se ha añadido desde el lector como primer documento preparado.`, "success");
});

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
  if (resultOptionsPanel) {
    resultOptionsPanel.hidden = true;
  }
  invalidatePageOrganizer();
  resetMergeProgress();
  renderFiles();
  setStatus("Lista temporal vaciada.");
  setFeedback("La lista temporal se ha vaciado.", "info");
});

outputNameInput?.addEventListener("blur", () => {
  outputNameInput.value = normalizeOutputName(outputNameInput.value);
});

mergeButton?.addEventListener("click", mergeAndSavePdfs);
organizePagesButton?.addEventListener("click", openPageOrganizer);
closePageOrganizerButton?.addEventListener("click", closePageOrganizer);
selectAllPagesButton?.addEventListener("click", toggleAllPages);
rotateLeftButton?.addEventListener("click", () => rotateSelectedPages(-90));
rotateRightButton?.addEventListener("click", () => rotateSelectedPages(90));
duplicatePagesButton?.addEventListener("click", duplicateSelectedPages);
addBlankPageButton?.addEventListener("click", addBlankPage);
deletePagesButton?.addEventListener("click", deleteSelectedPages);
undoPageChangeButton?.addEventListener("click", undoPageChange);
resultOptionsButton?.addEventListener("click", () => {
  if (resultOptionsPanel?.hidden) {
    openResultOptions();
  } else {
    closeResultOptions();
  }
});
closeResultOptionsButton?.addEventListener("click", closeResultOptions);
cleanMetadataOption?.addEventListener("change", () => {
  resultOptions.cleanMetadata = cleanMetadataOption.checked;
  updatePageActionControls();
  updateMergeControls();
  resetMergeProgress();
});
titleFromNameOption?.addEventListener("change", () => {
  resultOptions.titleFromName = titleFromNameOption.checked;
  updateMergeControls();
  resetMergeProgress();
});
pageNumbersOption?.addEventListener("change", () => {
  resultOptions.pageNumbers = pageNumbersOption.checked;
  updateMergeControls();
  resetMergeProgress();
});

renderFiles();
