(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const dialog = $("#protection-dialog");
  if (!dialog) return;

  const els = {
    openButtons: $$('[data-open-tool="protection"]'),
    closeButtons: $$("[data-protection-close]"),
    modeProtect: $("#protection-modal-mode-protect"),
    modeUnlock: $("#protection-modal-mode-unlock"),
    protectFields: $("#protection-modal-protect-fields"),
    unlockFields: $("#protection-modal-unlock-fields"),
    password: $("#protection-modal-password"),
    confirm: $("#protection-modal-password-confirm"),
    knownPassword: $("#protection-modal-known-password"),
    strength: $("#protection-modal-strength"),
    documentName: $("#protection-modal-document-name"),
    documentMeta: $("#protection-modal-document-meta"),
    changesNote: $("#protection-modal-changes-note"),
    actionButton: $("#protection-modal-action"),
    status: $("#protection-modal-status"),
    progress: $("#protection-modal-progress"),
    customOwnerEnabled: $("#protection-modal-custom-owner-enabled"),
    ownerFields: $("#protection-modal-owner-fields"),
    ownerPassword: $("#protection-modal-owner-password"),
    ownerConfirm: $("#protection-modal-owner-confirm"),
    printPermission: $("#protection-modal-print-permission"),
    allowCopy: $("#protection-modal-allow-copy"),
    allowAnnotate: $("#protection-modal-allow-annotate"),
    allowForm: $("#protection-modal-allow-form"),
    allowAssemble: $("#protection-modal-allow-assemble"),
    allowModify: $("#protection-modal-allow-modify"),
    permissionSummary: $("#protection-modal-permission-summary"),
    levelQuick: $("#protection-modal-level-quick"),
    levelAdvanced: $("#protection-modal-level-advanced"),
    premiumPanel: document.querySelector(".protection-premium-panel"),
    profile: $("#protection-modal-profile"),
    generatePassword: $("#protection-modal-generate-password"),
    copyPassword: $("#protection-modal-copy-password"),
    generatorNote: $("#protection-modal-generator-note"),
    permissionsWarning: $("#protection-modal-permissions-warning"),
    operationSummary: $("#protection-modal-operation-summary"),
    operationSummaryTitle: $("#protection-modal-operation-summary-title"),
    operationSummarySubtitle: $("#protection-modal-operation-summary-subtitle"),
    operationBadge: $("#protection-modal-operation-badge"),
    summaryOperation: $("#protection-modal-summary-operation"),
    summaryProfile: $("#protection-modal-summary-profile"),
    summaryOwner: $("#protection-modal-summary-owner"),
    summaryPermissions: $("#protection-modal-summary-permissions"),
  };

  const state = {
    mode: "protect",
    worker: null,
    workerReady: null,
    pendingRequests: new Map(),
    requestSequence: 0,
    pendingOpenAfterFile: false,
    busy: false,
    lastTrigger: null,
    currentDocumentInfo: null,
  };

  function setStatus(message = "", kind = "neutral") {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.dataset.kind = kind;
    els.status.hidden = !message;
  }

  /* PDFPRIVADO_PROTECTION_FOCUS_INVALID_FIELD_V1 */
  function focusInvalidField(input) {
    if (!input) return;

    input.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    window.setTimeout(() => {
      input.focus({ preventScroll: true });
      input.select?.();
    }, 220);
  }
  function setBusy(busy, message = "") {
    state.busy = Boolean(busy);
    if (els.actionButton) els.actionButton.disabled = state.busy;
    if (els.progress) {
      els.progress.hidden = !state.busy;
      els.progress.value = state.busy ? 35 : 0;
    }
    if (message) setStatus(message, "info");
  }

  function utf8Length(value) {
    return new TextEncoder().encode(String(value || "")).length;
  }

  function passwordStrength(value) {
    if (!value) return "—";
    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    if (score <= 2) return "Débil";
    if (score <= 4) return "Razonable";
    return "Fuerte";
  }

  function resetPasswords() {
    [els.password, els.confirm, els.knownPassword, els.ownerPassword, els.ownerConfirm].forEach((input) => {
      if (!input) return;
      input.value = "";
      input.type = "password";
    });
    els.levelQuick?.addEventListener("click", () => {
    applyProtectionProfile("password");
  });

  els.levelAdvanced?.addEventListener("click", () => {
    setProtectionLevel("advanced");
    if (els.profile?.value === "password") {
      applyProtectionProfile("custom");
    }
  });

  els.profile?.addEventListener("change", () => {
    applyProtectionProfile(els.profile.value);
  });

  els.generatePassword?.addEventListener("click", () => {
    const generated = randomSecurePassword();

    if (els.password) {
      els.password.value = generated;
      els.password.type = "text";
    }

    if (els.confirm) {
      els.confirm.value = generated;
      els.confirm.type = "text";
    }

    if (els.strength) els.strength.textContent = passwordStrength(generated);
    if (els.copyPassword) els.copyPassword.disabled = false;
    if (els.generatorNote) els.generatorNote.hidden = false;

    [
      "protection-modal-password",
      "protection-modal-password-confirm",
    ].forEach((id) => {
      const button = document.querySelector(
        `[data-protection-password-toggle="${id}"]`
      );
      if (!button) return;
      button.textContent = "Ocultar";
      button.setAttribute("aria-pressed", "true");
    });

    setStatus("Contraseña segura generada y confirmada automáticamente.", "success");
  });

  els.copyPassword?.addEventListener("click", () => {
    void copyOpeningPassword();
  });

  $$("[data-protection-password-toggle]").forEach((button) => {
      button.textContent = "Mostrar";
      button.setAttribute("aria-pressed", "false");
    });
    if (els.strength) els.strength.textContent = "—";
    if (els.copyPassword) els.copyPassword.disabled = true;
    if (els.generatorNote) els.generatorNote.hidden = true;
  }

  function randomSecurePassword(length = 20) {
    const alphabet =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_=?.";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);

    const password = Array.from(
      bytes,
      (byte) => alphabet[byte % alphabet.length]
    ).join("");

    const requiredGroups = [
      "ABCDEFGHJKLMNPQRSTUVWXYZ",
      "abcdefghijkmnopqrstuvwxyz",
      "23456789",
      "!@#$%&*+-_=?.",
    ];

    return requiredGroups.reduce((value, group, index) => {
      if ([...value].some((character) => group.includes(character))) {
        return value;
      }

      const replacement = group[bytes[index] % group.length];
      return `${value.slice(0, index)}${replacement}${value.slice(index + 1)}`;
    }, password);
  }

  async function copyOpeningPassword() {
    const value = els.password?.value || "";

    if (!value) {
      setStatus("Primero genera o escribe una contraseña de apertura.", "warning");
      focusInvalidField(els.password);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setStatus("Contraseña copiada al portapapeles.", "success");
    } catch {
      els.password?.select?.();
      document.execCommand?.("copy");
      setStatus("Contraseña seleccionada para copiar.", "info");
    }
  }

  function setProtectionLevel(level) {
    const advanced = level === "advanced";

    els.levelQuick?.classList.toggle("is-active", !advanced);
    els.levelAdvanced?.classList.toggle("is-active", advanced);
    els.levelQuick?.setAttribute("aria-pressed", advanced ? "false" : "true");
    els.levelAdvanced?.setAttribute("aria-pressed", advanced ? "true" : "false");

    if (els.premiumPanel) {
      els.premiumPanel.hidden = !advanced;
      if (advanced) els.premiumPanel.open = true;
    }

    if (els.permissionsWarning) {
      els.permissionsWarning.hidden = !advanced;
    }
    updateOperationSummary();
  }

  function applyProtectionProfile(profile) {
    const selected = ["password", "print", "readonly", "maximum", "custom"].includes(profile)
      ? profile
      : "password";

    if (els.profile) els.profile.value = selected;

    if (selected === "custom") {
      setProtectionLevel("advanced");
      updatePermissionSummary();
      return;
    }

    const presets = {
      password: {
        print: "full",
        copy: true,
        annotate: true,
        form: true,
        assemble: true,
        modify: true,
      },
      print: {
        print: "full",
        copy: false,
        annotate: false,
        form: false,
        assemble: false,
        modify: false,
      },
      readonly: {
        print: "none",
        copy: true,
        annotate: false,
        form: false,
        assemble: false,
        modify: false,
      },
      maximum: {
        print: "none",
        copy: false,
        annotate: false,
        form: false,
        assemble: false,
        modify: false,
      },
    };

    const preset = presets[selected];

    if (els.printPermission) els.printPermission.value = preset.print;
    if (els.allowCopy) els.allowCopy.checked = preset.copy;
    if (els.allowAnnotate) els.allowAnnotate.checked = preset.annotate;
    if (els.allowForm) els.allowForm.checked = preset.form;
    if (els.allowAssemble) els.allowAssemble.checked = preset.assemble;
    if (els.allowModify) els.allowModify.checked = preset.modify;

    setProtectionLevel(selected === "password" ? "quick" : "advanced");
    updatePermissionSummary();
  }

  function markProfileCustom() {
    if (els.profile) els.profile.value = "custom";
  }

  function profileLabel() {
    const labels = {
      password: "Solo contraseña",
      print: "Lectura e impresión",
      readonly: "Solo lectura",
      maximum: "Máxima restricción",
      custom: "Personalizado",
    };
    return labels[els.profile?.value] || "Personalizado";
  }

  function permissionSummaryText() {
    const permissions = permissionOptions();
    const parts = [];

    if (permissions.print === "none") parts.push("impresión bloqueada");
    else if (permissions.print === "low") parts.push("impresión en baja resolución");

    if (!permissions.extract) parts.push("copia bloqueada");
    if (!permissions.annotate) parts.push("anotaciones bloqueadas");
    if (!permissions.form) parts.push("formularios bloqueados");
    if (!permissions.assemble) parts.push("organización bloqueada");
    if (!permissions.modifyOther) parts.push("edición bloqueada");

    return parts.length ? parts.join(" · ") : "Sin restricciones adicionales";
  }

  function resetOperationSummary() {
    els.operationSummary?.classList.remove("is-success");
    if (els.operationSummaryTitle) els.operationSummaryTitle.textContent = "Resumen antes de guardar";
    if (els.operationSummarySubtitle) {
      els.operationSummarySubtitle.textContent =
        "Se creará una copia nueva y el original permanecerá intacto.";
    }
    if (els.operationBadge) els.operationBadge.textContent = state.mode === "unlock" ? "Copia nueva" : "AES-256";
  }

  function updateOperationSummary() {
    if (!els.operationSummary) return;

    resetOperationSummary();
    const unlocking = state.mode === "unlock";
    els.operationSummary.hidden = false;

    if (els.summaryOperation) {
      els.summaryOperation.textContent = unlocking ? "Quitar protección" : "Proteger PDF";
    }
    if (els.summaryProfile) {
      els.summaryProfile.textContent = unlocking ? "Contraseña conocida" : profileLabel();
    }
    if (els.summaryOwner) {
      els.summaryOwner.textContent = unlocking
        ? "No se aplica"
        : els.customOwnerEnabled?.checked
          ? "Contraseña personalizada"
          : "Clave interna segura";
    }
    if (els.summaryPermissions) {
      els.summaryPermissions.textContent = unlocking
        ? "Se eliminará el cifrado y sus restricciones"
        : permissionSummaryText();
    }
  }

  function showSavedSummary(savedPath, byteLength) {
    if (!els.operationSummary) return;
    els.operationSummary.hidden = false;
    els.operationSummary.classList.add("is-success");

    if (els.operationSummaryTitle) {
      els.operationSummaryTitle.textContent =
        state.mode === "protect" ? "Copia protegida guardada" : "Copia sin protección guardada";
    }
    if (els.operationSummarySubtitle) {
      els.operationSummarySubtitle.textContent = savedPath
        ? savedPath
        : "El archivo se ha guardado en la ubicación de descargas elegida por el sistema.";
    }
    if (els.operationBadge) els.operationBadge.textContent = "Completado";
    if (els.summaryOperation) els.summaryOperation.textContent = "Finalizada correctamente";
    if (els.summaryProfile) {
      els.summaryProfile.textContent = state.mode === "protect" ? profileLabel() : "Sin protección";
    }
    if (els.summaryOwner) {
      els.summaryOwner.textContent = state.mode === "protect"
        ? (els.customOwnerEnabled?.checked ? "Personalizada" : "Interna segura")
        : "No se aplica";
    }
    if (els.summaryPermissions) {
      const size = Number.isFinite(byteLength)
        ? `${Math.max(1, Math.round(byteLength / 1024)).toLocaleString("es-ES")} KB`
        : "Copia creada";
      els.summaryPermissions.textContent = size;
    }
  }

  function permissionOptions() {
    return {
      print: ["full", "low", "none"].includes(els.printPermission?.value)
        ? els.printPermission.value
        : "full",
      extract: Boolean(els.allowCopy?.checked),
      annotate: Boolean(els.allowAnnotate?.checked),
      form: Boolean(els.allowForm?.checked),
      assemble: Boolean(els.allowAssemble?.checked),
      modifyOther: Boolean(els.allowModify?.checked),
    };
  }

  function updateOwnerFields() {
    if (!els.ownerFields) return;
    els.ownerFields.hidden = !els.customOwnerEnabled?.checked;
  }

  function updatePermissionSummary() {
    if (!els.permissionSummary) return;
    const permissions = permissionOptions();
    const printing =
      permissions.print === "none"
        ? "impresión bloqueada"
        : permissions.print === "low"
          ? "impresión en baja resolución"
          : "impresión completa";

    const restricted = [
      !permissions.extract ? "copia bloqueada" : "",
      !permissions.annotate ? "anotaciones bloqueadas" : "",
      !permissions.form ? "formularios bloqueados" : "",
      !permissions.assemble ? "organización de páginas bloqueada" : "",
      !permissions.modifyOther ? "otras modificaciones bloqueadas" : "",
    ].filter(Boolean);

    const summary = els.permissionSummary.querySelector("span");
    if (summary) {
      summary.textContent = [printing, ...(restricted.length ? restricted : ["edición permitida"])]
        .join(" · ");
    }
    updateOperationSummary();
  }

  function resetPremiumOptions() {
    if (els.customOwnerEnabled) els.customOwnerEnabled.checked = false;
    if (els.printPermission) els.printPermission.value = "full";
    [els.allowCopy, els.allowAnnotate, els.allowForm, els.allowAssemble, els.allowModify]
      .forEach((input) => {
        if (input) input.checked = true;
      });
    updateOwnerFields();
    applyProtectionProfile("password");
    setProtectionLevel("quick");
    updatePermissionSummary();
  }
  function changeMode(mode) {
    state.mode = mode === "unlock" ? "unlock" : "protect";
    resetPasswords();
    setStatus("");

    els.modeProtect?.classList.toggle("is-active", state.mode === "protect");
    els.modeUnlock?.classList.toggle("is-active", state.mode === "unlock");
    els.modeProtect?.setAttribute("aria-pressed", state.mode === "protect" ? "true" : "false");
    els.modeUnlock?.setAttribute("aria-pressed", state.mode === "unlock" ? "true" : "false");

    if (els.protectFields) els.protectFields.hidden = state.mode !== "protect";
    if (els.unlockFields) els.unlockFields.hidden = state.mode !== "unlock";
    if (els.actionButton) {
      els.actionButton.textContent =
        state.mode === "protect"
          ? "Guardar copia protegida"
          : "Guardar copia sin protección";
    }
    updateOperationSummary();
  }
  async function waitForViewerBridge(timeoutMs = 5000) {
    const startedAt = Date.now();

    while (!window.PDFPrivadoProtectionBridge) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error("El visor no ha terminado de preparar Protección.");
      }

      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }

    return window.PDFPrivadoProtectionBridge;
  }

  async function requestViewerDocumentInfo() {
    const bridge = await waitForViewerBridge();
    return bridge.getCurrentDocumentInfo();
  }

  async function requestViewerDocumentBytes() {
    const bridge = await waitForViewerBridge();
    return bridge.buildCurrentDocumentBytes();
  }

  async function requestOpenViewerFile() {
    const bridge = await waitForViewerBridge();
    return bridge.openFileSelector();
  }
function ensureWorker() {
    if (state.workerReady) return state.workerReady;

    state.workerReady = new Promise((resolve, reject) => {
      try {
        state.worker = new Worker("./qpdf-protection-worker.js");
      } catch (error) {
        reject(error);
        return;
      }

      const timeout = window.setTimeout(() => reject(new Error("workerTimeout")), 30000);

      state.worker.addEventListener("message", (event) => {
        const message = event.data || {};
        if (message.type === "ready") {
          window.clearTimeout(timeout);
          resolve();
          return;
        }
        if (message.type === "init-error") {
          window.clearTimeout(timeout);
          reject(new Error("workerMissing"));
          return;
        }
        if (!message.requestId) return;
        const pending = state.pendingRequests.get(message.requestId);
        if (!pending) return;
        state.pendingRequests.delete(message.requestId);
        if (message.type === "result") pending.resolve(message);
        else pending.reject(Object.assign(new Error(message.code || "incompatible"), message));
      });

      state.worker.addEventListener("error", (event) => {
        window.clearTimeout(timeout);
        reject(event.error || new Error("workerMissing"));
      });

      state.worker.postMessage({ type: "init" });
    }).catch((error) => {
      state.worker?.terminate();
      state.worker = null;
      state.workerReady = null;
      throw error;
    });

    return state.workerReady;
  }

  async function processWithWorker(operation, bytes, password, options = {}) {
    await ensureWorker();
    const requestId = `protection-${Date.now()}-${++state.requestSequence}`;
    const transferable = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    );

    return new Promise((resolve, reject) => {
      state.pendingRequests.set(requestId, { resolve, reject });
      state.worker.postMessage(
        {
          type: "process",
          requestId,
          operation,
          password,
          ownerPassword: String(options.ownerPassword || ""),
          permissions: options.permissions || null,

          buffer: transferable,
        },
        [transferable]
      );
    });
  }

  function errorMessage(error) {
    switch (error?.code) {
      case "wrongPassword":
        return "La contraseña conocida no es correcta.";
      case "notEncrypted":
        return "El documento actual no está protegido con contraseña.";
      case "alreadyEncrypted":
        return "El documento ya está cifrado. Utiliza Quitar protección.";
      default:
        return "No se pudo procesar este tipo de cifrado o la estructura del PDF.";
    }
  }

  function suggestedOutputName(inputName, operation) {
    const base = String(inputName || "documento.pdf")
      .replace(/\.pdf$/i, "")
      .replace(/[\\/:*?"<>|]+/g, "_");
    return operation === "protect"
      ? `PDFPrivado_protegido_${base}.pdf`
      : `PDFPrivado_sin_contrasena_${base}.pdf`;
  }

  async function chooseSaveTarget(suggestedName) {
    const tauriDialog = window.__TAURI__?.dialog;
    const tauriFs = window.__TAURI__?.fs;

    if (typeof tauriDialog?.save === "function" && typeof tauriFs?.writeFile === "function") {
      const selected = await tauriDialog.save({
        defaultPath: suggestedName,
        title: "Guardar una copia nueva del PDF",
        filters: [{ name: "Documento PDF", extensions: ["pdf"] }],
      });
      if (!selected) return null;
      return { kind: "tauri", path: String(selected), fs: tauriFs };
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
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = target.name;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return "";
  }

  async function openDialog(trigger = null, preferredMode = null) {
    if (state.busy || dialog.open) return;
    state.lastTrigger = trigger || document.activeElement;

    let documentInfo;
    try {
      documentInfo = await requestViewerDocumentInfo();
    } catch (error) {
      setStatus(`No se pudo consultar el documento actual: ${error?.message || error}.`, "error");
      return;
    }

    if (!documentInfo?.hasDocument) {
      state.pendingOpenAfterFile = true;
      await requestOpenViewerFile();
      return;
    }

    state.currentDocumentInfo = documentInfo;
    if (els.documentName) els.documentName.textContent = documentInfo.name;
    if (els.documentMeta) {
      const parts = [
        documentInfo.pages ? `${documentInfo.pages} ${documentInfo.pages === 1 ? "página" : "páginas"}` : "PDF cifrado",
        documentInfo.sizeLabel,
      ].filter(Boolean);
      els.documentMeta.textContent = parts.join(" · ");
    }

    if (els.changesNote) {
      els.changesNote.hidden = !documentInfo.changed;
      els.changesNote.textContent = documentInfo.changed
        ? "Se protegerá la versión actual, incluidos los cambios todavía no guardados."
        : "Se creará una copia nueva. El documento abierto permanecerá intacto.";
    }

    resetPasswords();
    changeMode(preferredMode || (documentInfo.encryptedSource ? "unlock" : "protect"));
    updateOperationSummary();
    setStatus("");

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");

    requestAnimationFrame(() => els.password?.focus({ preventScroll: true }));
  }

  function closeDialog() {
    if (state.busy) return;
    resetPasswords();
    setStatus("");
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    state.lastTrigger?.focus?.({ preventScroll: true });
  }

  async function performAction() {
    if (state.busy) return;

    let password = "";
    if (state.mode === "protect") {
      password = els.password?.value || "";
      const confirmation = els.confirm?.value || "";
      if (!password) {
        setStatus(
          "Falta la contraseña de apertura. Escríbela en el primer campo del formulario.",
          "warning"
        );
        focusInvalidField(els.password);
        return;
      }
      if (password !== confirmation) {
        setStatus("Las contraseñas de apertura no coinciden.", "warning");
        focusInvalidField(els.confirm);
        return;
      }
    } else {
      password = els.knownPassword?.value || "";
    }

    if (utf8Length(password) > 127) {
      setStatus("La contraseña supera el máximo técnico de 127 bytes UTF-8.", "warning");
      return;
    }
    let ownerPassword = "";
    const permissions = permissionOptions();

    if (state.mode === "protect" && els.customOwnerEnabled?.checked) {
      ownerPassword = els.ownerPassword?.value || "";
      const ownerConfirmation = els.ownerConfirm?.value || "";

      if (!ownerPassword) {
        setStatus(
          "Falta la contraseña de propietario. Escríbela o desactiva la opción personalizada.",
          "warning"
        );
        focusInvalidField(els.ownerPassword);
        return;
      }

      if (ownerPassword !== ownerConfirmation) {
        setStatus("Las contraseñas de propietario no coinciden.", "warning");
        focusInvalidField(els.ownerConfirm);
        return;
      }

      if (ownerPassword === password) {
        setStatus(
          "La contraseña de propietario debe ser distinta de la contraseña de apertura.",
          "warning"
        );
        focusInvalidField(els.ownerPassword);
        return;
      }

      if (utf8Length(ownerPassword) > 127) {
        setStatus("La contraseña de propietario supera 127 bytes UTF-8.", "warning");
        return;
      }
    }

    setBusy(
      true,
      state.mode === "protect"
        ? "Reconstruyendo la versión actual y aplicando AES-256…"
        : "Reconstruyendo la versión actual y retirando la protección…"
    );

    try {
      const documentInfo = await requestViewerDocumentBytes();
      if (!documentInfo?.hasDocument || !(documentInfo.bytes instanceof Uint8Array)) {
        throw new Error("El documento actual ya no está disponible.");
      }

      if (els.progress) {
        els.progress.value = documentInfo.fastPath ? 48 : 32;
      }

      setStatus(
        documentInfo.fastPath
          ? (
              state.mode === "protect"
                ? "Aplicando AES-256 directamente sobre el PDF…"
                : "Retirando la protección del PDF…"
            )
          : "Reconstrucción terminada. Aplicando la operación de seguridad…",
        "info"
      );

      const result = await processWithWorker(
        state.mode,
        documentInfo.bytes,
        password,
        {
          ownerPassword,
          permissions: state.mode === "protect" ? permissions : null,
        }
      );

      if (els.progress) els.progress.value = 82;

      const suggestedName = suggestedOutputName(documentInfo.name, state.mode);
      const target = await chooseSaveTarget(suggestedName);
      if (!target) {
        setStatus("Guardado cancelado. No se creó ningún archivo.", "info");
        return;
      }

      const outputBytes = new Uint8Array(result.buffer);
      const savedPath = await writeResult(target, outputBytes);
      if (els.progress) els.progress.value = 100;

      const message =
        state.mode === "protect"
          ? "La copia protegida con AES-256 se guardó correctamente."
          : "La copia sin protección se guardó correctamente.";

      setStatus(message, "success");
      showSavedSummary(savedPath, outputBytes.byteLength);
      window.PDFPrivadoProtectionBridge?.notifySaved?.(state.mode);
      resetPasswords();
    } catch (error) {
      setStatus(errorMessage(error), "error");
    } finally {
      password = "";
      ownerPassword = "";
      setBusy(false);
    }
  }

  els.openButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void openDialog(button);
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      const trigger = event.target?.closest?.('[data-open-tool="protection"]');
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      void openDialog(trigger);
    },
    true
  );
  els.closeButtons.forEach((button) => button.addEventListener("click", closeDialog));
  els.modeProtect?.addEventListener("click", () => changeMode("protect"));
  els.modeUnlock?.addEventListener("click", () => changeMode("unlock"));
  els.actionButton?.addEventListener("click", performAction);
  els.customOwnerEnabled?.addEventListener("change", () => {
    updateOwnerFields();
    updateOperationSummary();
    els.ownerPassword?.focus?.({ preventScroll: true });
  });

  [
    els.printPermission,
    els.allowCopy,
    els.allowAnnotate,
    els.allowForm,
    els.allowAssemble,
    els.allowModify,
  ].forEach((control) => {
    control?.addEventListener("change", () => {
      markProfileCustom();
      updatePermissionSummary();
    });
  });
  els.password?.addEventListener("input", () => {
    if (els.strength) {
      els.strength.textContent = passwordStrength(els.password.value);
    }
    if (els.copyPassword) {
      els.copyPassword.disabled = !els.password.value;
    }
  });

  $$("[data-protection-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.protectionPasswordToggle);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Mostrar" : "Ocultar";
      button.setAttribute("aria-pressed", showing ? "false" : "true");
    });
  });

  dialog.addEventListener("cancel", (event) => {
    if (state.busy) event.preventDefault();
    else closeDialog();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  window.addEventListener("pdfprivado:encrypted-document-detected", () => {
    state.pendingOpenAfterFile = false;
    void openDialog(state.lastTrigger, "unlock");
  });
  window.addEventListener("pdfprivado:document-opened", () => {
    if (!state.pendingOpenAfterFile) return;
    state.pendingOpenAfterFile = false;
    void openDialog(state.lastTrigger);
  });

  /* PDFPRIVADO_PROTECTION_WORKER_PREWARM_V1 */
  const prewarmProtectionWorker = () => {
    void ensureWorker().catch(() => {
      // El error real se mostrará al utilizar Protección.
    });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(prewarmProtectionWorker, { timeout: 2500 });
  } else {
    window.setTimeout(prewarmProtectionWorker, 1200);
  }
  window.addEventListener("beforeunload", () => {
    state.worker?.terminate();
  });

  resetPremiumOptions();
  changeMode("protect");
})();
