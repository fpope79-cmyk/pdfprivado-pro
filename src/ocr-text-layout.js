function median(values) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function normalizedWord(word) {
  const text = String(word?.text || "").trim();
  const bbox = word?.bbox || {};
  const x0 = Number(bbox.x0) || 0;
  const y0 = Number(bbox.y0) || 0;
  const x1 = Number(bbox.x1) || x0;
  const y1 = Number(bbox.y1) || y0;

  return {
    text,
    x0,
    y0,
    x1,
    y1,
    width: Math.max(0, x1 - x0),
    height: Math.max(1, y1 - y0),
    centerY: (y0 + y1) / 2,
  };
}

function joinLineWords(words) {
  return words
    .map((word) => word.text)
    .join(" ")
    .replace(/\s+([,.;:!?%)\]])/gu, "$1")
    .replace(/([¿¡([€$])\s+/gu, "$1");
}

export function groupOcrWordsIntoLines(words = []) {
  const normalized = words
    .map(normalizedWord)
    .filter((word) => word.text && word.width >= 0);

  if (!normalized.length) return [];

  const medianHeight = Math.max(
    1,
    median(normalized.map((word) => word.height))
  );
  const tolerance = Math.max(3, medianHeight * 0.48);
  const lines = [];

  for (const word of normalized.sort(
    (a, b) => a.centerY - b.centerY || a.x0 - b.x0
  )) {
    let best = null;
    let bestDistance = Infinity;

    for (const line of lines) {
      const distance = Math.abs(line.centerY - word.centerY);
      if (distance <= tolerance && distance < bestDistance) {
        best = line;
        bestDistance = distance;
      }
    }

    if (!best) {
      best = {
        words: [],
        centerY: word.centerY,
        minY: word.y0,
        maxY: word.y1,
      };
      lines.push(best);
    }

    best.words.push(word);
    best.centerY =
      best.words.reduce((sum, item) => sum + item.centerY, 0) /
      best.words.length;
    best.minY = Math.min(best.minY, word.y0);
    best.maxY = Math.max(best.maxY, word.y1);
  }

  return lines
    .sort((a, b) => a.centerY - b.centerY)
    .map((line) => {
      const orderedWords = [...line.words].sort((a, b) => a.x0 - b.x0);
      return {
        ...line,
        words: orderedWords,
        minX: orderedWords[0]?.x0 || 0,
        maxX: orderedWords.at(-1)?.x1 || 0,
        text: joinLineWords(orderedWords),
      };
    });
}

function shouldJoinHyphenated(lineText, nextLineText) {
  const current = String(lineText || "").trim();
  const next = String(nextLineText || "").trim();

  if (!/[\p{L}]-$/u.test(current)) return false;
  if (!/^[\p{Ll}áéíóúüñç]/u.test(next)) return false;
  if (/^\s*[-–—•]/u.test(next)) return false;

  const previousWord = current.split(/\s+/u).at(-1) || "";
  return previousWord.length > 2;
}

function splitFirstWord(lineText) {
  const match = String(lineText || "").match(/^(\S+)(?:\s+(.*))?$/u);
  return {
    first: match?.[1] || "",
    rest: match?.[2] || "",
  };
}

function likelyParagraphBreak(line, nextLine, typicalGap) {
  if (!line || !nextLine) return true;

  const gap = Math.max(0, nextLine.minY - line.maxY);
  if (gap > typicalGap * 1.75) return true;
  if (/[:.!?]\s*$/u.test(line.text) && gap > typicalGap * 1.2) return true;
  if (/^\s*(?:[-–—•]|\d+[.)]|[A-ZÁÉÍÓÚÜÑ]{2,})/u.test(nextLine.text)) {
    return true;
  }

  return false;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function quantizedIndent(line, pageWidth, leftEdge) {
  const usableWidth = Math.max(1, pageWidth - leftEdge);
  const ratio = clamp((line.minX - leftEdge) / usableWidth, 0, 1);

  if (ratio < 0.07) return 0;
  if (ratio < 0.15) return 2;
  if (ratio < 0.24) return 4;
  if (ratio < 0.34) return 6;
  return 8;
}

function looksCentered(line, pageWidth) {
  const lineWidth = Math.max(1, line.maxX - line.minX);
  const lineCenter = (line.minX + line.maxX) / 2;
  const pageCenter = pageWidth / 2;
  const centerTolerance = pageWidth * 0.08;
  const widthRatio = lineWidth / pageWidth;

  return (
    Math.abs(lineCenter - pageCenter) <= centerTolerance &&
    widthRatio < 0.72
  );
}

function looksLikeHeading(line) {
  const text = line.text.trim();
  if (!text) return false;

  const letters = [...text].filter((char) => /\p{L}/u.test(char));
  const uppercase = letters.filter(
    (char) => char === char.toUpperCase()
  );

  const uppercaseRatio = letters.length
    ? uppercase.length / letters.length
    : 0;

  return (
    uppercaseRatio >= 0.82 ||
    /^(?:TÍTULO|EXPONEN|PRIMERO|SEGUNDO|TERCERO|COMPARECEN|COMPRAVENTA)\b/u.test(
      text
    )
  );
}

function reconstructOriginal(lines, record) {
  if (!lines.length) return "";

  const measuredWidth = Math.max(
    Number(record?.imageWidth) || 0,
    ...lines.map((line) => line.maxX)
  );
  const pageWidth = Math.max(1, measuredWidth);
  const leftEdge = Math.min(...lines.map((line) => line.minX));
  const typicalHeight = Math.max(
    1,
    median(lines.map((line) => Math.max(1, line.maxY - line.minY)))
  );

  const verticalGaps = [];
  for (let index = 1; index < lines.length; index += 1) {
    verticalGaps.push(
      Math.max(0, lines[index].minY - lines[index - 1].maxY)
    );
  }
  const typicalGap = Math.max(
    1,
    median(verticalGaps.filter((gap) => gap > 0)) || typicalHeight * 0.45
  );

  const output = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const previous = lines[index - 1];

    if (previous) {
      const gap = Math.max(0, line.minY - previous.maxY);
      if (gap > Math.max(typicalHeight * 1.25, typicalGap * 1.9)) {
        output.push("");
      }
    }

    const text = line.text.trim();
    if (!text) continue;

    let indent = quantizedIndent(line, pageWidth, leftEdge);

    if (looksCentered(line, pageWidth)) {
      indent = looksLikeHeading(line) ? 8 : 6;
    }

    output.push(`${" ".repeat(indent)}${text}`);
  }

  return output
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trimEnd();
}

function reconstructCleanLines(lines) {
  const output = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index].text.trim();
    const next = lines[index + 1]?.text.trim() || "";

    if (!current) continue;

    if (next && shouldJoinHyphenated(current, next)) {
      const { first, rest } = splitFirstWord(next);
      const joined = `${current.slice(0, -1)}${first}`;
      output.push(rest ? `${joined} ${rest}`.trim() : joined);
      index += 1;
      continue;
    }

    output.push(current);
  }

  return output.join("\n");
}

function reconstructContinuous(lines) {
  if (!lines.length) return "";

  const gaps = [];
  for (let index = 1; index < lines.length; index += 1) {
    gaps.push(
      Math.max(0, lines[index].minY - lines[index - 1].maxY)
    );
  }

  const positiveGaps = gaps.filter((gap) => gap > 0);
  const typicalGap = Math.max(1, median(positiveGaps));
  const paragraphs = [];
  let paragraph = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] || null;
    let text = line.text.trim();

    if (!text) continue;

    if (nextLine && shouldJoinHyphenated(text, nextLine.text)) {
      const { first, rest } = splitFirstWord(nextLine.text);
      text = `${text.slice(0, -1)}${first}`;
      paragraph += (paragraph ? " " : "") + text;

      if (rest) paragraph += ` ${rest}`;
      index += 1;

      const followingLine = lines[index + 1] || null;
      if (
        !followingLine ||
        likelyParagraphBreak(nextLine, followingLine, typicalGap)
      ) {
        paragraphs.push(paragraph.trim());
        paragraph = "";
      }

      continue;
    }

    paragraph += (paragraph ? " " : "") + text;

    if (likelyParagraphBreak(line, nextLine, typicalGap)) {
      paragraphs.push(paragraph.trim());
      paragraph = "";
    }
  }

  if (paragraph.trim()) paragraphs.push(paragraph.trim());
  return paragraphs.join("\n\n");
}

export function reconstructOcrText(record, mode = "continuous") {
  const fallback = String(record?.text || "").trim();
  const lines = groupOcrWordsIntoLines(record?.words || []);

  if (!lines.length) return fallback;
  if (mode === "original") return reconstructOriginal(lines, record);
  if (mode === "clean-lines") return reconstructCleanLines(lines);
  return reconstructContinuous(lines);
}
