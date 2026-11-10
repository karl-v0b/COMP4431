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

  const history = [];
  const MAX_HISTORY = 12;
  let isMuted = false;

  if (window.marked && typeof marked.setOptions === "function") {
    marked.setOptions({ gfm: true, breaks: true });
  }

  // --- Mute Toggle Logic ---
  muteBtnEl.addEventListener("click", () => {
    isMuted = !isMuted;
    if (isMuted) {
      muteBtnEl.textContent = "🔇 Audio OFF";
      muteBtnEl.style.color = "#dc2626"; // Red
      window.speechSynthesis.cancel(); // Stop any current speech
    } else {
      muteBtnEl.textContent = "🔊 Audio ON";
      muteBtnEl.style.color = "inherit";
    }
  });

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
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function showThinking() {
    setAvatar("thinking");
    const wrap = document.createElement("div");
    wrap.className = "message assistant thinking";
    wrap.id = "thinking-message";
    const roleEl = document.createElement("span");
    roleEl.className = "role";
    roleEl.textContent = "Tutor";
    const body = document.createElement("div");
    body.className = "body thinking-body";
    body.innerHTML = '<span class="thinking-label">Thinking</span><span class="thinking-dots"><span></span><span></span><span></span></span>';
    wrap.appendChild(roleEl);
    wrap.appendChild(body);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideThinking() {
    setAvatar("idle");
    const leftover = document.getElementById("thinking-message");
    if (leftover) leftover.remove();
  }

  function setBusy(busy) {
    sendEl.disabled = busy;
    inputEl.disabled = busy;
  }

  function speakReply(text, lang) {
    if (isMuted) return; // Exit early if muted

    if ('speechSynthesis' in window) {
      setAvatar("speaking");
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ''));
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

    appendMessage("user", message);
    inputEl.value = "";
    setBusy(true);
    showThinking();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          level: selectedMode,
          language: selectedLang,
          history: history.slice(-MAX_HISTORY),
        }),
      });

      const data = await res.json().catch(() => ({}));
      hideThinking();
      if (!res.ok) {
        appendMessage("error", data.detail || `Request failed`, "error");
        return;
      }

      const reply = data.reply || "";
      appendMessage("assistant", reply, "assistant");
      speakReply(reply, selectedLang);
      
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: reply });
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
      }
    } catch {
      hideThinking();
      appendMessage("error", "Could not reach server.", "error");
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

  setAvatar("idle");
  inputEl.focus();
})();
