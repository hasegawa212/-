(() => {
  const STORAGE_KEY = "open-clone:chats";

  const state = {
    chats: [],
    currentId: null,
  };

  const els = {
    sidebar: document.getElementById("sidebar"),
    menuToggle: document.getElementById("menuToggle"),
    newChatBtn: document.getElementById("newChatBtn"),
    chatList: document.getElementById("chatList"),
    conversation: document.getElementById("conversation"),
    welcome: document.getElementById("welcome"),
    form: document.getElementById("composerForm"),
    input: document.getElementById("input"),
    sendBtn: document.getElementById("sendBtn"),
    modelSelect: document.getElementById("modelSelect"),
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.chats = Array.isArray(data.chats) ? data.chats : [];
      state.currentId = data.currentId || null;
    } catch {
      state.chats = [];
      state.currentId = null;
    }
  }

  function save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ chats: state.chats, currentId: state.currentId })
    );
  }

  function getCurrent() {
    return state.chats.find((c) => c.id === state.currentId) || null;
  }

  function newChat() {
    const chat = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title: "新しいチャット",
      messages: [],
      createdAt: Date.now(),
    };
    state.chats.unshift(chat);
    state.currentId = chat.id;
    save();
    render();
  }

  function selectChat(id) {
    state.currentId = id;
    save();
    render();
    if (window.innerWidth <= 768) els.sidebar.classList.remove("open");
  }

  function renderSidebar() {
    els.chatList.innerHTML = "";
    for (const chat of state.chats) {
      const btn = document.createElement("button");
      btn.className = "chat-item" + (chat.id === state.currentId ? " active" : "");
      btn.textContent = chat.title;
      btn.addEventListener("click", () => selectChat(chat.id));
      els.chatList.appendChild(btn);
    }
  }

  function renderConversation() {
    const chat = getCurrent();
    els.conversation.innerHTML = "";

    if (!chat || chat.messages.length === 0) {
      els.conversation.appendChild(els.welcome);
      els.welcome.style.display = "";
      return;
    }

    els.welcome.style.display = "none";
    for (const msg of chat.messages) {
      els.conversation.appendChild(renderMessage(msg));
    }
    els.conversation.scrollTop = els.conversation.scrollHeight;
  }

  function renderMessage(msg) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${msg.role}`;

    const role = document.createElement("div");
    role.className = "role";
    role.textContent = msg.role === "user" ? "U" : "◆";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (msg.typing) {
      bubble.innerHTML = '<span class="typing"></span>';
    } else {
      bubble.innerHTML = formatContent(msg.content);
    }

    wrapper.appendChild(role);
    wrapper.appendChild(bubble);
    return wrapper;
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatContent(text) {
    const escaped = escapeHtml(text);
    const withFences = escaped.replace(
      /```([\s\S]*?)```/g,
      (_, code) => `<pre><code>${code}</code></pre>`
    );
    const withInlineCode = withFences.replace(
      /`([^`]+)`/g,
      (_, code) => `<code>${code}</code>`
    );
    return withInlineCode
      .split(/\n\n+/)
      .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  function render() {
    renderSidebar();
    renderConversation();
  }

  function titleFrom(text) {
    const trimmed = text.trim().replace(/\s+/g, " ");
    return trimmed.length > 30 ? trimmed.slice(0, 30) + "…" : trimmed || "新しいチャット";
  }

  async function sendMessage(text) {
    let chat = getCurrent();
    if (!chat) {
      newChat();
      chat = getCurrent();
    }

    chat.messages.push({ role: "user", content: text });
    if (chat.messages.length === 1) chat.title = titleFrom(text);
    save();
    renderConversation();
    renderSidebar();

    const placeholder = { role: "assistant", content: "", typing: true };
    chat.messages.push(placeholder);
    renderConversation();

    // Incrementally update the in-flight assistant bubble as tokens stream in.
    const onDelta = (full) => {
      placeholder.typing = false;
      placeholder.content = full;
      const bubbles = els.conversation.querySelectorAll(".message.assistant .bubble");
      const last = bubbles[bubbles.length - 1];
      if (last) last.innerHTML = formatContent(full);
      els.conversation.scrollTop = els.conversation.scrollHeight;
    };

    const reply = await generateReply(text, chat.messages, els.modelSelect.value, onDelta);

    placeholder.typing = false;
    placeholder.content = reply;
    save();
    renderConversation();
  }

  // Parse one SSE record ("event: x\ndata: {...}") into { type, data }.
  function parseSSE(raw) {
    let type = "delta";
    const dataLines = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) type = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    let data = {};
    try {
      data = JSON.parse(dataLines.join("\n") || "{}");
    } catch {
      data = {};
    }
    return { type, data };
  }

  let backendAvailable = null;

  async function checkBackend() {
    if (backendAvailable !== null) return backendAvailable;
    try {
      const res = await fetch("/api/health", { method: "GET" });
      if (!res.ok) throw new Error("health check failed");
      const data = await res.json();
      backendAvailable = Boolean(data.ok && data.configured);
    } catch {
      backendAvailable = false;
    }
    return backendAvailable;
  }

  async function generateReply(prompt, history, model, onDelta) {
    if (await checkBackend()) {
      try {
        const payload = {
          model,
          messages: history
            .filter((m) => !m.typing && m.content)
            .map(({ role, content }) => ({ role, content })),
        };
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        if (!res.body) {
          // Streaming unsupported in this environment — fall back to plain text.
          return (await res.text()) || "(空の応答)";
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const record = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const { type, data } = parseSSE(record);
            if (type === "delta" && data.text) {
              full += data.text;
              if (onDelta) onDelta(full);
            } else if (type === "error") {
              throw new Error(data.error || "stream error");
            }
          }
        }
        return full || "(空の応答)";
      } catch (err) {
        return `⚠️ バックエンドエラー: ${err.message}\n\nオフラインのデモ応答に切り替わります。`;
      }
    }

    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
    const modelLabel = model.replace("clone-", "Clone ").replace(/\b\w/g, (c) => c.toUpperCase());
    const q = prompt.trim();

    if (/^(hi|hello|こんにちは|はじめまして|やあ)/i.test(q)) {
      return `こんにちは! ${modelLabel} です。何についてお話ししましょうか?`;
    }
    if (/^(ありがとう|thanks|thank you)/i.test(q)) {
      return "どういたしまして! 他にお手伝いできることがあれば、気軽に聞いてください。";
    }
    if (/\?|？|教えて|とは|って何/.test(q)) {
      return `「${q}」について考えてみます。\n\nこれはオフラインのデモ応答です。実LLMに接続するには \`ANTHROPIC_API_KEY\` を設定し \`npm start\` でサーバーを起動してください。`;
    }
    return `了解しました。\n\nあなたのメッセージ: *${q}*\n\n(これはローカル動作するデモ応答です。モデル: ${modelLabel})`;
  }

  function autoResize() {
    els.input.style.height = "auto";
    els.input.style.height = Math.min(els.input.scrollHeight, 200) + "px";
    els.sendBtn.disabled = els.input.value.trim().length === 0;
  }

  function bindEvents() {
    els.newChatBtn.addEventListener("click", newChat);

    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = els.input.value.trim();
      if (!text) return;
      els.input.value = "";
      autoResize();
      sendMessage(text);
    });

    els.input.addEventListener("input", autoResize);
    els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        els.form.requestSubmit();
      }
    });

    els.menuToggle.addEventListener("click", () => {
      els.sidebar.classList.toggle("open");
    });

    document.querySelectorAll(".suggest").forEach((btn) => {
      btn.addEventListener("click", () => {
        els.input.value = btn.textContent + "を手伝ってほしい";
        autoResize();
        els.input.focus();
      });
    });
  }

  function init() {
    load();
    if (state.chats.length === 0) newChat();
    else if (!state.currentId) state.currentId = state.chats[0].id;
    bindEvents();
    autoResize();
    render();
  }

  init();
})();
