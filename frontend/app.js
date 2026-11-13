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

  // Break Reminder Elements
  const breakBtnEl = document.getElementById("break-btn");
  const toastContainer = document.getElementById("toast-container");

  const history = [];
  const MAX_HISTORY = 12;
  let isMuted = false;

  if (window.marked && typeof marked.setOptions === "function") {
    marked.setOptions({ gfm: true, breaks: true });
  }

  // --- Toast System ---
  const selfCareMessages = [
    { icon: "💧", title: "Time for a sip of water!", text: "Staying hydrated helps your brain process those neural networks better. Take a quick sip." },
    { icon: "👀", title: "Rest your eyes", text: "You've been staring at the screen for a while. Look 20 feet away for 20 seconds to reduce eye strain." },
    { icon: "🧘", title: "Quick stretch", text: "Roll your shoulders back and take a deep breath. A relaxed mind learns faster." },
    { icon: "🍎", title: "Healthy snack time", text: "Doing deep dives burns calories. Maybe grab a quick healthy snack before the next topic?" }
  ];

  function showToast() {
    // Pick a random message
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

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      toast.classList.add("hiding");
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  // Manual trigger
  breakBtnEl.addEventListener("click", showToast);

  // Auto-trigger every 15 minutes of use (900000 ms)
  // For demo purposes, you might want to change this to 60000 (1 min) to show the professor
  setInterval(showToast, 900000); 

  // --- Modal Controls ---
  openQuizBtn.addEventListener("click", () => {
    quizModal.classList.add("active");
    quizTopicEl.focus();
  });

  closeQuizBtn.addEventListener("click", () => {
    quizModal.classList.remove("active");
  });

  quizModal.addEventListener("click", (e) => {
    if (e.target === quizModal) {
      quizModal.classList.remove("active");
    }
  });

  // --- Mute Toggle ---
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

  function appendMessage(role, content, className) {
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
    quizBtnEl.disabled = busy;
  }

  function speakReply(text, lang) {
    if (isMuted) return;
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

  quizBtnEl.addEventListener("click", async () => {
    const topic = quizTopicEl.value.trim();
    if (!topic) {
      alert("Please enter a topic first.");
      return;
    }
    const scope = quizScopeEl.value;
    const lang = quizLanguageEl ? quizLanguageEl.value : "English";

    setBusy(true);
    quizResultEl.innerHTML = "<p>🤔 Generating 3 questions...</p>";
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
        quizResultEl.innerHTML = `<p style="color:red;">Error: ${data.detail || "Failed to generate quiz."}</p>`;
        return;
      }

      quizResultEl.innerHTML = "";
      data.questions.forEach((q, idx) => {
        const qDiv = document.createElement("div");
        qDiv.className = "quiz-question";

        const qTitle = document.createElement("h4");
        qTitle.textContent = `Q${idx + 1}: ${q.question}`;
        qDiv.appendChild(qTitle);

        q.options.forEach((opt, optIdx) => {
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
        quizResultEl.appendChild(qDiv);
      });

    } catch {
      setAvatar("idle");
      quizResultEl.innerHTML = `<p style="color:red;">Could not reach server.</p>`;
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
  inputEl.focus();
})();
