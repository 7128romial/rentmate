/* ai-agent.js — chat UI for the AI preference interviewer */
(function () {
  const el = document.getElementById("ai-chat");
  if (!el) return;

  const msgArea = document.getElementById("ai-messages");
  const input = document.getElementById("ai-input");
  const sendBtn = document.getElementById("ai-send");

  function appendBubble(role, content) {
    const b = document.createElement("div");
    b.className = `ai-bubble ${role}`;
    b.textContent = content;
    msgArea.appendChild(b);
    msgArea.scrollTop = msgArea.scrollHeight;
    return b;
  }

  function showTyping() {
    const b = document.createElement("div");
    b.className = "ai-bubble assistant typing";
    b.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>`;
    b.dataset.typing = "1";
    msgArea.appendChild(b);
    msgArea.scrollTop = msgArea.scrollHeight;
    return b;
  }

  function typeInto(el, text, speed = 18) {
    el.textContent = "";
    el.className = "ai-bubble assistant";
    let i = 0;
    return new Promise(resolve => {
      const tick = () => {
        el.textContent = text.slice(0, i + 1);
        i += 1;
        msgArea.scrollTop = msgArea.scrollHeight;
        if (i < text.length) setTimeout(tick, speed);
        else resolve();
      };
      tick();
    });
  }

  async function send() {
    const content = (input.value || "").trim();
    if (!content) return;
    input.value = "";
    appendBubble("user", content);
    const typingEl = showTyping();
    sendBtn.disabled = true;

    try {
      const res = await RM.apiFetch("/ai/message", { method: "POST", body: { content } });
      await typeInto(typingEl, res.assistant);
      if (res.done) {
        const done = document.createElement("div");
        done.className = "ai-completed";
        done.textContent = "✓ ההעדפות שלך נשמרו! בוא נתחיל לראות התאמות.";
        msgArea.appendChild(done);
        setTimeout(() => { window.location.href = "/matches/swipe"; }, 1800);
      }
    } catch (e) {
      typingEl.remove();
      RM.toast(e.message || "שגיאה", "error");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  input.focus();
  msgArea.scrollTop = msgArea.scrollHeight;
})();
