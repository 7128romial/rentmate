/* "It's a match!" celebration modal with lightweight canvas confetti.
   Listens for the `match:new` socket event on the shared RM.socket. */
(function () {
  if (!window.RM || !window.RM.socket) return;

  const socket = window.RM.socket;
  const root = document.getElementById('match-celebration-root');
  if (!root) return;

  function runConfetti(canvas, durationMs = 2500) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.clientWidth;
    const H = canvas.height = canvas.clientHeight;
    const colors = ['#FF4458', '#FF8A80', '#FFD166', '#06D6A0', '#118AB2', '#9D4EDD'];
    const particles = [];
    for (let i = 0; i < 140; i++) {
      particles.push({
        x: W / 2,
        y: H * 0.25,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * -6 - 2,
        r: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
      });
    }
    const start = performance.now();
    function frame(t) {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.vy += 0.15;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
        ctx.restore();
      });
      if (t - start < durationMs) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function show(payload) {
    const other = payload.other_user || {};
    const avatar = other.avatar_url
      ? `<img src="${other.avatar_url}" alt="">`
      : `<span>${window.RM.escapeHtml(other.initials || '?')}</span>`;
    root.innerHTML = `
      <div class="match-celebration-overlay" role="dialog" aria-modal="true">
        <canvas class="match-confetti"></canvas>
        <div class="match-card">
          <h1 class="match-title">It's a match! 🎉</h1>
          <p class="match-sub">${window.RM.escapeHtml(payload.property_title || '')}</p>
          <div class="match-avatars">
            <div class="match-avatar me">${window.RM_CURRENT_USER && window.RM_CURRENT_USER.avatar_url
              ? `<img src="${window.RM_CURRENT_USER.avatar_url}" alt="">`
              : `<span>${window.RM.escapeHtml((window.RM_CURRENT_USER && window.RM_CURRENT_USER.first_name || '').slice(0,1).toUpperCase())}</span>`}</div>
            <div class="match-heart">💖</div>
            <div class="match-avatar other">${avatar}</div>
          </div>
          <div class="match-actions">
            <button class="btn btn-primary btn-lg" id="match-chat-btn">שלח הודעה</button>
            <button class="btn btn-ghost" id="match-close-btn">המשך לגלוש</button>
          </div>
        </div>
      </div>
    `;
    const canvas = root.querySelector('.match-confetti');
    requestAnimationFrame(() => runConfetti(canvas));

    root.querySelector('#match-close-btn').addEventListener('click', () => {
      root.innerHTML = '';
    });
    root.querySelector('#match-chat-btn').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/chat/start/' + other.id, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: payload.property_id }),
        });
        const data = await res.json();
        window.location.href = '/chat?conv=' + data.conversation_id;
      } catch (e) {
        root.innerHTML = '';
      }
    });
  }

  socket.on('match:new', show);

  window.RM.showMatch = show;
  window.RM.demoMatch = function () {
    show({
      property_id: 1,
      property_title: 'דירת 3 חדרים מרווחת בלב תל אביב',
      other_user: { id: 0, first_name: 'דוד', last_name: 'כהן', avatar_url: null, initials: 'דכ' },
    });
  };
})();
