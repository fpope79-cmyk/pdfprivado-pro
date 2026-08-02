/**
 * Traduce mensajes producidos por módulos de interfaz.
 * Consulta el runtime activo en cada llamada para respetar cambios de idioma.
 */
export function tUi(key, values = {}, defaultValue = "") {
  const runtimeT = globalThis.pdfprivadoT;
  if (typeof runtimeT !== "function") return defaultValue || key;
  return runtimeT(key, values, defaultValue);
}
