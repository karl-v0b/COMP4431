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

  const modeSelectorEl = document.getElementById("learning-mode");
  const langSelectorEl = document.getElementById("language-select");
  const emojiFallback = document.getElementById("avatar-fallback");
  const muteBtnEl = document.getElementById("mute-btn");

  const openQuickQuizBtn = document.getElementById("open-quick-quiz-btn");
  const closeQuickQuizBtn = document.getElementById("close-quick-quiz-btn");
  const quickQuizModal = document.getElementById("quick-quiz-modal");
  const quickQuizTopicEl = document.getElementById("quick-quiz-topic");
  const quickQuizScopeEl = document.getElementById("quick-quiz-scope");
  const quickQuizLanguageEl = document.getElementById("quick-quiz-language");
  const quickQuizBtnEl = document.getElementById("quick-quiz-btn");
  const quickQuizResultEl = document.getElementById("quick-quiz-result");

  const breakBtnEl = document.getElementById("break-btn");
  const toastContainer = document.getElementById("toast-container");

  const history = [];
  const MAX_HISTORY = 12;
  let thinkingEl = null;
  let isMuted = false;

  if (window.marked && typeof marked.setOptions === "function") {
    marked.setOptions({ gfm: true, breaks: true });
  }

  const selfCareMessages = [
    { icon: "💧", title: "Time for a sip of water!", text: "Staying hydrated helps your brain process those neural networks better. Take a quick sip." },
    { icon: "👀", title: "Rest your eyes", text: "You've been staring at the screen for a while. Look 20 feet away for 20 seconds to reduce eye strain." },
    { icon: "🧘", title: "Quick stretch", text: "Roll your shoulders back and take a deep breath. A relaxed mind learns faster." },
    { icon: "🍎", title: "Healthy snack time", text: "Doing deep dives burns calories. Maybe grab a quick healthy snack before the next topic?" },
  ];

  function showToast() {
    const msg = selfCareMessages[Math.floor(Math.random() * selfCareMessages.length)];
    const toast = document.createElement("div");
    toast.className = "custom-toast";
    toast.innerHTML = `
      <div class="toast-icon">${msg.icon}</div>
      <div class="toast-content">
        <h4>${msg.title}</h4>
        <p>${msg.text}</p>
      </div>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("hiding");
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  if (breakBtnEl) breakBtnEl.addEventListener("click", showToast);
  setInterval(showToast, 900000);

  if (openQuickQuizBtn) {
    openQuickQuizBtn.addEventListener("click", () => {
      quickQuizModal.classList.add("active");
      quickQuizTopicEl.focus();
    });
  }
  if (closeQuickQuizBtn) {
    closeQuickQuizBtn.addEventListener("click", () => {
      quickQuizModal.classList.remove("active");
    });
  }
  if (quickQuizModal) {
    quickQuizModal.addEventListener("click", (e) => {
      if (e.target === quickQuizModal) quickQuizModal.classList.remove("active");
    });
  }

  if (muteBtnEl) {
    muteBtnEl.addEventListener("click", () => {
      isMuted = !isMuted;
      if (isMuted) {
        muteBtnEl.textContent = "🔇 Audio OFF";
        muteBtnEl.style.color = "#dc2626";
        window.speechSynthesis.cancel();
      } else {
        muteBtnEl.textContent = "🔊 Audio ON";
        muteBtnEl.style.color = "inherit";
      }
    });
  }

  function setAvatar(state) {
    if (!emojiFallback) return;
    emojiFallback.style.display = "flex";
    if (state === "thinking") {
      emojiFallback.textContent = "🤔";
      emojiFallback.style.animation = "pulse 1s infinite";
    } else if (state === "speaking") {
      emojiFallback.textContent = "🗣️";
      emojiFallback.style.animation = "bounce 0.5s infinite";
    } else {
      emojiFallback.textContent = "🤖";
      emojiFallback.style.animation = "none";
    }
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

  function addCopyButton(actionsEl, getContent) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      const content = typeof getContent === "function" ? getContent() : getContent;
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
    actionsEl.appendChild(btn);
  }

  function addSummaryToggle(actionsEl, bodyEl, fullText, summaryText) {
    const summary = (summaryText || "").trim();
    const full = (fullText || "").trim();
    if (!summary || summary === full) return;

    let showingSummary = false;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "summary-btn";
    btn.textContent = "Summary";
    btn.addEventListener("click", () => {
      showingSummary = !showingSummary;
      const next = showingSummary ? summary : full;
      renderContent(bodyEl, "assistant", next);
      bodyEl.dataset.activeText = next;
      btn.textContent = showingSummary ? "Full" : "Summary";
    });
    actionsEl.appendChild(btn);
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

  function appendMessage(role, content, className, sources, summary) {
    const wrap = document.createElement("div");
    wrap.className = `message ${className || role}`;
    const roleEl = document.createElement("span");
    roleEl.className = "role";
    roleEl.textContent = role === "user" ? "You" : role === "assistant" ? "Tutor" : "Error";
    const body = document.createElement("div");
    renderContent(body, role, content);
    body.dataset.activeText = content;

    wrap.appendChild(roleEl);
    wrap.appendChild(body);
    addSourcesLabel(wrap, sources);

    if (role === "assistant") {
      const actions = document.createElement("div");
      actions.className = "actions";
      addSummaryToggle(actions, body, content, summary);
      addCopyButton(actions, () => body.dataset.activeText || content);
      wrap.appendChild(actions);
    }

    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function showThinking(label) {
    hideThinking();
    setAvatar("thinking");
    const wrap = document.createElement("div");
    wrap.className = "message assistant thinking";
    wrap.id = "thinking-message";
    const roleEl = document.createElement("span");
    roleEl.className = "role";
    roleEl.textContent = "Tutor";
    const body = document.createElement("div");
    body.className = "body thinking-body";
    const labelText = label || "Working";
    body.innerHTML =
      '<span class="thinking-label"></span>' +
      '<span class="thinking-dots" aria-hidden="true">' +
      "<span></span><span></span><span></span>" +
      "</span>";
    body.querySelector(".thinking-label").textContent = labelText;
    wrap.appendChild(roleEl);
    wrap.appendChild(body);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    thinkingEl = wrap;
  }

  function setThinkingLabel(label) {
    if (!thinkingEl) return;
    const labelEl = thinkingEl.querySelector(".thinking-label");
    if (labelEl && label) labelEl.textContent = label;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideThinking() {
    setAvatar("idle");
    if (thinkingEl && thinkingEl.parentNode) {
      thinkingEl.parentNode.removeChild(thinkingEl);
    }
    thinkingEl = null;
    const leftover = document.getElementById("thinking-message");
    if (leftover) leftover.remove();
  }

  function formatDetail(detail, fallback) {
    if (detail == null || detail === "") return fallback || "Request failed.";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            return item.msg || item.message || item.detail || JSON.stringify(item);
          }
          return String(item);
        })
        .filter(Boolean)
        .join("; ");
    }
    if (typeof detail === "object") {
      if (typeof detail.msg === "string") return detail.msg;
      if (typeof detail.message === "string") return detail.message;
      if (typeof detail.detail === "string") return detail.detail;
      try {
        return JSON.stringify(detail);
      } catch {
        return fallback || "Request failed.";
      }
    }
    return String(detail);
  }

  function applyChatEvent(event, state) {
    if (!event || typeof event !== "object") return;
    if (event.type === "stage") {
      setThinkingLabel(event.label || "Working");
      return;
    }
    if (event.type === "error") {
      throw new Error(formatDetail(event.detail, "Request failed."));
    }
    if (event.type === "result" || (typeof event.reply === "string" && !event.type)) {
      state.result = event;
    }
  }

  async function readChatStream(response) {
    if (!response.body) {
      throw new Error("Streaming is not available in this browser.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let raw = "";
    const state = { result: null };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      raw += chunk;
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        let event;
        try {
          event = JSON.parse(trimmed);
        } catch {
          continue;
        }
        applyChatEvent(event, state);
      }
    }

    const leftover = buffer.trim();
    if (leftover && !leftover.startsWith("#")) {
      try {
        applyChatEvent(JSON.parse(leftover), state);
      } catch {
        // ignore incomplete trailing data
      }
    }

    if (!state.result || typeof state.result.reply !== "string") {
      try {
        applyChatEvent(JSON.parse(raw.trim()), state);
      } catch {
        // ignore
      }
    }

    if (!state.result || typeof state.result.reply !== "string") {
      throw new Error(
        "The server did not return a complete answer. Hard-refresh the page and try again."
      );
    }
    return state.result;
  }

  function setBusy(busy) {
    sendEl.disabled = busy;
    inputEl.disabled = busy;
    if (pdfInputEl) pdfInputEl.disabled = busy;
    if (clearDocsEl) clearDocsEl.disabled = busy;
    if (quickQuizBtnEl) quickQuizBtnEl.disabled = busy;
  }

  function setPdfStatus(text, isError) {
    if (!ingestStatusEl) return;
    ingestStatusEl.textContent = text || "";
    ingestStatusEl.className = isError ? "ingest-status error" : "ingest-status";
  }

  function renderDocuments(documents, options) {
    if (!docListEl) return;
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

  if (pdfInputEl) {
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
  }

  if (clearDocsEl) {
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
  }

  function speakReply(text, lang) {
    if (isMuted) return;
    if ("speechSynthesis" in window) {
      setAvatar("speaking");
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ""));
      utterance.lang = lang === "Traditional Chinese" ? "zh-TW" : "en-US";
      utterance.onend = () => setAvatar("idle");
      utterance.onerror = () => setAvatar("idle");
      window.speechSynthesis.speak(utterance);
    }
  }

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = inputEl.value.trim();
    if (!message) return;

    const selectedMode = modeSelectorEl ? modeSelectorEl.value : "Standard";
    const selectedLang = langSelectorEl ? langSelectorEl.value : "English";

    const userMsgEl = appendMessage("user", message);
    inputEl.value = "";
    setBusy(true);
    showThinking("Working");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({
          message,
          level: selectedMode,
          language: selectedLang,
          history: history.slice(-MAX_HISTORY),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        hideThinking();
        appendMessage(
          "error",
          formatDetail(data.detail, `Request failed (${res.status})`),
          "error"
        );
        return;
      }

      const data = await readChatStream(res);
      hideThinking();

      const reply = data.reply || "";
      const summary = data.summary || null;
      const sources = data.sources || [];
      if (!reply) {
        appendMessage("error", "The tutor returned an empty answer. Please try again.", "error");
        return;
      }
      addSourcesLabel(userMsgEl, sources);
      appendMessage("assistant", reply, "assistant", sources, summary);
      speakReply(reply, selectedLang);
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: reply });
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
      }
    } catch (err) {
      hideThinking();
      const msg = err && typeof err.message === "string" ? err.message : "";
      const detail =
        msg && !/fetch|network|Failed to fetch/i.test(msg)
          ? msg
          : "Could not reach the local server. Is the app still running?";
      appendMessage("error", detail, "error");
    } finally {
      setBusy(false);
      inputEl.focus();
    }
  });

  if (quickQuizBtnEl) {
    quickQuizBtnEl.addEventListener("click", async () => {
      const topic = quickQuizTopicEl.value.trim();
      if (!topic) {
        alert("Please enter a topic first.");
        return;
      }
      const scope = quickQuizScopeEl.value;
      const lang = quickQuizLanguageEl ? quickQuizLanguageEl.value : "English";

      setBusy(true);
      quickQuizResultEl.innerHTML = "<p>🤔 Generating 3 questions...</p>";
      setAvatar("thinking");

      try {
        const res = await fetch("/api/quick-quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, scope, language: lang }),
        });

        const data = await res.json().catch(() => ({}));
        setAvatar("idle");

        if (!res.ok) {
          quickQuizResultEl.innerHTML = `<p style="color:red;">Error: ${
            data.detail || "Failed to generate quiz."
          }</p>`;
          return;
        }

        quickQuizResultEl.innerHTML = "";
        data.questions.forEach((q, idx) => {
          const qDiv = document.createElement("div");
          qDiv.className = "quiz-question";

          const qTitle = document.createElement("h4");
          qTitle.textContent = `Q${idx + 1}: ${q.question}`;
          qDiv.appendChild(qTitle);

          q.options.forEach((opt) => {
            const optDiv = document.createElement("div");
            optDiv.textContent = opt;
            optDiv.style.padding = "6px";
            optDiv.style.margin = "4px 0";
            optDiv.style.border = "1px solid #eee";
            optDiv.style.borderRadius = "4px";
            qDiv.appendChild(optDiv);
          });

          const answerBtn = document.createElement("button");
          answerBtn.className = "quiz-answer-btn";
          answerBtn.textContent = "Show Answer";
          const answerDiv = document.createElement("div");
          answerDiv.className = "quiz-answer-text";
          const correctLetter = String.fromCharCode(65 + q.correct_index);
          answerDiv.innerHTML = `<strong>Correct Answer: ${correctLetter}</strong><br>${q.explanation}`;

          answerBtn.addEventListener("click", () => {
            const isVisible = answerDiv.style.display === "block";
            answerDiv.style.display = isVisible ? "none" : "block";
            answerBtn.textContent = isVisible ? "Show Answer" : "Hide Answer";
          });

          qDiv.appendChild(answerBtn);
          qDiv.appendChild(answerDiv);
          quickQuizResultEl.appendChild(qDiv);
        });
      } catch {
        setAvatar("idle");
        quickQuizResultEl.innerHTML = `<p style="color:red;">Could not reach server.</p>`;
      } finally {
        setBusy(false);
      }
    });
  }

  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formEl.requestSubmit();
    }
  });

  setAvatar("idle");
  refreshHealth();
  refreshDocuments();
  inputEl.focus();
})();
