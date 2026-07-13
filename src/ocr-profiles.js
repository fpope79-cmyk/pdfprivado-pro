export const OCR_PROFILES = Object.freeze({
  fast: Object.freeze({
    key: "fast",
    label: "Rápido",
    description: "Menor consumo y respuesta más rápida para documentos claros.",
    render: Object.freeze({ dpi: 150, maxPixels: 4_500_000, maxDimension: 2400 }),
    tesseract: Object.freeze({ pageSegMode: "AUTO", preserveInterwordSpaces: "1" }),
  }),
  balanced: Object.freeze({
    key: "balanced",
    label: "Equilibrado",
    description: "Calidad y velocidad equilibradas. Recomendado para la mayoría de documentos.",
    render: Object.freeze({ dpi: 200, maxPixels: 8_000_000, maxDimension: 3200 }),
    tesseract: Object.freeze({ pageSegMode: "AUTO", preserveInterwordSpaces: "1" }),
  }),
  precise: Object.freeze({
    key: "precise",
    label: "Preciso",
    description: "Más resolución para texto pequeño o imágenes difíciles, con mayor consumo.",
    render: Object.freeze({ dpi: 300, maxPixels: 14_000_000, maxDimension: 4600 }),
    tesseract: Object.freeze({ pageSegMode: "AUTO", preserveInterwordSpaces: "1" }),
  }),
});

export const DEFAULT_OCR_PROFILE_KEY = "balanced";

export function resolveOcrProfile(value) {
  const key = String(value || "").trim().toLowerCase();
  return OCR_PROFILES[key] || OCR_PROFILES[DEFAULT_OCR_PROFILE_KEY];
}
