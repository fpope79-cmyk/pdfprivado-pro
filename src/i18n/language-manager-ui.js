import { APP_LANGUAGE_CHANGED_EVENT } from "./language-runtime.js";
import { createLanguageDeliveryService } from "./language-delivery-service.js";

const MANAGER_ID = "pdfprivado-language-manager";
const STYLE_ID = "pdfprivado-language-manager-style";

const LANGUAGE_MANAGER_COPY = Object.freeze({
  es: {
    active: "Activo",
    activate: "Activar",
    installed: "Instalado",
    availableDownload: "Disponible para descargar",
    notPublished: "Aún no publicado",
    updateTo: "Actualizar a",
    remove: "Eliminar",
    downloadInstall: "Descargar e instalar",
    activating: "Activando {language}…",
    activatedSuccess: "Idioma activado correctamente.",
    installedSuccess: "Idioma descargado e instalado correctamente.",
    removedSuccess: "Idioma eliminado correctamente.",
  },
  en: {
    active: "Active",
    activate: "Activate",
    installed: "Installed",
    availableDownload: "Available for download",
    notPublished: "Not yet published",
    updateTo: "Update to",
    remove: "Remove",
    downloadInstall: "Download and install",
    activating: "Activating {language}…",
    activatedSuccess: "Language activated successfully.",
    installedSuccess: "Language downloaded and installed successfully.",
    removedSuccess: "Language removed successfully.",
  },
  de: {
    active: "Aktiv",
    activate: "Aktivieren",
    installed: "Installiert",
    availableDownload: "Zum Herunterladen verfügbar",
    notPublished: "Noch nicht veröffentlicht",
    updateTo: "Aktualisieren auf",
    remove: "Entfernen",
    downloadInstall: "Herunterladen und installieren",
    activating: "{language} wird aktiviert…",
    activatedSuccess: "Sprache erfolgreich aktiviert.",
    installedSuccess: "Sprache erfolgreich heruntergeladen und installiert.",
    removedSuccess: "Sprache erfolgreich entfernt.",
  },
  fr: {
    active: "Actif",
    activate: "Activer",
    installed: "Installé",
    availableDownload: "Disponible au téléchargement",
    notPublished: "Pas encore publié",
    updateTo: "Mettre à jour vers",
    remove: "Supprimer",
    downloadInstall: "Télécharger et installer",
    activating: "Activation de {language}…",
    activatedSuccess: "Langue activée avec succès.",
    installedSuccess: "Langue téléchargée et installée avec succès.",
    removedSuccess: "Langue supprimée avec succès.",
  },
  it: {
    active: "Attivo",
    activate: "Attiva",
    installed: "Installato",
    availableDownload: "Disponibile per il download",
    notPublished: "Non ancora pubblicato",
    updateTo: "Aggiorna a",
    remove: "Rimuovi",
    downloadInstall: "Scarica e installa",
    activating: "Attivazione di {language}…",
    activatedSuccess: "Lingua attivata correttamente.",
    installedSuccess: "Lingua scaricata e installata correttamente.",
    removedSuccess: "Lingua rimossa correttamente.",
  },
  pt: {
    active: "Ativo",
    activate: "Ativar",
    installed: "Instalado",
    availableDownload: "Disponível para descarregar",
    notPublished: "Ainda não publicado",
    updateTo: "Atualizar para",
    remove: "Remover",
    downloadInstall: "Descarregar e instalar",
    activating: "A ativar {language}…",
    activatedSuccess: "Idioma ativado com êxito.",
    installedSuccess: "Idioma descarregado e instalado com êxito.",
    removedSuccess: "Idioma removido com êxito.",
  },
  nl: {
    active: "Actief",
    activate: "Activeren",
    installed: "Geïnstalleerd",
    availableDownload: "Beschikbaar om te downloaden",
    notPublished: "Nog niet gepubliceerd",
    updateTo: "Bijwerken naar",
    remove: "Verwijderen",
    downloadInstall: "Downloaden en installeren",
    activating: "{language} activeren…",
    activatedSuccess: "Taal succesvol geactiveerd.",
    installedSuccess: "Taal succesvol gedownload en geïnstalleerd.",
    removedSuccess: "Taal succesvol verwijderd.",
  },
  ru: {
    active: "Активен",
    activate: "Активировать",
    installed: "Установлен",
    availableDownload: "Доступен для скачивания",
    notPublished: "Ещё не опубликован",
    updateTo: "Обновить до",
    remove: "Удалить",
    downloadInstall: "Скачать и установить",
    activating: "Активация: {language}…",
    activatedSuccess: "Язык успешно активирован.",
    installedSuccess: "Язык успешно скачан и установлен.",
    removedSuccess: "Язык успешно удалён.",
  },
  jp: {
    active: "有効",
    activate: "有効にする",
    installed: "インストール済み",
    availableDownload: "ダウンロード可能",
    notPublished: "未公開",
    updateTo: "更新先",
    remove: "削除",
    downloadInstall: "ダウンロードしてインストール",
    activating: "{language}を有効にしています…",
    activatedSuccess: "言語を有効にしました。",
    installedSuccess: "言語をダウンロードしてインストールしました。",
    removedSuccess: "言語を削除しました。",
  },
  cn: {
    active: "已启用",
    activate: "启用",
    installed: "已安装",
    availableDownload: "可下载",
    notPublished: "尚未发布",
    updateTo: "更新到",
    remove: "删除",
    downloadInstall: "下载并安装",
    activating: "正在启用 {language}…",
    activatedSuccess: "语言已成功启用。",
    installedSuccess: "语言已成功下载并安装。",
    removedSuccess: "语言已成功删除。",
  },
});

function getLanguageManagerCopy(runtime) {
  const code = runtime.getActiveLanguage().code;
  return LANGUAGE_MANAGER_COPY[code] || LANGUAGE_MANAGER_COPY.es;
}

function formatLanguageManagerText(template, values = {}) {
  return String(template).replace(
    /\{([A-Za-z0-9_]+)\}/g,
    (match, name) =>
      Object.prototype.hasOwnProperty.call(values, name)
        ? String(values[name])
        : match,
  );
}

function injectStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) {
    return;
  }

  const style = documentRef.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* PDFPRIVADO_LANGUAGE_MANAGER_COMPACT_V2 */
    .language-manager-overlay{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:rgba(15,23,42,.56);padding:18px}
    .language-manager-overlay[hidden]{display:none}
    .language-manager-panel{width:min(720px,100%);max-height:min(620px,82vh);overflow:hidden;background:#fff;color:#172033;border:1px solid rgba(148,163,184,.28);border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.30);padding:18px;display:flex;flex-direction:column}
    .language-manager-header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}
    .language-manager-header h2{margin:0 0 3px;font-size:1.17rem;line-height:1.25}
    .language-manager-header p{margin:0;color:#64748b;font-size:.83rem}
    .language-manager-close{border:0;background:#eef2f7;color:#334155;border-radius:9px;padding:7px 10px;cursor:pointer;font-weight:650}
    .language-manager-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;overflow:auto;padding:1px 3px 3px 1px}
    .language-manager-item{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:9px;border:1px solid #dde4ed;border-radius:11px;padding:9px 10px;min-height:54px;background:#fff}
    .language-manager-item strong,.language-manager-item small{display:block}
    .language-manager-item small{color:#64748b;margin-top:2px;font-size:.70rem;line-height:1.25}
    .language-manager-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}
    .language-manager-actions button{border:1px solid #c7d1dd;background:#fff;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:.76rem;white-space:nowrap}
    .language-manager-actions button[data-primary]{background:#2463eb;border-color:#2463eb;color:#fff}
    .language-manager-actions button:disabled{opacity:.55;cursor:wait}
    .language-manager-status{margin:0 0 10px;padding:7px 10px;border-radius:9px;background:#f1f5f9;color:#475569;font-size:.76rem}
    .language-manager-status[data-kind="error"]{background:#fff0f0;color:#9b1c1c}
    @media(max-width:700px){.language-manager-list{grid-template-columns:1fr}.language-manager-panel{max-height:88vh}}
  `;
  documentRef.head.append(style);
}

function button(label, action, primary = false) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.dataset.languageAction = action;

  if (primary) {
    element.dataset.primary = "";
  }

  return element;
}

export function installLanguageManagerUi({
  runtime,
  invoke,
  fetchRef = globalThis.fetch,
  cryptoRef = globalThis.crypto,
  apiBaseUrl,
  documentRef = globalThis.document,
} = {}) {
  if (!documentRef || documentRef.getElementById(MANAGER_ID)) {
    return null;
  }

  injectStyles(documentRef);

  const service = createLanguageDeliveryService({
    runtime,
    invoke,
    fetchRef,
    cryptoRef,
    apiBaseUrl,
  });

  const helpMenu = documentRef.querySelector(
    "#app-menu-bar [data-app-menu]:last-of-type .app-menu-dropdown",
  );

  if (!helpMenu) {
    return null;
  }

  let trigger = helpMenu.querySelector('[data-app-command="languages"]');

  if (!trigger) {
    trigger = documentRef.createElement("button");
    trigger.type = "button";
    trigger.role = "menuitem";
    trigger.dataset.appCommand = "languages";
    trigger.innerHTML =
      '<span data-i18n-skip="true" data-language-manager-trigger-label></span>';
    helpMenu.insertBefore(trigger, helpMenu.firstElementChild);
  }

  const overlay = documentRef.createElement("div");
  overlay.id = MANAGER_ID;
  overlay.className = "language-manager-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="language-manager-panel" role="dialog" aria-modal="true" aria-labelledby="language-manager-title">
      <header class="language-manager-header">
        <div>
          <h2 id="language-manager-title" data-i18n-skip="true">
            <span>PDFPrivado Pro</span>
            <span aria-hidden="true"> — </span>
            <span data-language-manager-title-label></span>
          </h2>
          <p>El español está integrado. Los demás idiomas se descargan solo cuando tú lo solicitas.</p>
        </div>
        <button class="language-manager-close" type="button" aria-label="Cerrar">Cerrar</button>
      </header>
      <p class="language-manager-status" role="status">Sin consultar todavía.</p>
      <div class="language-manager-list"></div>
    </section>
  `;
  documentRef.body.append(overlay);

  function syncLanguageManagerStaticLabels() {
    const activeCode = runtime.getActiveLanguage().code;
    const managerLabel =
      activeCode === "es"
        ? "Idiomas"
        : runtime.t(
            "common.labels.gestorLanguages",
            undefined,
            "Languages",
          );

    const triggerLabel = trigger.querySelector(
      "[data-language-manager-trigger-label]",
    );

    if (triggerLabel) {
      triggerLabel.textContent = managerLabel;
    }

    const titleLabel = overlay.querySelector(
      "[data-language-manager-title-label]",
    );

    if (titleLabel) {
      titleLabel.textContent = managerLabel;
    }

    const spanishNativeName = overlay.querySelector(
      '[data-language-native-code="es"]',
    );

    if (spanishNativeName) {
      spanishNativeName.textContent = "Español";
    }
  }

  syncLanguageManagerStaticLabels();

  documentRef.defaultView?.addEventListener(
    APP_LANGUAGE_CHANGED_EVENT,
    () => {
      syncLanguageManagerStaticLabels();
      scheduleLanguageManagerRefresh();
    },
  );

  const status = overlay.querySelector(".language-manager-status");
  const list = overlay.querySelector(".language-manager-list");
  const close = overlay.querySelector(".language-manager-close");

  function setStatus(message, kind = "normal") {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function closeManager() {
    overlay.hidden = true;
    trigger.focus();
  }

  let refreshScheduled = false;

  function scheduleLanguageManagerRefresh() {
    if (overlay.hidden || refreshScheduled) {
      return;
    }

    refreshScheduled = true;

    queueMicrotask(async () => {
      try {
        await refresh();
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : String(error),
          "error",
        );
      } finally {
        refreshScheduled = false;
      }
    });
  }

  async function refresh() {
    const copy = getLanguageManagerCopy(runtime);

    list.replaceChildren();
    setStatus("Consultando catálogo e idiomas instalados…");

    try {
      const state = await service.getState();
      const installedByCode = new Map();

      for (const entry of state.installed) {
        const current = installedByCode.get(entry.code);

        if (!current || entry.version.localeCompare(current.version, undefined, { numeric: true }) > 0) {
          installedByCode.set(entry.code, entry);
        }
      }

      const integrated = documentRef.createElement("article");
      integrated.className = "language-manager-item";
      integrated.innerHTML = `
        <div>
          <strong data-i18n-skip="true" data-language-native-code="es">Español</strong>
          <small>Integrado · siempre disponible</small>
        </div>
        <div class="language-manager-actions"></div>
      `;
      const spanishActions = integrated.querySelector(".language-manager-actions");
      const spanishButton = button(
        state.active.code === "es" ? copy.active : copy.activate,
        "activate-es",
        state.active.code !== "es",
      );
      spanishButton.disabled = state.active.code === "es";
      spanishActions.append(spanishButton);
      list.append(integrated);

      for (const entry of state.catalog) {
        const installed = installedByCode.get(entry.code);
        const updateAvailable = Boolean(
          installed &&
          entry.packageVersion &&
          entry.packageVersion.localeCompare(
            installed.version,
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            },
          ) > 0
        );
        const article = documentRef.createElement("article");
        article.className = "language-manager-item";
        article.dataset.code = entry.code;
        article.innerHTML = `
          <div>
            <strong>${entry.nativeName}</strong>
            <small data-i18n-skip="true">${
              installed
                ? updateAvailable
                  ? `${copy.installed} ${installed.version} · ${copy.updateTo} ${entry.packageVersion}`
                  : `${copy.installed} ${installed.version}`
                : entry.manifestUrl
                  ? copy.availableDownload
                  : copy.notPublished
            }</small>
          </div>
          <div class="language-manager-actions"></div>
        `;

        const actions = article.querySelector(".language-manager-actions");

        if (installed) {
          if (updateAvailable) {
            const update = button(
              `${copy.updateTo} ${entry.packageVersion}`,
              "install",
              true,
            );
            actions.append(update);
          }

          const activate = button(
            state.active.code === entry.code ? copy.active : copy.activate,
            "activate",
            state.active.code !== entry.code,
          );
          activate.disabled = state.active.code === entry.code;
          activate.dataset.version = installed.version;
          actions.append(activate);

          const remove = button(copy.remove, "remove");
          remove.dataset.version = installed.version;
          actions.append(remove);
        } else {
          const install = button(copy.downloadInstall, "install", true);
          install.disabled = !entry.manifestUrl;
          actions.append(install);
        }

        list.append(article);
      }

      setStatus(
        state.catalog.length
          ? "Catálogo actualizado bajo petición."
          : "El catálogo Pro todavía no publica idiomas descargables.",
      );

      list.onclick = async (event) => {
        const target = event.target.closest("button[data-language-action]");
        if (!target) return;

        event.preventDefault();
        event.stopPropagation();

        const action = target.dataset.languageAction;
        const article = target.closest("[data-code]");
        const code = article?.dataset.code;

        target.disabled = true;

        try {
          if (action === "activate-es") {
            await service.activateInstalled("es");
          } else if (action === "install") {
            const entry = state.catalog.find((item) => item.code === code);
            await service.installFromCatalog(entry);
          } else if (action === "activate") {
            setStatus(
              formatLanguageManagerText(
                getLanguageManagerCopy(runtime).activating,
                { language: code },
              ),
            );

            await service.activateInstalled(
              code,
              target.dataset.version,
              {
                onProgress: () =>
                  setStatus(
                    formatLanguageManagerText(
                      getLanguageManagerCopy(runtime).activating,
                      { language: code },
                    ),
                  ),
              },
            );

            setStatus(getLanguageManagerCopy(runtime).activatedSuccess);
          } else if (action === "remove") {
            await service.removeInstalled(code, target.dataset.version);
          }

          if (action === "activate" || action === "activate-es") {
            setStatus("Idioma activado correctamente. Se aplicará completamente al reiniciar.");
            target.textContent = "Activo";
            target.disabled = true;
          } else if (action === "install") {
            setStatus(getLanguageManagerCopy(runtime).installedSuccess);
            target.disabled = false;
          } else if (action === "remove") {
            setStatus(getLanguageManagerCopy(runtime).removedSuccess);
            target.disabled = false;
          }
          scheduleLanguageManagerRefresh();
        } catch (error) {
          setStatus(
            error instanceof Error ? error.message : String(error),
            "error",
          );
          target.disabled = false;
        }
      };
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : String(error),
        "error",
      );
    }
  }

  trigger.addEventListener("click", async () => {
    overlay.hidden = false;
    close.focus();
    await refresh();
  });

  close.addEventListener("click", closeManager);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeManager();
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeManager();
  });

  return Object.freeze({
    open: async () => {
      overlay.hidden = false;
      await refresh();
    },
    close: closeManager,
    refresh,
    service,
  });
}
