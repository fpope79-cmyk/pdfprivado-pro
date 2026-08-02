import { createLanguageDeliveryService } from "./language-delivery-service.js";

const MANAGER_ID = "pdfprivado-language-manager";
const STYLE_ID = "pdfprivado-language-manager-style";

function injectStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) {
    return;
  }

  const style = documentRef.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .language-manager-overlay{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:rgba(15,23,42,.58);padding:24px}
    .language-manager-overlay[hidden]{display:none}
    .language-manager-panel{width:min(760px,100%);max-height:min(720px,90vh);overflow:auto;background:#fff;color:#172033;border-radius:18px;box-shadow:0 28px 80px rgba(0,0,0,.28);padding:24px}
    .language-manager-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
    .language-manager-header h2{margin:0 0 6px;font-size:1.35rem}
    .language-manager-header p{margin:0;color:#5a6577}
    .language-manager-close{border:0;background:#eef1f5;border-radius:10px;padding:8px 12px;cursor:pointer}
    .language-manager-list{display:grid;gap:12px}
    .language-manager-item{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid #dce2ea;border-radius:14px;padding:14px}
    .language-manager-item strong,.language-manager-item small{display:block}
    .language-manager-item small{color:#657084;margin-top:4px}
    .language-manager-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
    .language-manager-actions button{border:1px solid #bdc7d4;background:#fff;border-radius:9px;padding:8px 11px;cursor:pointer}
    .language-manager-actions button[data-primary]{background:#2463eb;border-color:#2463eb;color:#fff}
    .language-manager-actions button:disabled{opacity:.55;cursor:wait}
    .language-manager-status{margin:0 0 14px;padding:10px 12px;border-radius:10px;background:#f2f5f9}
    .language-manager-status[data-kind="error"]{background:#fff0f0;color:#9b1c1c}
  `;
  documentRef.head.append(style);
}

function button(label, action, primary = false) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.dataset.action = action;

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
    trigger.innerHTML = "<span>Idiomas</span>";
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
          <h2 id="language-manager-title">Idiomas de PDFPrivado Pro</h2>
          <p>El español está integrado. Los demás idiomas se descargan solo cuando tú lo solicitas.</p>
        </div>
        <button class="language-manager-close" type="button" aria-label="Cerrar">Cerrar</button>
      </header>
      <p class="language-manager-status" role="status">Sin consultar todavía.</p>
      <div class="language-manager-list"></div>
    </section>
  `;
  documentRef.body.append(overlay);

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

  async function refresh() {
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
        <div><strong>Español</strong><small>Integrado · siempre disponible</small></div>
        <div class="language-manager-actions"></div>
      `;
      const spanishActions = integrated.querySelector(".language-manager-actions");
      const spanishButton = button(
        state.active.code === "es" ? "Activo" : "Activar",
        "activate-es",
        state.active.code !== "es",
      );
      spanishButton.disabled = state.active.code === "es";
      spanishActions.append(spanishButton);
      list.append(integrated);

      for (const entry of state.catalog) {
        const installed = installedByCode.get(entry.code);
        const article = documentRef.createElement("article");
        article.className = "language-manager-item";
        article.dataset.code = entry.code;
        article.innerHTML = `
          <div>
            <strong>${entry.nativeName}</strong>
            <small>${installed ? `Instalado ${installed.version}` : entry.manifestUrl ? "Disponible para descargar" : "Aún no publicado"}</small>
          </div>
          <div class="language-manager-actions"></div>
        `;

        const actions = article.querySelector(".language-manager-actions");

        if (installed) {
          const activate = button(
            state.active.code === entry.code ? "Activo" : "Activar",
            "activate",
            state.active.code !== entry.code,
          );
          activate.disabled = state.active.code === entry.code;
          activate.dataset.version = installed.version;
          actions.append(activate);

          const remove = button("Eliminar", "remove");
          remove.dataset.version = installed.version;
          actions.append(remove);
        } else {
          const install = button("Descargar e instalar", "install", true);
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
        const target = event.target.closest("button[data-action]");
        if (!target) return;

        const article = target.closest("[data-code]");
        const code = article?.dataset.code;

        target.disabled = true;

        try {
          if (target.dataset.action === "activate-es") {
            await service.activateInstalled("es");
          } else if (target.dataset.action === "install") {
            const entry = state.catalog.find((item) => item.code === code);
            await service.installFromCatalog(entry);
          } else if (target.dataset.action === "activate") {
            await service.activateInstalled(code, target.dataset.version);
          } else if (target.dataset.action === "remove") {
            await service.removeInstalled(code, target.dataset.version);
          }

          await refresh();
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
