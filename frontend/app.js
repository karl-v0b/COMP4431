(() => {
  const messagesEl = document.getElementById("messages");
  const formEl = document.getElementById("chat-form");
  const inputEl = document.getElementById("input");
  const sendEl = document.getElementById("send");
  const statusEl = document.getElementById("status");
  const pdfInputEl = document.getElementById("pdf-input");
  const clearDocsEl = document.getElementById("clear-docs");
  const ingestStatusEl = document.getElementById("ingest-status");
  const docListEl = document.getElementById("doc-list");

  /** @type {{role: string, content: string}[]} */
  const history = [];
  const MAX_HISTORY = 12;
  let thinkingEl = null;

  if (window.marked && typeof marked.setOptions === "function") {
    marked.setOptions({
      gfm: true,
      breaks: true,
    });
  }

  function renderContent(bodyEl, role, content) {
    const useMarkdown = role === "assistant" && window.marked;
    if (useMarkdown) {
      bodyEl.className = "body markdown";
      bodyEl.innerHTML = marked.parse(content);
    } else {
      bodyEl.className = "body";
      bodyEl.textContent = content;
    }
  }

  function addCopyButton(wrap, content) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(content);
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy";
        }, 1200);
      } catch {
        const area = document.createElement("textarea");
        area.value = content;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.select();
        try {
          document.execCommand("copy");
          btn.textContent = "Copied";
          setTimeout(() => {
            btn.textContent = "Copy";
          }, 1200);
        } catch {
          btn.textContent = "Failed";
          setTimeout(() => {
            btn.textContent = "Copy";
          }, 1200);
        }
        document.body.removeChild(area);
      }
    });
    wrap.appendChild(btn);
  }

  function formatSourcesLabel(sources) {
    const names = (sources || []).filter(Boolean);
    if (!names.length) return "";
    if (names.length === 1) return `PDF: ${names[0]}`;
    return `PDF: ${names.join(", ")}`;
  }

  function addSourcesLabel(wrap, sources) {
    const label = formatSourcesLabel(sources);
    if (!label) return;
    let refEl = wrap.querySelector(".pdf-ref");
    if (!refEl) {
      refEl = document.createElement("div");
      refEl.className = "pdf-ref";
      const body = wrap.querySelector(".body");
      if (body && body.nextSibling) {
        wrap.insertBefore(refEl, body.nextSibling);
      } else {
        wrap.appendChild(refEl);
      }
    }
    refEl.textContent = label;
  }

  function appendMessage(role, content, className, sources) {
    const wrap = document.createElement("div");
    wrap.className = `message ${className || role}`;

    const roleEl = document.createElement("span");
    roleEl.className = "role";
    roleEl.textContent = role === "user" ? "You" : role === "assistant" ? "Tutor" : "Error";

    const body = document.createElement("div");
    renderContent(body, role, content);

    wrap.appendChild(roleEl);
    wrap.appendChild(body);
    addSourcesLabel(wrap, sources);

    if (role === "assistant") {
      const actions = document.createElement("div");
      actions.className = "actions";
      addCopyButton(actions, content);
      wrap.appendChild(actions);
    }

    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function showThinking() {
    hideThinking();
    const wrap = document.createElement("div");
    wrap.className = "message assistant thinking";
    wrap.id = "thinking-message";

    const roleEl = document.createElement("span");
    roleEl.className = "role";
    roleEl.textContent = "Tutor";

    const body = document.createElement("div");
    body.className = "body thinking-body";
    body.innerHTML =
      '<span class="thinking-label">Thinking</span>' +
      '<span class="thinking-dots" aria-hidden="true">' +
      '<span></span><span></span><span></span>' +
      "</span>";

    wrap.appendChild(roleEl);
    wrap.appendChild(body);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    thinkingEl = wrap;
  }

  function hideThinking() {
    if (thinkingEl && thinkingEl.parentNode) {
      thinkingEl.parentNode.removeChild(thinkingEl);
    }
    thinkingEl = null;
    const leftover = document.getElementById("thinking-message");
    if (leftover) leftover.remove();
  }

  function setBusy(busy) {
    sendEl.disabled = busy;
    inputEl.disabled = busy;
    pdfInputEl.disabled = busy;
    clearDocsEl.disabled = busy;
  }

  function setPdfStatus(text, isError) {
    ingestStatusEl.textContent = text || "";
    ingestStatusEl.className = isError ? "ingest-status error" : "ingest-status";
  }

  function renderDocuments(documents, options) {
    const opts = options || {};
    const docs = documents || [];
    const count = docs.length;

    docListEl.innerHTML = "";
    if (!count) {
      const li = document.createElement("li");
      li.textContent = "No PDF Loaded";
      docListEl.appendChild(li);
    } else {
      for (const doc of docs) {
        const li = document.createElement("li");
        li.textContent = `${doc.filename} Loaded`;
        docListEl.appendChild(li);
      }
    }

    if (opts.statusText != null) {
      setPdfStatus(opts.statusText, !!opts.isError);
      return;
    }

    if (opts.ingest && opts.ingest.stage === "error") {
      setPdfStatus(opts.ingest.detail || "Upload failed.", true);
      return;
    }

    if (count === 0) {
      setPdfStatus("", false);
    } else {
      setPdfStatus(`${count} PDF is Loaded`, false);
    }
  }

  async function refreshDocuments() {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      renderDocuments(data.documents || [], { ingest: data.ingest });
    } catch {
      setPdfStatus("Could not load PDF list.", true);
    }
  }

  async function refreshHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      // Keep header quiet for normal use; only surface failures.
      if (data.ok) {
        statusEl.textContent = "";
        statusEl.hidden = true;
        statusEl.className = "status";
      } else {
        statusEl.hidden = false;
        statusEl.textContent = data.detail || "Model not ready.";
        statusEl.className = "status error";
      }
      if (data.rag) {
        renderDocuments(data.rag.documents || [], { ingest: data.rag.ingest });
      }
    } catch {
      statusEl.hidden = false;
      statusEl.textContent = "Cannot reach local server.";
      statusEl.className = "status error";
    }
  }

  pdfInputEl.addEventListener("change", async () => {
    const file = pdfInputEl.files && pdfInputEl.files[0];
    pdfInputEl.value = "";
    if (!file) return;

    setBusy(true);
    setPdfStatus("Loading PDF…", false);

    const body = new FormData();
    body.append("file", file, file.name);

    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail || `Upload failed (${res.status})`;
        setPdfStatus(detail, true);
        await refreshDocuments();
        return;
      }
      const docs = data.documents || [];
      renderDocuments(docs, {
        statusText: `${docs.length} PDF is Loaded`,
      });
    } catch {
      setPdfStatus("Upload failed.", true);
    } finally {
      setBusy(false);
      inputEl.focus();
    }
  });

  clearDocsEl.addEventListener("click", async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/documents", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPdfStatus(data.detail || "Could not clear PDF.", true);
        return;
      }
      renderDocuments([], { statusText: "All PDF is Cleared" });
    } catch {
      setPdfStatus("Could not clear PDF.", true);
    } finally {
      setBusy(false);
    }
  });

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = inputEl.value.trim();
    if (!message) return;

    const userMsgEl = appendMessage("user", message);
    inputEl.value = "";
    setBusy(true);
    showThinking();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: history.slice(-MAX_HISTORY),
        }),
      });

      const data = await res.json().catch(() => ({}));
      hideThinking();
      if (!res.ok) {
        const detail = data.detail || `Request failed (${res.status})`;
        appendMessage("error", detail, "error");
        return;
      }

      const reply = data.reply || "";
      const sources = data.sources || [];
      addSourcesLabel(userMsgEl, sources);
      appendMessage("assistant", reply, "assistant", sources);
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: reply });
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
      }
    } catch {
      hideThinking();
      appendMessage(
        "error",
        "Could not reach the local server. Is the app still running?",
        "error"
      );
    } finally {
      setBusy(false);
      inputEl.focus();
    }
  });

  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formEl.requestSubmit();
    }
  });

  refreshHealth();
  refreshDocuments();
  inputEl.focus();
})();
