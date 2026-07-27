/**
 * Utilidades puras para la retroalimentación visual OCR → Word.
 *
 * No contienen reglas por documento. Trabajan únicamente con la diferencia
 * entre el ráster original y la capa gráfica con la tinta OCR retirada.
 */

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function weightedMedian(histogram, totalWeight) {
  if (!(totalWeight > 0)) return 0;
  const target = totalWeight / 2;
  let accumulated = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    accumulated += histogram[value];
    if (accumulated >= target) return value;
  }
  return histogram.length - 1;
}

export function normalizeRgbHex(value, fallback = "000000") {
  const candidate = String(value || "").replace(/^#/u, "").toUpperCase();
  return /^[0-9A-F]{6}$/u.test(candidate) ? candidate : fallback;
}

export function inferVisualInkColor(sourcePixels, graphicsPixels, box, canvasWidth, {
  minimumDifference = 36,
  minimumPixels = 14,
} = {}) {
  if (!sourcePixels?.length || !graphicsPixels?.length || !box || !(canvasWidth > 0)) {
    return null;
  }

  const red = new Float64Array(256);
  const green = new Float64Array(256);
  const blue = new Float64Array(256);
  let totalWeight = 0;
  let changedPixels = 0;
  let differenceTotal = 0;

  for (let y = box.top; y < box.bottom; y += 1) {
    for (let x = box.left; x < box.right; x += 1) {
      const offset = (y * canvasWidth + x) * 4;
      const difference =
        Math.abs(sourcePixels[offset] - graphicsPixels[offset]) +
        Math.abs(sourcePixels[offset + 1] - graphicsPixels[offset + 1]) +
        Math.abs(sourcePixels[offset + 2] - graphicsPixels[offset + 2]);
      if (difference < minimumDifference) continue;

      // La mediana ponderada prioriza el núcleo de la tinta y evita que los
      // bordes antialiasados o el fondo interpolado arrastren el color hacia
      // gris/blanco, problema habitual en escaneos y texto azul oscuro.
      const weight = clamp(difference, minimumDifference, 255);
      red[sourcePixels[offset]] += weight;
      green[sourcePixels[offset + 1]] += weight;
      blue[sourcePixels[offset + 2]] += weight;
      totalWeight += weight;
      differenceTotal += difference;
      changedPixels += 1;
    }
  }

  if (changedPixels < minimumPixels || !(totalWeight > 0)) return null;

  const r = weightedMedian(red, totalWeight);
  const g = weightedMedian(green, totalWeight);
  const b = weightedMedian(blue, totalWeight);
  const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const chroma = maximum - minimum;
  const saturation = maximum > 0 ? chroma / maximum : 0;

  return {
    hex: `${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase(),
    rgb: [r, g, b],
    luminance,
    chroma,
    saturation,
    changedPixels,
    meanDifference: differenceTotal / changedPixels,
  };
}

export function visualVariantGain(baseError, candidateError) {
  const base = Number(baseError);
  const candidate = Number(candidateError);
  if (!Number.isFinite(base) || !Number.isFinite(candidate) || base <= 0) return -Infinity;
  return (base - candidate) / base;
}

export function shouldAcceptVisualVariant({
  baseError,
  candidateError,
  samples,
  minimumSamples = 120,
  minimumRelativeGain = 0.02,
  minimumAbsoluteGain = 0.35,
} = {}) {
  if ((Number(samples) || 0) < minimumSamples) return false;
  const base = Number(baseError);
  const candidate = Number(candidateError);
  if (!Number.isFinite(base) || !Number.isFinite(candidate) || candidate >= base) return false;
  return (
    visualVariantGain(base, candidate) >= minimumRelativeGain &&
    (base - candidate) >= minimumAbsoluteGain
  );
}

export function shouldAcceptOcrCalibration({
  relativeGain,
  scaleDelta = 0,
  baselineDelta = 0,
  lineCount = 0,
} = {}) {
  const gain = Number(relativeGain);
  const lines = Math.max(0, Math.trunc(Number(lineCount) || 0));
  if (!Number.isFinite(gain) || lines < 5) return false;

  // Una referencia vertical repetidamente mejorada es una señal fuerte y era
  // ya la puerta de v10/v11. Se conserva el umbral histórico.
  if (Math.abs(Number(baselineDelta) || 0) >= 0.001) {
    return gain >= 0.027;
  }

  // v12 permite además una corrección exclusivamente tipográfica, pero solo
  // cuando la ventaja visual es mucho mayor, afecta a una página con texto
  // suficiente y el cambio de escala no es un microajuste.
  return (
    lines >= 8 &&
    Math.abs(Number(scaleDelta) || 0) >= 0.04 &&
    gain >= 0.06
  );
}

export function shouldAcceptOcrVisualPageFeedback({
  baseError,
  candidateError,
  changedLines = 0,
  minimumRelativeGain = 0.002,
  minimumAbsoluteGain = 0.05,
} = {}) {
  const base = Number(baseError);
  const candidate = Number(candidateError);
  const changes = Math.max(0, Math.trunc(Number(changedLines) || 0));
  if (changes < 1 || !Number.isFinite(base) || !Number.isFinite(candidate) || base <= 0) {
    return false;
  }
  return (
    candidate < base &&
    visualVariantGain(base, candidate) >= minimumRelativeGain &&
    (base - candidate) >= minimumAbsoluteGain
  );
}
