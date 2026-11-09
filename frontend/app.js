(() => {
  const messagesEl = document.getElementById("messages");
  const formEl = document.getElementById("chat-form");
  const inputEl = document.getElementById("input");
  const sendEl = document.getElementById("send");
  const statusEl = document.getElementById("status");

  /** @type {{role: string, content: string}[]} */
  const history = [];
  const MAX_HISTORY = 12;

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
        // Fallback for older browsers / denied clipboard permission.
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

    if (role === "assistant") {
      const actions = document.createElement("div");
      actions.className = "actions";
      addCopyButton(actions, content);
      wrap.appendChild(actions);
    }

    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setBusy(busy) {
    sendEl.disabled = busy;
    inputEl.disabled = busy;
  }

  async function refreshHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.ok) {
        statusEl.textContent = `Local model ready: ${data.model}`;
        statusEl.className = "status ok";
      } else {
        statusEl.textContent = data.detail || "Local model not ready.";
        statusEl.className = "status error";
      }
    } catch {
      statusEl.textContent = "Cannot reach local app health check.";
      statusEl.className = "status error";
    }
  }

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = inputEl.value.trim();
    if (!message) return;

    appendMessage("user", message);
    inputEl.value = "";
    setBusy(true);

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
      if (!res.ok) {
        const detail = data.detail || `Request failed (${res.status})`;
        appendMessage("error", detail, "error");
        return;
      }

      const reply = data.reply || "";
      appendMessage("assistant", reply);
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: reply });
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
      }
    } catch {
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
  inputEl.focus();
})();
