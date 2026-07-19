/* PDFPRIVADO_METADATA_BATCH_LOADER_V1 */
(() => {
  const status = document.querySelector("#metadata-batch-status");
  const addButton = document.querySelector("#metadata-batch-add");
  const processButton = document.querySelector("#metadata-batch-process");

  function show(message, kind = "info") {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = false;
  }

  if (!status || !addButton || !processButton) {
    console.error("Metadatos por lotes: faltan elementos de interfaz.");
    return;
  }

  show("Inicializando el procesamiento por lotes…", "info");

  import("./metadata-batch.js")
    .then(() => {
      window.PDFPrivadoMetadataBatchReady = true;
      show("Procesamiento por lotes preparado. Pulsa «Añadir PDF».", "success");
    })
    .catch((error) => {
      window.PDFPrivadoMetadataBatchReady = false;
      console.error("No se pudo iniciar Metadatos por lotes:", error);
      show(`No se pudo iniciar el lote: ${error?.message || String(error)}`, "error");
      addButton.disabled = true;
      processButton.disabled = true;
    });
})();
