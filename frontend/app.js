(() => {
  const messagesEl = document.getElementById("messages");
  const formEl = document.getElementById("chat-form");
  const inputEl = document.getElementById("input");
  const sendEl = document.getElementById("send");
  const statusEl = document.getElementById("status");

  const modeSelectorEl = document.getElementById("learning-mode");
  const langSelectorEl = document.getElementById("language-select");
  const emojiFallback = document.getElementById("avatar-fallback");
  const muteBtnEl = document.getElementById("mute-btn");

  const openQuizBtn = document.getElementById("open-quiz-btn");
  const closeQuizBtn = document.getElementById("close-quiz-btn");
  const quizModal = document.getElementById("quiz-modal");
  const quizTopicEl = document.getElementById("quiz-topic");
  const quizScopeEl = document.getElementById("quiz-scope");
  const quizLanguageEl = document.getElementById("quiz-language");
  const quizBtnEl = document.getElementById("quiz-btn");
  const quizResultEl = document.getElementById("quiz-result");

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
    {
      title: "Time for a sip of water",
      text: "Staying hydrated helps your brain process those neural networks better. Take a quick sip.",
    },
    {
      title: "Rest your eyes",
      text: "You've been staring at the screen for a while. Look 20 feet away for 20 seconds to reduce eye strain.",
    },
    {
      title: "Quick stretch",
      text: "Roll your shoulders back and take a deep breath. A relaxed mind learns faster.",
    },
    {
      title: "Healthy snack time",
      text: "Doing deep dives burns calories. Maybe grab a quick healthy snack before the next topic?",
    },
  ];

  function showToast() {
    const msg = selfCareMessages[Math.floor(Math.random() * selfCareMessages.length)];
    const toast = document.createElement("div");
    toast.className = "custom-toast";
    toast.innerHTML = `
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

  breakBtnEl.addEventListener("click", showToast);
  setInterval(showToast, 900000);

  openQuizBtn.addEventListener("click", () => {
    quizModal.classList.add("active");
    quizTopicEl.focus();
  });

  closeQuizBtn.addEventListener("click", () => {
    quizModal.classList.remove("active");
  });

  quizModal.addEventListener("click", (e) => {
    if (e.target === quizModal) quizModal.classList.remove("active");
  });

  muteBtnEl.addEventListener("click", () => {
    isMuted = !isMuted;
    if (isMuted) {
      muteBtnEl.textContent = "Audio OFF";
      muteBtnEl.classList.add("is-muted");
      window.speechSynthesis.cancel();
    } else {
      muteBtnEl.textContent = "Audio ON";
      muteBtnEl.classList.remove("is-muted");
    }
  });

  function setAvatar(state) {
    if (!emojiFallback) return;
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

  function appendMessage(role, content, className, summary) {
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
    body.innerHTML =
      '<span class="thinking-label"></span>' +
      '<span class="thinking-dots" aria-hidden="true">' +
      "<span></span><span></span><span></span>" +
      "</span>";
    body.querySelector(".thinking-label").textContent = label || "Working";
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
    quizBtnEl.disabled = busy;
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
    } catch {
      statusEl.hidden = false;
      statusEl.textContent = "Cannot reach local server.";
      statusEl.className = "status error";
    }
  }

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = inputEl.value.trim();
    if (!message) return;

    const selectedMode = modeSelectorEl ? modeSelectorEl.value : "Standard";
    const selectedLang = langSelectorEl ? langSelectorEl.value : "English";

    appendMessage("user", message);
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
      if (!reply) {
        appendMessage("error", "The tutor returned an empty answer. Please try again.", "error");
        return;
      }
      appendMessage("assistant", reply, "assistant", summary);
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

  quizBtnEl.addEventListener("click", async () => {
    const topic = quizTopicEl.value.trim();
    if (!topic) {
      alert("Please enter a topic first.");
      return;
    }
    const scope = quizScopeEl.value;
    const lang = quizLanguageEl ? quizLanguageEl.value : "English";

    setBusy(true);
    quizResultEl.innerHTML = "<p>Generating 3 questions...</p>";
    setAvatar("thinking");

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, scope, language: lang }),
      });

      const data = await res.json().catch(() => ({}));
      setAvatar("idle");

      if (!res.ok) {
        quizResultEl.innerHTML = `<p class="quiz-error">Error: ${
          data.detail || "Failed to generate quiz."
        }</p>`;
        return;
      }

      quizResultEl.innerHTML = "";
      data.questions.forEach((q, idx) => {
        const qDiv = document.createElement("div");
        qDiv.className = "quiz-question";

        const qTitle = document.createElement("h4");
        qTitle.textContent = `Q${idx + 1}: ${q.question}`;
        qDiv.appendChild(qTitle);

        q.options.forEach((opt) => {
          const optDiv = document.createElement("div");
          optDiv.className = "quiz-option-row";
          optDiv.textContent = opt;
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
        quizResultEl.appendChild(qDiv);
      });
    } catch {
      setAvatar("idle");
      quizResultEl.innerHTML = `<p class="quiz-error">Could not reach server.</p>`;
    } finally {
      setBusy(false);
    }
  });

  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formEl.requestSubmit();
    }
  });

  setAvatar("idle");
  refreshHealth();
  inputEl.focus();
})();
