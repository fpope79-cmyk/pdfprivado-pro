const year = document.querySelector("#current-year");
const selectButton = document.querySelector("#select-pdf-button");
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

if (year) {
  year.textContent = String(new Date().getFullYear());
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

function renderFiles() {
  fileList.replaceChildren();

  for (const [index, item] of selectedFiles.entries()) {
    const row = document.createElement("li");
    row.className = "file-item";

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

    row.append(position, details, removeButton);
    fileList.append(row);
  }

  const count = selectedFiles.length;
  emptyState.hidden = count > 0;
  addMoreButton.hidden = count === 0;
  clearButton.disabled = count === 0;
  selectButton.textContent =
    count === 0 ? "Abrir archivos PDF" : "Añadir más archivos PDF";
  summary.textContent =
    `${count} ${count === 1 ? "archivo" : "archivos"} · ${formatBytes(totalBytes())}`;
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

selectButton?.addEventListener("click", openFileSelector);
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
