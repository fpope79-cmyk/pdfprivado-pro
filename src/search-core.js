const DEFAULT_CONTEXT = 58;

function normalizeCharacter(value) {
  if (value === "\u00ad") return "";
  if (/[\u00a0\u2007\u202f\s]/u.test(value)) return " ";
  return value;
}

function appendNormalizedCharacter(target, value, owner = null) {
  const character = normalizeCharacter(value);
  if (!character) return;

  if (character === " ") {
    if (!target.text || target.pendingSpace) return;
    target.pendingSpace = true;
    return;
  }

  if (target.pendingSpace && target.text) {
    target.text += " ";
    target.owners.push(null);
  }
  target.pendingSpace = false;
  target.text += character;
  target.owners.push(owner);
}

export function normalizeExtractedText(value) {
  return String(value ?? "")
    .replace(/\u00ad/g, "")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchCharacterMap(items = []) {
  const target = { text: "", owners: [], pendingSpace: false };

  items.forEach((item, itemIndex) => {
    const value = String(item?.str ?? "");
    for (let charIndex = 0; charIndex < value.length; charIndex += 1) {
      appendNormalizedCharacter(target, value[charIndex], { itemIndex, charIndex });
    }
    appendNormalizedCharacter(target, item?.hasEOL ? "\n" : " ", null);
  });

  return { text: target.text, owners: target.owners };
}

export function textItemsToString(items = []) {
  return buildSearchCharacterMap(items).text;
}

export function locateSearchItemRanges(items = [], start = 0, length = 0) {
  const mapped = buildSearchCharacterMap(items);
  const safeStart = Math.max(0, Math.min(mapped.text.length, Number(start) || 0));
  const safeEnd = Math.max(safeStart, Math.min(mapped.text.length, safeStart + Math.max(0, Number(length) || 0)));
  const ranges = new Map();

  for (let index = safeStart; index < safeEnd; index += 1) {
    const owner = mapped.owners[index];
    if (!owner || !Number.isInteger(owner.itemIndex)) continue;
    const current = ranges.get(owner.itemIndex) || {
      itemIndex: owner.itemIndex,
      startChar: owner.charIndex,
      endChar: owner.charIndex + 1,
    };
    current.startChar = Math.min(current.startChar, owner.charIndex);
    current.endChar = Math.max(current.endChar, owner.charIndex + 1);
    ranges.set(owner.itemIndex, current);
  }

  return {
    text: mapped.text,
    ranges: [...ranges.values()].sort((a, b) => a.itemIndex - b.itemIndex),
  };
}

export function foldSearchText(value) {
  return normalizeExtractedText(value).toLowerCase();
}

export function findSearchMatches(haystack, needle, limit = Number.POSITIVE_INFINITY) {
  const text = String(haystack ?? "");
  const query = String(needle ?? "");
  const boundedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : Number.POSITIVE_INFINITY;
  const indices = [];
  let total = 0;

  if (!query) return { indices, total, truncated: false };

  let from = 0;
  while (from <= text.length - query.length) {
    const index = text.indexOf(query, from);
    if (index < 0) break;
    total += 1;
    if (indices.length < boundedLimit) indices.push(index);
    from = index + Math.max(1, query.length);
  }

  return {
    indices,
    total,
    truncated: total > indices.length,
  };
}

export function buildSearchSnippet(text, start, length, context = DEFAULT_CONTEXT) {
  const source = String(text ?? "");
  const safeStart = Math.max(0, Math.min(source.length, Number(start) || 0));
  const safeLength = Math.max(0, Number(length) || 0);
  const radius = Math.max(20, Number(context) || DEFAULT_CONTEXT);
  const from = Math.max(0, safeStart - radius);
  const to = Math.min(source.length, safeStart + safeLength + radius);

  return {
    before: `${from > 0 ? "…" : ""}${source.slice(from, safeStart)}`,
    match: source.slice(safeStart, safeStart + safeLength),
    after: `${source.slice(safeStart + safeLength, to)}${to < source.length ? "…" : ""}`,
  };
}
