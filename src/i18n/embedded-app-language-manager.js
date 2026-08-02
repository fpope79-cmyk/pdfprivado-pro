import { APP_LANGUAGE_CHANGED_EVENT } from "./language-runtime.js";

const OCR_TO_APP_LANGUAGE = Object.freeze({
  spa: "es",
  eng: "en",
  fra: "fr",
  deu: "de",
  ita: "it",
  por: "pt",
  nld: "nl",
  rus: "ru",
  jpn: "jp",
  chi_sim: "cn",
});

const SUPPORTED_OCR_LANGUAGE_CODES = new Set(
  Object.keys(OCR_TO_APP_LANGUAGE),
);

const OCR_MANAGER_ID = "ocr-language-manager-overlay";
const HELP_MANAGER_ID = "pdfprivado-language-manager";

/* PDFPRIVADO_LANGUAGE_ROW_LOCALIZATION_V12 */
const OCR_TO_BCP47 = Object.freeze({
  spa: "es",
  eng: "en",
  fra: "fr",
  deu: "de",
  ita: "it",
  por: "pt",
  nld: "nl",
  rus: "ru",
  jpn: "ja",
  chi_sim: "zh-Hans",
});

const APP_TO_BCP47 = Object.freeze({
  es: "es",
  en: "en",
  fr: "fr",
  de: "de",
  it: "it",
  pt: "pt",
  nl: "nl",
  ru: "ru",
  jp: "ja",
  cn: "zh-Hans",
});

const FALLBACK_LANGUAGE_NAMES = Object.freeze({
  spa: "Español",
  eng: "English",
  fra: "Français",
  deu: "Deutsch",
  ita: "Italiano",
  por: "Português",
  nld: "Nederlands",
  rus: "Русский",
  jpn: "日本語",
  chi_sim: "中文",
});

const UI_TEXT = Object.freeze({
  es: {
    installed: "Idiomas instalados",
    available: "Idiomas disponibles",
    install: "Instalar",
    activate: "Activar",
    update: "Actualizar",
    active: "Activo",
    remove: "Eliminar",
    removing: "Eliminando…",
    installing: "Instalando…",
    activating: "Activando…",
    updating: "Actualizando…",
    interfaceActive: "Interfaz · Activa",
    interfaceIntegrated: "Interfaz · Integrada",
    interfaceInstalled: "Interfaz · Instalada",
    interfaceAvailable: "Interfaz · Disponible",
    interfaceUpdate: "Interfaz · Actualización disponible",
    interfaceUnavailable: "Interfaz · No disponible",
    appLanguage: "Idioma de la aplicación",
    selectHint: "Selecciona un idioma para ver sus opciones",
    installedGroup: "Instalados",
    availableGroup: "Disponibles",
    integratedAlways: "Integrado · siempre disponible",
    availableDownload: "Disponible para descargar",
    activateBeforeRemove: "Activa otro idioma antes de eliminar este paquete.",
  },
  en: {
    installed: "Installed languages",
    available: "Available languages",
    install: "Install",
    activate: "Activate",
    update: "Update",
    active: "Active",
    remove: "Remove",
    removing: "Removing…",
    installing: "Installing…",
    activating: "Activating…",
    updating: "Updating…",
    interfaceActive: "Interface · Active",
    interfaceIntegrated: "Interface · Integrated",
    interfaceInstalled: "Interface · Installed",
    interfaceAvailable: "Interface · Available",
    interfaceUpdate: "Interface · Update available",
    interfaceUnavailable: "Interface · Unavailable",
    appLanguage: "Application language",
    selectHint: "Select a language to view its options",
    installedGroup: "Installed",
    availableGroup: "Available",
    integratedAlways: "Integrated · always available",
    availableDownload: "Available to download",
    activateBeforeRemove: "Activate another language before removing this package.",
  },
  fr: {
    installed: "Langues installées",
    available: "Langues disponibles",
    install: "Installer",
    activate: "Activer",
    update: "Mettre à jour",
    active: "Actif",
    remove: "Supprimer",
    removing: "Suppression…",
    installing: "Installation…",
    activating: "Activation…",
    updating: "Mise à jour…",
    interfaceActive: "Interface · Active",
    interfaceIntegrated: "Interface · Intégrée",
    interfaceInstalled: "Interface · Installée",
    interfaceAvailable: "Interface · Disponible",
    interfaceUpdate: "Interface · Mise à jour disponible",
    interfaceUnavailable: "Interface · Indisponible",
    appLanguage: "Langue de l’application",
    selectHint: "Sélectionnez une langue pour voir ses options",
    installedGroup: "Installées",
    availableGroup: "Disponibles",
    integratedAlways: "Intégrée · toujours disponible",
    availableDownload: "Disponible au téléchargement",
    activateBeforeRemove: "Activez une autre langue avant de supprimer ce paquet.",
  },
  de: {
    installed: "Installierte Sprachen",
    available: "Verfügbare Sprachen",
    install: "Installieren",
    activate: "Aktivieren",
    update: "Aktualisieren",
    active: "Aktiv",
    remove: "Entfernen",
    removing: "Wird entfernt…",
    installing: "Wird installiert…",
    activating: "Wird aktiviert…",
    updating: "Wird aktualisiert…",
    interfaceActive: "Oberfläche · Aktiv",
    interfaceIntegrated: "Oberfläche · Integriert",
    interfaceInstalled: "Oberfläche · Installiert",
    interfaceAvailable: "Oberfläche · Verfügbar",
    interfaceUpdate: "Oberfläche · Update verfügbar",
    interfaceUnavailable: "Oberfläche · Nicht verfügbar",
    appLanguage: "Anwendungssprache",
    selectHint: "Sprache auswählen, um Optionen anzuzeigen",
    installedGroup: "Installiert",
    availableGroup: "Verfügbar",
    integratedAlways: "Integriert · immer verfügbar",
    availableDownload: "Zum Download verfügbar",
    activateBeforeRemove: "Aktivieren Sie vor dem Entfernen eine andere Sprache.",
  },
  it: {
    installed: "Lingue installate",
    available: "Lingue disponibili",
    install: "Installa",
    activate: "Attiva",
    update: "Aggiorna",
    active: "Attivo",
    remove: "Elimina",
    removing: "Eliminazione…",
    installing: "Installazione…",
    activating: "Attivazione…",
    updating: "Aggiornamento…",
    interfaceActive: "Interfaccia · Attiva",
    interfaceIntegrated: "Interfaccia · Integrata",
    interfaceInstalled: "Interfaccia · Installata",
    interfaceAvailable: "Interfaccia · Disponibile",
    interfaceUpdate: "Interfaccia · Aggiornamento disponibile",
    interfaceUnavailable: "Interfaccia · Non disponibile",
    appLanguage: "Lingua dell’applicazione",
    selectHint: "Seleziona una lingua per visualizzare le opzioni",
    installedGroup: "Installate",
    availableGroup: "Disponibili",
    integratedAlways: "Integrata · sempre disponibile",
    availableDownload: "Disponibile per il download",
    activateBeforeRemove: "Attiva un’altra lingua prima di eliminare questo pacchetto.",
  },
  pt: {
    installed: "Idiomas instalados",
    available: "Idiomas disponíveis",
    install: "Instalar",
    activate: "Ativar",
    update: "Atualizar",
    active: "Ativo",
    remove: "Eliminar",
    removing: "A eliminar…",
    installing: "A instalar…",
    activating: "A ativar…",
    updating: "A atualizar…",
    interfaceActive: "Interface · Ativa",
    interfaceIntegrated: "Interface · Integrada",
    interfaceInstalled: "Interface · Instalada",
    interfaceAvailable: "Interface · Disponível",
    interfaceUpdate: "Interface · Atualização disponível",
    interfaceUnavailable: "Interface · Indisponível",
    appLanguage: "Idioma da aplicação",
    selectHint: "Selecione um idioma para ver as opções",
    installedGroup: "Instalados",
    availableGroup: "Disponíveis",
    integratedAlways: "Integrado · sempre disponível",
    availableDownload: "Disponível para download",
    activateBeforeRemove: "Ative outro idioma antes de eliminar este pacote.",
  },
  nl: {
    installed: "Geïnstalleerde talen",
    available: "Beschikbare talen",
    install: "Installeren",
    activate: "Activeren",
    update: "Bijwerken",
    active: "Actief",
    remove: "Verwijderen",
    removing: "Verwijderen…",
    installing: "Installeren…",
    activating: "Activeren…",
    updating: "Bijwerken…",
    interfaceActive: "Interface · Actief",
    interfaceIntegrated: "Interface · Geïntegreerd",
    interfaceInstalled: "Interface · Geïnstalleerd",
    interfaceAvailable: "Interface · Beschikbaar",
    interfaceUpdate: "Interface · Update beschikbaar",
    interfaceUnavailable: "Interface · Niet beschikbaar",
    appLanguage: "Taal van de toepassing",
    selectHint: "Selecteer een taal om de opties te bekijken",
    installedGroup: "Geïnstalleerd",
    availableGroup: "Beschikbaar",
    integratedAlways: "Geïntegreerd · altijd beschikbaar",
    availableDownload: "Beschikbaar om te downloaden",
    activateBeforeRemove: "Activeer een andere taal voordat u dit pakket verwijdert.",
  },
  ru: {
    installed: "Установленные языки",
    available: "Доступные языки",
    install: "Установить",
    activate: "Активировать",
    update: "Обновить",
    active: "Активен",
    remove: "Удалить",
    removing: "Удаление…",
    installing: "Установка…",
    activating: "Активация…",
    updating: "Обновление…",
    interfaceActive: "Интерфейс · Активен",
    interfaceIntegrated: "Интерфейс · Встроен",
    interfaceInstalled: "Интерфейс · Установлен",
    interfaceAvailable: "Интерфейс · Доступен",
    interfaceUpdate: "Интерфейс · Доступно обновление",
    interfaceUnavailable: "Интерфейс · Недоступен",
    appLanguage: "Язык приложения",
    selectHint: "Выберите язык, чтобы увидеть его параметры",
    installedGroup: "Установленные",
    availableGroup: "Доступные",
    integratedAlways: "Встроен · всегда доступен",
    availableDownload: "Доступен для загрузки",
    activateBeforeRemove: "Перед удалением активируйте другой язык.",
  },
  jp: {
    installed: "インストール済みの言語",
    available: "利用可能な言語",
    install: "インストール",
    activate: "有効化",
    update: "更新",
    active: "有効",
    remove: "削除",
    removing: "削除中…",
    installing: "インストール中…",
    activating: "有効化中…",
    updating: "更新中…",
    interfaceActive: "インターフェース · 有効",
    interfaceIntegrated: "インターフェース · 組み込み",
    interfaceInstalled: "インターフェース · インストール済み",
    interfaceAvailable: "インターフェース · 利用可能",
    interfaceUpdate: "インターフェース · 更新あり",
    interfaceUnavailable: "インターフェース · 利用不可",
    appLanguage: "アプリケーションの言語",
    selectHint: "言語を選択してオプションを表示",
    installedGroup: "インストール済み",
    availableGroup: "利用可能",
    integratedAlways: "組み込み · 常に利用可能",
    availableDownload: "ダウンロード可能",
    activateBeforeRemove: "削除する前に別の言語を有効化してください。",
  },
  cn: {
    installed: "已安装语言",
    available: "可用语言",
    install: "安装",
    activate: "启用",
    update: "更新",
    active: "已启用",
    remove: "删除",
    removing: "正在删除…",
    installing: "正在安装…",
    activating: "正在启用…",
    updating: "正在更新…",
    interfaceActive: "界面 · 已启用",
    interfaceIntegrated: "界面 · 已集成",
    interfaceInstalled: "界面 · 已安装",
    interfaceAvailable: "界面 · 可用",
    interfaceUpdate: "界面 · 有可用更新",
    interfaceUnavailable: "界面 · 不可用",
    appLanguage: "应用语言",
    selectHint: "选择语言以查看选项",
    installedGroup: "已安装",
    availableGroup: "可用",
    integratedAlways: "已集成 · 始终可用",
    availableDownload: "可下载安装",
    activateBeforeRemove: "删除此语言包前请先启用其他语言。",
  },
});

function copy(code) {
  return UI_TEXT[code] || UI_TEXT.es;
}

/* PDFPRIVADO_HELP_LANGUAGE_NAMES_V13 */
function localizedAppLanguageName(code, activeCode) {
  const languageCode = APP_TO_BCP47[code] || code;
  const locale = APP_TO_BCP47[activeCode] || "es";

  try {
    const displayNames = new Intl.DisplayNames([locale], {
      type: "language",
      fallback: "code",
    });

    const result = displayNames.of(languageCode);

    if (!result || result === languageCode) {
      return code;
    }

    return result.charAt(0).toLocaleUpperCase(locale) + result.slice(1);
  } catch {
    return code;
  }
}

function compareVersions(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function latestInstalled(entries = []) {
  const map = new Map();

  for (const entry of entries) {
    const current = map.get(entry.code);
    if (!current || compareVersions(entry.version, current.version) > 0) {
      map.set(entry.code, entry);
    }
  }

  return map;
}

function createElement(documentRef, tag, className = "", text = "") {
  const element = documentRef.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function languageStateForCode(state, code) {
  if (code === "es") {
    return {
      code: "es",
      nativeName: "Español",
      active: state.active.code === "es",
      integrated: true,
      installed: { version: "integrado" },
      updateAvailable: false,
      manifestUrl: "",
    };
  }

  const catalog = state.catalog.find((entry) => entry.code === code);
  if (!catalog) return null;

  const installed = latestInstalled(state.installed).get(code) || null;

  return {
    ...catalog,
    installed,
    active: state.active.code === code,
    updateAvailable: Boolean(
      installed &&
      catalog.packageVersion &&
      compareVersions(catalog.packageVersion, installed.version) > 0
    ),
  };
}

function primaryAction(record, labels) {
  if (!record) {
    return { label: labels.interfaceUnavailable, action: "", disabled: true };
  }
  if (record.active) {
    return { label: labels.active, action: "", disabled: true };
  }
  if (record.updateAvailable) {
    return { label: labels.update, action: "update", disabled: false };
  }
  if (record.integrated || record.installed) {
    return { label: labels.activate, action: "activate", disabled: false };
  }
  if (record.manifestUrl) {
    return { label: labels.install, action: "install", disabled: false };
  }
  return { label: labels.interfaceUnavailable, action: "", disabled: true };
}

function packageStatus(record, labels) {
  if (!record) return labels.interfaceUnavailable;
  if (record.active) return labels.interfaceActive;
  if (record.updateAvailable) return labels.interfaceUpdate;
  if (record.integrated) return labels.interfaceIntegrated;
  if (record.installed) {
    return `${labels.interfaceInstalled} ${record.installed.version}`;
  }
  if (record.manifestUrl) return labels.interfaceAvailable;
  return labels.interfaceUnavailable;
}

async function performLanguageAction(manager, record, action) {
  if (action === "activate") {
    if (record.integrated) {
      await manager.service.activateInstalled("es");
    } else {
      await manager.service.activateInstalled(record.code, record.installed.version);
    }
    return;
  }

  if (action === "install" || action === "update") {
    await manager.service.installFromCatalog(record);
    return;
  }

  if (action === "remove") {
    if (!record.installed || record.integrated || record.active) return;
    await manager.service.removeInstalled(record.code, record.installed.version);
  }
}

function setColumnHeading(list, text) {
  const column = list.closest(".ocr-language-manager-column");
  const heading =
    column?.querySelector(
      ".viewer-ocr-language-group-heading strong, " +
      ".ocr-language-manager-column-header strong, h3, h4",
    ) || column?.querySelector("strong");

  if (heading) heading.textContent = text;
}

function localizedLanguageName(ocrCode, activeCode) {
  const languageCode = OCR_TO_BCP47[ocrCode];
  const locale = APP_TO_BCP47[activeCode] || "es";

  if (!languageCode) {
    return FALLBACK_LANGUAGE_NAMES[ocrCode] || ocrCode;
  }

  try {
    const displayNames = new Intl.DisplayNames([locale], {
      type: "language",
      fallback: "code",
    });
    const result = displayNames.of(languageCode);
    return result && result !== languageCode
      ? result.charAt(0).toLocaleUpperCase(locale) + result.slice(1)
      : FALLBACK_LANGUAGE_NAMES[ocrCode] || result || ocrCode;
  } catch {
    return FALLBACK_LANGUAGE_NAMES[ocrCode] || ocrCode;
  }
}

function localizeRowName(row, ocrCode, activeCode) {
  const name =
    row.querySelector(
      ".viewer-ocr-language-name, " +
      ".viewer-ocr-language-copy strong, " +
      ".viewer-ocr-language-row > div:first-child strong",
    ) || row.querySelector("strong");

  if (name) {
    name.textContent = localizedLanguageName(ocrCode, activeCode);
  }
}

function cleanLegacyOcrBadge(row, ocrCode) {
  const legacyStatePattern =
    /^(base|no instalado|non installé|non installato|nicht installiert|not installed|non installato|não instalado|niet geïnstalleerd|не установлен|未インストール|未安装)$/i;

  const candidates = [...row.querySelectorAll("*")].filter(
    (element) =>
      !element.closest(".ocr-app-language-row") &&
      element.children.length === 0,
  );

  for (const element of candidates) {
    const value = String(element.textContent || "").trim();

    if (!legacyStatePattern.test(value)) continue;

    if (ocrCode === "spa" && /^base$/i.test(value)) {
      element.textContent = "Base";
      element.dataset.ocrBaseBadge = "true";
      continue;
    }

    element.remove();
  }

  if (ocrCode !== "spa") {
    for (const badge of row.querySelectorAll('[data-ocr-base-badge="true"]')) {
      badge.remove();
    }
  }
}

function hideLegacyOfflineImport(documentRef) {
  const importSection = documentRef.querySelector(
    ".ocr-language-manager-import",
  );
  const adminNote = documentRef.querySelector(
    ".viewer-ocr-language-admin-note",
  );

  if (importSection) importSection.hidden = true;
  if (adminNote) adminNote.hidden = true;
}

function installOcrRowIntegration({
  manager,
  documentRef,
  getState,
}) {
  const installedList = documentRef.getElementById(
    "viewer-ocr-language-installed-list",
  );
  const availableList = documentRef.getElementById(
    "viewer-ocr-language-available-list",
  );

  if (!installedList || !availableList) return null;

  let busy = false;
  let queued = false;

  function filterSupportedRows() {
    for (const row of documentRef.querySelectorAll(
      ".ocr-language-manager-list .viewer-ocr-language-row",
    )) {
      const code = String(row.dataset.ocrLanguageCode || "").trim();
      const supported = SUPPORTED_OCR_LANGUAGE_CODES.has(code);
      row.hidden = !supported;
      row.toggleAttribute("aria-hidden", !supported);
    }
  }

  async function decorate() {
    filterSupportedRows();
    hideLegacyOfflineImport(documentRef);

    if (busy) {
      queued = true;
      return;
    }

    busy = true;

    try {
      const state = await getState();
      const labels = copy(state.active.code);
      const installedLanguages = latestInstalled(state.installed);
      const rows = [...documentRef.querySelectorAll(
        ".ocr-language-manager-list .viewer-ocr-language-row:not([hidden])",
      )];

      setColumnHeading(installedList, labels.installed);
      setColumnHeading(availableList, labels.available);

      for (const row of rows) {
        const ocrCode = String(row.dataset.ocrLanguageCode || "").trim();
        const appCode = OCR_TO_APP_LANGUAGE[ocrCode];
        const record = languageStateForCode(state, appCode);

        localizeRowName(row, ocrCode, state.active.code);
        cleanLegacyOcrBadge(row, ocrCode);
        row.querySelector(".ocr-app-language-row")?.remove();

        const integration = createElement(
          documentRef,
          "div",
          "ocr-app-language-row",
        );
        const status = createElement(
          documentRef,
          "span",
          "ocr-app-language-row-status",
          packageStatus(record, labels),
        );
        const actions = createElement(
          documentRef,
          "div",
          "ocr-app-language-row-actions",
        );

        const descriptor = primaryAction(record, labels);
        const primary = createElement(
          documentRef,
          "button",
          "ocr-app-language-row-action",
          descriptor.label,
        );

        primary.type = "button";
        primary.disabled = descriptor.disabled;
        primary.dataset.appLanguageCode = appCode || "";
        primary.dataset.appLanguageAction = descriptor.action;

        actions.append(primary);

        if (record?.installed && !record.integrated) {
          const remove = createElement(
            documentRef,
            "button",
            "ocr-app-language-row-remove",
            labels.remove,
          );

          remove.type = "button";
          remove.dataset.appLanguageCode = appCode;
          remove.dataset.appLanguageAction = "remove";
          remove.disabled = record.active;
          remove.title = record.active
            ? labels.activateBeforeRemove
            : `${labels.remove} ${record.nativeName}`;

          actions.append(remove);
        }

        integration.append(status, actions);
        row.append(integration);

        const isInstalled =
          appCode === "es" || installedLanguages.has(appCode);

        const targetList = isInstalled
          ? installedList
          : availableList;

        if (row.parentElement !== targetList) {
          targetList.append(row);
        }
      }
    } catch (error) {
      console.error("[PDFPrivado] No se pudo actualizar el gestor integrado", error);
    } finally {
      busy = false;

      if (queued) {
        queued = false;
        queueMicrotask(decorate);
      }
    }
  }

  async function onClick(event) {
    const button = event.target.closest("[data-app-language-action]");
    if (!button || button.disabled) return;

    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.appLanguageAction;
    const code = button.dataset.appLanguageCode;
    if (!action || !code) return;

    const state = await getState();
    const labels = copy(state.active.code);
    const record = languageStateForCode(state, code);
    if (!record) return;

    button.disabled = true;
    button.textContent =
      action === "activate"
        ? labels.activating
        : action === "update"
          ? labels.updating
          : action === "remove"
            ? labels.removing
            : labels.installing;

    try {
      await performLanguageAction(manager, record, action);
      await manager.refresh?.();
      await decorate();
    } catch (error) {
      console.error("[PDFPrivado] Acción de idioma fallida", error);
      button.disabled = false;
      await decorate();
    }
  }

  const observer = new MutationObserver(() => {
    filterSupportedRows();
    hideLegacyOfflineImport(documentRef);
    queueMicrotask(decorate);
  });

  observer.observe(installedList, { childList: true });
  observer.observe(availableList, { childList: true });

  installedList.addEventListener("click", onClick);
  availableList.addEventListener("click", onClick);

  decorate();

  return Object.freeze({ refresh: decorate });
}

function installHelpLanguagePicker({
  manager,
  documentRef,
}) {
  const overlay = documentRef.getElementById(HELP_MANAGER_ID);
  if (!overlay) return null;

  const list = overlay.querySelector(".language-manager-list");
  const status = overlay.querySelector(".language-manager-status");
  if (!list || !status) return null;

  let picker = overlay.querySelector(".language-manager-picker");

  if (!picker) {
    picker = createElement(
      documentRef,
      "section",
      "language-manager-picker",
    );

    picker.innerHTML = `
      <label class="language-manager-picker-field">
        <span class="language-manager-picker-label"></span>
        <small class="language-manager-picker-hint"></small>
        <span class="language-manager-picker-select-wrap">
          <select class="language-manager-picker-select"></select>
          <span class="language-manager-picker-chevron" aria-hidden="true">⌄</span>
        </span>
      </label>
      <article class="language-manager-picker-detail" aria-live="polite">
        <div>
          <strong class="language-manager-picker-name"></strong>
          <small class="language-manager-picker-meta"></small>
        </div>
        <div class="language-manager-picker-actions"></div>
      </article>
    `;

    status.insertAdjacentElement("afterend", picker);
  }

  const label = picker.querySelector(".language-manager-picker-label");
  const hint = picker.querySelector(".language-manager-picker-hint");
  const select = picker.querySelector(".language-manager-picker-select");
  const name = picker.querySelector(".language-manager-picker-name");
  const meta = picker.querySelector(".language-manager-picker-meta");
  const actions = picker.querySelector(".language-manager-picker-actions");

  let currentState = null;

  async function renderSelection() {
    if (!currentState) return;

    const labels = copy(currentState.active.code);
    const record = languageStateForCode(currentState, select.value);
    if (!record) return;

    label.textContent = labels.appLanguage;
    hint.textContent = labels.selectHint;
    select.setAttribute("aria-label", labels.appLanguage);
    name.textContent = localizedAppLanguageName(
      record.code,
      currentState.active.code,
    );
    meta.textContent = record.integrated
      ? labels.integratedAlways
      : record.installed
        ? `${labels.interfaceInstalled} ${record.installed.version}`
        : labels.availableDownload;

    actions.replaceChildren();

    const descriptor = primaryAction(record, labels);
    const primary = createElement(
      documentRef,
      "button",
      "",
      descriptor.label,
    );

    primary.type = "button";
    primary.disabled = descriptor.disabled;

    if (!descriptor.disabled) {
      primary.dataset.primary = "";
      primary.addEventListener("click", async () => {
        primary.disabled = true;
        primary.textContent =
          descriptor.action === "activate"
            ? labels.activating
            : descriptor.action === "update"
              ? labels.updating
              : labels.installing;

        try {
          await performLanguageAction(manager, record, descriptor.action);
          await manager.refresh?.();
          await rebuild();
        } catch (error) {
          console.error("[PDFPrivado] Acción de idioma fallida", error);
          primary.disabled = false;
          primary.textContent = descriptor.label;
        }
      });
    }

    actions.append(primary);

    if (record.installed && !record.integrated) {
      const remove = createElement(
        documentRef,
        "button",
        "",
        labels.remove,
      );

      remove.type = "button";
      remove.disabled = record.active;
      remove.title = record.active
        ? labels.activateBeforeRemove
        : `${labels.remove} ${record.nativeName}`;

      remove.addEventListener("click", async () => {
        remove.disabled = true;
        remove.textContent = labels.removing;

        try {
          await performLanguageAction(manager, record, "remove");
          await manager.refresh?.();
          await rebuild();
        } catch (error) {
          console.error("[PDFPrivado] No se pudo eliminar el idioma", error);
          remove.disabled = false;
          remove.textContent = labels.remove;
        }
      });

      actions.append(remove);
    }
  }

  async function rebuild() {
    const previous = select.value;
    currentState = await manager.service.getState();
    const labels = copy(currentState.active.code);

    const records = [
      languageStateForCode(currentState, "es"),
      ...currentState.catalog.map((entry) =>
        languageStateForCode(currentState, entry.code),
      ),
    ].filter(Boolean);

    const installed = records.filter(
      (record) => record.integrated || record.installed,
    );
    const available = records.filter(
      (record) => !record.integrated && !record.installed,
    );

    select.replaceChildren();

    function appendGroup(groupLabel, entries) {
      if (!entries.length) return;

      const group = documentRef.createElement("optgroup");
      group.label = groupLabel;

      for (const record of entries) {
        const option = documentRef.createElement("option");
        option.value = record.code;
        option.dataset.languageCode = record.code;
        option.textContent = `${localizedAppLanguageName(
          record.code,
          currentState.active.code,
        )}${record.active ? ` · ${labels.active}` : ""}`;
        group.append(option);
      }

      select.append(group);
    }

    appendGroup(labels.installedGroup, installed);
    appendGroup(labels.availableGroup, available);

    const active = records.find((record) => record.active);
    select.value = records.some((record) => record.code === previous)
      ? previous
      : active?.code || "es";

    await renderSelection();

    // El traductor DOM puede procesar el select después de este render.
    // Reaplicamos los nombres localizados al final del ciclo visual.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const latestLabels = copy(currentState.active.code);

        for (const option of select.querySelectorAll("option[data-language-code]")) {
          const code = option.dataset.languageCode;
          const record = records.find((entry) => entry.code === code);

          if (!record) continue;

          const expected = `${localizedAppLanguageName(
            code,
            currentState.active.code,
          )}${record.active ? ` · ${latestLabels.active}` : ""}`;

          if (option.textContent !== expected) {
            option.textContent = expected;
          }
        }

        renderSelection();
      });
    });
  }

  select.addEventListener("change", renderSelection);

  const observer = new MutationObserver(() => {
    queueMicrotask(rebuild);
  });

  observer.observe(list, { childList: true, subtree: true });
  rebuild();

  return Object.freeze({ refresh: rebuild });
}

export function installEmbeddedAppLanguageManager({
  manager = globalThis.pdfprivadoLanguageManager,
  runtime = globalThis.pdfprivadoI18n,
  documentRef = globalThis.document,
} = {}) {
  if (!manager?.service || !runtime || !documentRef) {
    return null;
  }

  let cachedState = null;
  let statePromise = null;

  async function getState({ force = false } = {}) {
    if (!force && cachedState) return cachedState;
    if (!force && statePromise) return statePromise;

    statePromise = manager.service.getState();

    try {
      cachedState = await statePromise;
      return cachedState;
    } finally {
      statePromise = null;
    }
  }

  const ocrIntegration = installOcrRowIntegration({
    manager,
    documentRef,
    getState: () => getState({ force: true }),
  });

  const helpPicker = installHelpLanguagePicker({
    manager,
    documentRef,
  });

  globalThis.addEventListener(APP_LANGUAGE_CHANGED_EVENT, async () => {
    cachedState = null;
    await ocrIntegration?.refresh?.();
    await helpPicker?.refresh?.();
  });

  const ocrOverlay = documentRef.getElementById(OCR_MANAGER_ID);

  if (ocrOverlay && globalThis.MutationObserver) {
    new MutationObserver(async () => {
      if (!ocrOverlay.hidden) {
        cachedState = null;
        await ocrIntegration?.refresh?.();
      }
    }).observe(ocrOverlay, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }

  return Object.freeze({
    refresh: async () => {
      cachedState = null;
      await ocrIntegration?.refresh?.();
      await helpPicker?.refresh?.();
    },
  });
}