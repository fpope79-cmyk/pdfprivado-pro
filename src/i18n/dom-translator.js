export const I18N_TEXT_ATTRIBUTE = "data-i18n";
export const I18N_ARIA_LABEL_ATTRIBUTE = "data-i18n-aria-label";
export const I18N_TITLE_ATTRIBUTE = "data-i18n-title";
export const I18N_PLACEHOLDER_ATTRIBUTE = "data-i18n-placeholder";
export const I18N_VALUE_ATTRIBUTE = "data-i18n-value";

const TRANSLATABLE_ATTRIBUTES = Object.freeze([
  ["aria-label", I18N_ARIA_LABEL_ATTRIBUTE],
  ["title", I18N_TITLE_ATTRIBUTE],
  ["placeholder", I18N_PLACEHOLDER_ATTRIBUTE],
  ["value", I18N_VALUE_ATTRIBUTE],
]);

const textBindings = new WeakMap();
const attributeBindings = new WeakMap();
const compiledPatternCache = new WeakMap();

function translateAttribute(element, attributeName, keyAttribute, t) {
  const key = element.getAttribute?.(keyAttribute);
  if (!key) return false;
  element.setAttribute(attributeName, t(key));
  return true;
}

function preserveOuterWhitespace(source, translated) {
  const leading = source.match(/^\s*/u)?.[0] || "";
  const trailing = source.match(/\s*$/u)?.[0] || "";
  return `${leading}${translated}${trailing}`;
}

function compilePattern(patternEntry) {
  let compiled = compiledPatternCache.get(patternEntry);

  if (!compiled) {
    try {
      compiled = new RegExp(patternEntry.pattern, "u");
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }

      compiled = new RegExp(patternEntry.pattern);
    }

    compiledPatternCache.set(patternEntry, compiled);
  }

  return compiled;
}

function resolveLegacyBinding(source, sourceTextKeys, sourceTextPatterns) {
  const normalized = String(source || "").trim();
  if (!normalized) return null;

  const exactKey = sourceTextKeys?.[normalized];
  if (exactKey) {
    return Object.freeze({
      key: exactKey,
      values: Object.freeze({}),
      defaultValue: normalized,
    });
  }

  for (const patternEntry of sourceTextPatterns || []) {
    const match = compilePattern(patternEntry).exec(normalized);
    if (!match) continue;
    const values = {};
    for (let index = 0; index < patternEntry.valueNames.length; index += 1) {
      values[patternEntry.valueNames[index]] = match[index + 1];
    }
    return Object.freeze({
      key: patternEntry.key,
      values: Object.freeze(values),
      defaultValue: normalized,
    });
  }

  return null;
}

function translateLegacyTextNode(node, t, sourceTextKeys, sourceTextPatterns) {
  const original = node?.nodeValue;
  if (typeof original !== "string") return false;

  let binding = textBindings.get(node);
  if (!binding) {
    binding = resolveLegacyBinding(original, sourceTextKeys, sourceTextPatterns);
    if (!binding) return false;
    textBindings.set(node, binding);
  }

  const translated = t(binding.key, binding.values, binding.defaultValue);
  const next = preserveOuterWhitespace(original, translated);
  if (next !== original) node.nodeValue = next;
  return true;
}

function getElementAttributeBindings(element) {
  let bindings = attributeBindings.get(element);
  if (!bindings) {
    bindings = new Map();
    attributeBindings.set(element, bindings);
  }
  return bindings;
}

function translateLegacyAttribute(
  element,
  attributeName,
  t,
  sourceTextKeys,
  sourceTextPatterns,
) {
  const original = element.getAttribute?.(attributeName);
  if (!original) return false;

  const bindings = getElementAttributeBindings(element);
  let binding = bindings.get(attributeName);
  if (!binding) {
    binding = resolveLegacyBinding(
      original,
      sourceTextKeys,
      sourceTextPatterns,
    );
    if (!binding) return false;
    bindings.set(attributeName, binding);
  }

  const translated = t(binding.key, binding.values, binding.defaultValue);
  if (translated !== original) {
    element.setAttribute(attributeName, translated);
  }
  return true;
}

export function applyDocumentTranslations({
  root = globalThis.document,
  t,
  sourceTextKeys = null,
  sourceTextPatterns = null,
} = {}) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return Object.freeze({
      text: 0,
      ariaLabel: 0,
      title: 0,
      placeholder: 0,
      value: 0,
      legacyText: 0,
      legacyAttribute: 0,
    });
  }
  if (typeof t !== "function") {
    throw new TypeError("A translation function is required.");
  }

  const counts = {
    text: 0,
    ariaLabel: 0,
    title: 0,
    placeholder: 0,
    value: 0,
    legacyText: 0,
    legacyAttribute: 0,
  };

  for (const element of root.querySelectorAll(`[${I18N_TEXT_ATTRIBUTE}]`)) {
    const key = element.getAttribute(I18N_TEXT_ATTRIBUTE);
    if (!key) continue;
    element.textContent = t(key);
    counts.text += 1;
  }

  for (const [attributeName, keyAttribute] of TRANSLATABLE_ATTRIBUTES) {
    for (const element of root.querySelectorAll(`[${keyAttribute}]`)) {
      if (translateAttribute(element, attributeName, keyAttribute, t)) {
        if (attributeName === "aria-label") counts.ariaLabel += 1;
        else counts[attributeName] += 1;
      }
    }
  }

  if (
    (sourceTextKeys || sourceTextPatterns) &&
    typeof root.createTreeWalker === "function"
  ) {
    const NodeFilterRef = root.defaultView?.NodeFilter || globalThis.NodeFilter;
    const walker = root.createTreeWalker(
      root.body || root.documentElement || root,
      NodeFilterRef?.SHOW_TEXT ?? 4,
    );
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      const tag = parent?.tagName?.toLowerCase();
      if (!["script", "style", "noscript", "template"].includes(tag)) {
        if (
          translateLegacyTextNode(
            node,
            t,
            sourceTextKeys,
            sourceTextPatterns,
          )
        ) {
          counts.legacyText += 1;
        }
      }
      node = walker.nextNode();
    }

    for (const element of root.querySelectorAll(
      "[aria-label], [title], [placeholder], input[type='button'][value], input[type='submit'][value]",
    )) {
      for (const attributeName of ["aria-label", "title", "placeholder", "value"]) {
        if (
          element.hasAttribute(attributeName) &&
          translateLegacyAttribute(
            element,
            attributeName,
            t,
            sourceTextKeys,
            sourceTextPatterns,
          )
        ) {
          counts.legacyAttribute += 1;
        }
      }
    }
  }

  return Object.freeze({ ...counts });
}

export function observeDocumentTranslations({
  root = globalThis.document,
  t,
  sourceTextKeys = null,
  sourceTextPatterns = null,
} = {}) {
  const MutationObserverRef =
    root?.defaultView?.MutationObserver || globalThis.MutationObserver;
  if (!root || typeof MutationObserverRef !== "function") {
    return Object.freeze({ disconnect() {} });
  }

  let scheduled = false;
  const apply = () => {
    scheduled = false;
    applyDocumentTranslations({
      root,
      t,
      sourceTextKeys,
      sourceTextPatterns,
    });
  };
  const observer = new MutationObserverRef(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(apply);
  });
  observer.observe(root.documentElement || root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "aria-label",
      "title",
      "placeholder",
      "value",
      I18N_TEXT_ATTRIBUTE,
      I18N_ARIA_LABEL_ATTRIBUTE,
      I18N_TITLE_ATTRIBUTE,
      I18N_PLACEHOLDER_ATTRIBUTE,
      I18N_VALUE_ATTRIBUTE,
    ],
  });
  return observer;
}
