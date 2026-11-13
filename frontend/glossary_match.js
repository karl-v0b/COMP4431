(() => {
  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Efficient Fast Check: longest glossary match inside the selection (O(terms)).
   * @param {string} selectedText
   * @param {{ byKey: Map<string, {display: string, def: string}>, keysLongestFirst: string[] }} glossary
   */
  function identifyTerm(selectedText, glossary) {
    if (!glossary || !glossary.keysLongestFirst || !glossary.byKey) return null;
    const hay = normalize(selectedText);
    if (hay.length < 2) return null;

    for (const key of glossary.keysLongestFirst) {
      if (key.length > hay.length) continue;

      if (key.length <= 3) {
        const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(key)}(?:[^a-z0-9]|$)`, "i");
        if (!re.test(hay)) continue;
      } else if (hay !== key && !hay.includes(key)) {
        continue;
      }

      const hit = glossary.byKey.get(key);
      if (hit) return { key, display: hit.display, def: hit.def };
    }
    return null;
  }

  window.AI_TUTOR_NORMALIZE = normalize;
  window.AI_TUTOR_IDENTIFY_TERM = identifyTerm;
})();
