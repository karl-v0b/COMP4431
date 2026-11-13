(() => {
  const messagesEl = document.getElementById("messages");
  if (!messagesEl) return;

  const glossary = window.AI_TUTOR_GLOSSARY;
  const identifyTermFn = window.AI_TUTOR_IDENTIFY_TERM;
  if (!glossary || !glossary.keysLongestFirst || typeof identifyTermFn !== "function") return;

  const popup = document.createElement("div");
  popup.id = "fastcheck-popup";
  popup.className = "fastcheck-popup";
  popup.hidden = true;
  popup.setAttribute("role", "tooltip");
  document.body.appendChild(popup);

  let hideTimer = null;

  /** Efficient Fast Check: longest glossary match (local, no Ollama). */
  function identifyTerm(selectedText) {
    return identifyTermFn(selectedText, glossary);
  }

  function selectionInsideAssistantBody() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;

    const text = sel.toString();
    if (!text || !text.trim()) return null;

    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el) return null;

    const body = el.closest(".message.assistant .body");
    if (!body || !messagesEl.contains(body)) return null;
    // Ignore thinking placeholder
    if (body.closest(".thinking")) return null;

    return { text: text.trim(), range };
  }

  function placePopup(range) {
    const rect = range.getBoundingClientRect();
    const pad = 8;
    const width = Math.min(320, window.innerWidth - 16);
    popup.style.width = `${width}px`;

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

    // Prefer above the selection; flip below if needed.
    popup.hidden = false;
    const height = popup.offsetHeight || 120;
    let top = rect.top - height - pad;
    if (top < 8) top = rect.bottom + pad;
    top = Math.max(8, Math.min(top, window.innerHeight - height - 8));

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  }

  function showPopup(term, range) {
    popup.innerHTML = "";
    const title = document.createElement("div");
    title.className = "fastcheck-term";
    title.textContent = term.display;

    const body = document.createElement("div");
    body.className = "fastcheck-def";
    body.textContent = term.def;

    const hint = document.createElement("div");
    hint.className = "fastcheck-hint";
    hint.textContent = "Fast Check";

    popup.appendChild(hint);
    popup.appendChild(title);
    popup.appendChild(body);
    placePopup(range);
  }

  function hidePopup() {
    popup.hidden = true;
    popup.innerHTML = "";
  }

  function refresh() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    const sel = selectionInsideAssistantBody();
    if (!sel) {
      hidePopup();
      return;
    }
    const term = identifyTerm(sel.text);
    if (!term) {
      hidePopup();
      return;
    }
    showPopup(term, sel.range);
  }

  // mouseup: selection finished after click-drag highlight
  messagesEl.addEventListener("mouseup", () => {
    // Defer so the browser finishes updating the Selection
    hideTimer = setTimeout(refresh, 0);
  });

  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      hidePopup();
      return;
    }
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(refresh, 40);
  });

  document.addEventListener(
    "mousedown",
    (event) => {
      if (popup.hidden) return;
      if (popup.contains(event.target)) return;
      // New click elsewhere clears highlight → hide on next selectionchange / mouseup
      hidePopup();
    },
    true
  );

  window.addEventListener(
    "scroll",
    () => {
      if (!popup.hidden) hidePopup();
    },
    true
  );

  window.addEventListener("resize", () => {
    if (!popup.hidden) hidePopup();
  });
})();
