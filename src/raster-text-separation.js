/**
 * Elimina tinta textual de una página rasterizada sin borrar reglas largas.
 *
 * Las cajas OCR son semillas, no rectángulos de borrado ciego: se amplían de
 * forma limitada en horizontal, se etiquetan componentes de tinta y solo se
 * inpaintan componentes compatibles con texto. Una segunda máscara débil
 * captura el antialiasing que suele producir el efecto de "texto fantasma".
 */

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function sampleBackground(
  data,
  imageWidth,
  imageHeight,
  left,
  top,
  right,
  bottom,
  percentile = 0.5
) {
  const samples = [];
  const push = (x, y) => {
    const px = clamp(Math.round(x), 0, imageWidth - 1);
    const py = clamp(Math.round(y), 0, imageHeight - 1);
    const offset = (py * imageWidth + px) * 4;
    samples.push([data[offset], data[offset + 1], data[offset + 2]]);
  };
  const stepX = Math.max(1, Math.floor((right - left) / 18));
  const stepY = Math.max(1, Math.floor((bottom - top) / 6));
  for (let x = left; x <= right; x += stepX) {
    push(x, top - 2);
    push(x, bottom + 2);
  }
  for (let y = top; y <= bottom; y += stepY) {
    push(left - 2, y);
    push(right + 2, y);
  }
  samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  return samples[Math.floor(samples.length * clamp(percentile, 0, 0.99))] || [255, 255, 255];
}


function median(values = []) {
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function buildOcrRasterProtectionProfile(layout = []) {
  const lines = Array.isArray(layout) ? layout : [];
  return {
    medianFontSize: median(lines.map((line) => line?.fontSize || line?.height)),
    lineCount: lines.length,
  };
}

export function shouldPreserveOcrRasterLine(line, profile = {}) {
  const confidence = Number(line?.confidence);
  if (!Number.isFinite(confidence)) return false;
  const text = String(line?.text || "").trim();
  const compactLength = text.replace(/\s+/gu, "").length;
  if (!compactLength) return false;
  const fontSize = Math.max(1, Number(line?.fontSize) || Number(line?.height) || 1);
  const medianFontSize = Math.max(1, Number(profile?.medianFontSize) || fontSize);
  const sizeRatio = fontSize / medianFontSize;

  // El OCR con confianza extremadamente baja no es una base segura para
  // reemplazar tinta raster por texto inventado. Se conserva el original,
  // especialmente en sellos, firmas y pequeños fragmentos gráficos.
  if (confidence < 12 && compactLength <= 16 && sizeRatio >= 1.15) return true;

  // Logotipos y firmas suelen aparecer como una "línea" mucho mayor que el
  // cuerpo de página, con texto corto o reconocimiento mediocre. La
  // combinación de tamaño relativo + confianza evita reglas por documento.
  if (confidence < 75 && sizeRatio >= 3 && compactLength <= 18) return true;
  if (confidence < 35 && sizeRatio >= 1.8 && compactLength <= 48) return true;
  return false;
}

function componentIsRule({
  width,
  height,
  bandHeight,
}) {
  const horizontal =
    width >= Math.max(12, Math.round(bandHeight * 5)) &&
    height <= Math.max(2, Math.round(bandHeight * 0.12));
  const vertical =
    height >= Math.max(3, Math.round(bandHeight * 0.88)) &&
    width <= Math.max(2, Math.round(bandHeight * 0.10));
  return horizontal || vertical;
}

export function suppressRasterTextInImageData(imageData, {
  layout = [],
  pageWidth = 595.28,
  pageHeight = 841.89,
} = {}) {
  const data = imageData?.data;
  const imageWidth = Math.max(1, Number(imageData?.width) || 1);
  const imageHeight = Math.max(1, Number(imageData?.height) || 1);
  if (!data?.length || !Array.isArray(layout) || !layout.length) {
    return { maskedPixels: 0, processedLines: 0 };
  }

  const sx = imageWidth / Math.max(1, Number(pageWidth) || 595.28);
  const sy = imageHeight / Math.max(1, Number(pageHeight) || 841.89);
  const pageArea =
    Math.max(1, Number(pageWidth) || 595.28) *
    Math.max(1, Number(pageHeight) || 841.89);
  const layoutCoverage = layout.reduce((sum, line) => {
    const width = Math.max(0, Number(line?.width) || 0);
    const height = Math.max(0, Number(line?.height) || Number(line?.fontSize) || 0);
    return sum + width * height;
  }, 0) / pageArea;
  // La clasificación por componentes protege reglas de tablas y bordes en
  // todas las páginas. Solo el crecimiento lateral queda reservado a páginas
  // dispersas con geometría OCR muy fiable; en páginas densas trabajamos
  // estrictamente dentro de la caja para no invadir columnas vecinas.
  const useAdaptiveGrowth = layout.length <= 32 && layoutCoverage >= 0.24;
  const protectionProfile = buildOcrRasterProtectionProfile(layout);
  let maskedPixels = 0;
  let processedLines = 0;

  for (const line of layout) {
    if (shouldPreserveOcrRasterLine(line, protectionProfile)) continue;
    const fontSize = Math.max(1, Number(line?.fontSize) || Number(line?.height) || 9);
    const lineHeight = Math.max(fontSize * 1.08, Number(line?.height) || fontSize);
    const xPoints = Math.max(0, Number(line?.x) || 0);
    const topPoints = Math.max(0, pageHeight - (Number(line?.y) || 0) - lineHeight);
    const widthPoints = Math.max(
      2,
      Number(line?.width) || String(line?.text || "").length * fontSize * 0.48
    );
    const padX = Math.max(0.65, fontSize * 0.055);
    const padY = Math.max(0.50, fontSize * 0.045);
    const originalLeft = clamp(Math.floor((xPoints - padX) * sx), 0, imageWidth - 1);
    const top = clamp(Math.floor((topPoints - padY) * sy), 0, imageHeight - 1);
    const originalRight = clamp(
      Math.ceil((xPoints + widthPoints + padX) * sx),
      originalLeft + 1,
      imageWidth - 1
    );
    const bottom = clamp(
      Math.ceil((topPoints + lineHeight + padY) * sy),
      top + 1,
      imageHeight - 1
    );
    if (originalRight <= originalLeft || bottom <= top) continue;

    const lateralGrowth = useAdaptiveGrowth
      ? Math.max(2, Math.round(fontSize * sx * 2.5))
      : 0;
    const left = Math.max(0, originalLeft - lateralGrowth);
    const right = Math.min(imageWidth - 1, originalRight + lateralGrowth);
    const cropWidth = right - left + 1;
    const cropHeight = bottom - top + 1;
    const area = cropWidth * cropHeight;
    if (area <= 0) continue;

    const background = sampleBackground(
      data,
      imageWidth,
      imageHeight,
      originalLeft,
      top,
      originalRight,
      bottom,
      useAdaptiveGrowth ? 0.75 : 0.5
    );
    const backgroundLuminance =
      background[0] * 0.2126 + background[1] * 0.7152 + background[2] * 0.0722;

    const core = new Uint8Array(area);
    const fringe = new Uint8Array(area);

    for (let localY = 0; localY < cropHeight; localY += 1) {
      for (let localX = 0; localX < cropWidth; localX += 1) {
        const localIndex = localY * cropWidth + localX;
        const offset = ((top + localY) * imageWidth + left + localX) * 4;
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const distance =
          Math.abs(red - background[0]) +
          Math.abs(green - background[1]) +
          Math.abs(blue - background[2]);
        if (distance > 24 && luminance < backgroundLuminance - 6) core[localIndex] = 1;
        if (distance > 9 && luminance < backgroundLuminance - 2) fringe[localIndex] = 1;
      }
    }

    const visited = new Uint8Array(area);
    const accepted = new Uint8Array(area);
    const queue = new Int32Array(area);
    const originalX0 = originalLeft - left;
    const originalX1 = originalRight - left;

    for (let start = 0; start < area; start += 1) {
      if (!core[start] || visited[start]) continue;
      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      visited[start] = 1;
      let minimumX = cropWidth;
      let maximumX = -1;
      let minimumY = cropHeight;
      let maximumY = -1;

      while (head < tail) {
        const current = queue[head++];
        const currentY = Math.floor(current / cropWidth);
        const currentX = current - currentY * cropWidth;
        minimumX = Math.min(minimumX, currentX);
        maximumX = Math.max(maximumX, currentX);
        minimumY = Math.min(minimumY, currentY);
        maximumY = Math.max(maximumY, currentY);
        for (let dy = -1; dy <= 1; dy += 1) {
          const nextY = currentY + dy;
          if (nextY < 0 || nextY >= cropHeight) continue;
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            const nextX = currentX + dx;
            if (nextX < 0 || nextX >= cropWidth) continue;
            const next = nextY * cropWidth + nextX;
            if (!core[next] || visited[next]) continue;
            visited[next] = 1;
            queue[tail++] = next;
          }
        }
      }

      const componentLeft = minimumX;
      const componentRight = maximumX + 1;
      const componentWidth = componentRight - componentLeft;
      const componentHeight = maximumY - minimumY + 1;
      const closeToOcrBox =
        componentRight >= originalX0 - Math.round(cropHeight * 1.5) &&
        componentLeft <= originalX1 + Math.round(cropHeight * 1.5);
      if (
        closeToOcrBox &&
        !componentIsRule({
          width: componentWidth,
          height: componentHeight,
          bandHeight: cropHeight,
        })
      ) {
        for (let index = 0; index < tail; index += 1) accepted[queue[index]] = 1;
      }
    }

    const erase = new Uint8Array(area);
    for (let index = 0; index < area; index += 1) {
      if (!accepted[index]) continue;
      const y = Math.floor(index / cropWidth);
      const x = index - y * cropWidth;
      for (let dy = -1; dy <= 1; dy += 1) {
        const nextY = y + dy;
        if (nextY < 0 || nextY >= cropHeight) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const nextX = x + dx;
          if (nextX < 0 || nextX >= cropWidth) continue;
          const next = nextY * cropWidth + nextX;
          if (fringe[next]) erase[next] = 1;
        }
      }
    }

    for (let index = 0; index < area; index += 1) {
      if (!erase[index]) continue;
      const localY = Math.floor(index / cropWidth);
      const localX = index - localY * cropWidth;
      const offset = ((top + localY) * imageWidth + left + localX) * 4;
      data[offset] = background[0];
      data[offset + 1] = background[1];
      data[offset + 2] = background[2];
      maskedPixels += 1;
    }
    processedLines += 1;
  }

  return { maskedPixels, processedLines };
}
