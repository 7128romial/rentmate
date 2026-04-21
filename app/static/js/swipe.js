/* swipe.js — full gesture engine for the match deck */
(function () {
  const deck = document.getElementById("deck");
  if (!deck) return;

  const counter = document.getElementById("swipe-counter");
  const minScoreInput = document.getElementById("min-score");
  const minScoreLabel = document.getElementById("min-score-val");

  let cards = [];       // data from API
  let idx = 0;          // index of the current front card
  const history = [];   // stack of previously-swiped indexes for undo

  const STACK_DEPTH = 3;

  async function load(minScore = 0) {
    deck.innerHTML = renderSkeleton();
    try {
      const data = await RM.apiFetch(`/api/matches?min_score=${minScore}&limit=50`);
      cards = data.items || [];
      idx = 0;
      renderStack();
      updateCounter();
    } catch (e) {
      deck.innerHTML = `<div class="swipe-empty"><div class="emoji">⚠️</div><p>${RM.escapeHtml(e.message)}</p></div>`;
    }
  }

  function renderSkeleton() {
    return `<div class="swipe-card"><div class="swipe-card-media skeleton"></div><div class="swipe-card-body"><div class="skeleton" style="height:20px;width:60%;margin-bottom:8px;"></div><div class="skeleton" style="height:16px;width:40%;"></div></div></div>`;
  }

  function renderStack() {
    deck.innerHTML = "";
    if (idx >= cards.length) {
      deck.innerHTML = `
        <div class="swipe-empty">
          <div class="emoji">🔥</div>
          <h3>ראית את כל ההתאמות!</h3>
          <p>נסה להוריד את ציון המינימום או לחזור מאוחר יותר.</p>
          <button class="btn btn-primary" onclick="location.reload()">טען מחדש</button>
        </div>`;
      return;
    }
    const end = Math.min(idx + STACK_DEPTH, cards.length);
    for (let i = end - 1; i >= idx; i--) {
      const layer = i - idx;
      const el = buildCard(cards[i], layer);
      if (layer === 0) wireDrag(el);
      deck.appendChild(el);
    }
  }

  function buildCard(item, layer) {
    const el = document.createElement("div");
    el.className = "swipe-card";
    el.dataset.id = item.id;
    el.style.transform = `scale(${1 - layer * 0.04}) translateY(${layer * 8}px)`;
    el.style.zIndex = 100 - layer;
    el.style.opacity = layer === 2 ? 0.5 : 1;

    const score = item.match?.total || 0;
    const scoreCls = score >= 80 ? "" : score >= 60 ? "mid" : "low";
    const bg = item.primary_image ? `background-image: url('${item.primary_image}');` : "";

    const amenities = Object.entries(item.amenities || {})
      .filter(([, v]) => v)
      .map(([k]) => {
        const label = { elevator: "מעלית", parking: "חנייה", balcony: "מרפסת",
                        furnished: "מרוהטת", pets: "חיות", smoking: "עישון" }[k] || k;
        return `<span class="badge badge-coral">${label}</span>`;
      }).join("");

    const bd = item.match || {};
    const bar = (label, v, max = 100) => `
      <div class="swipe-card-bar">
        <div class="track"><div class="fill" style="width:${Math.min(100, (v / max) * 100)}%"></div></div>
        <span>${label}</span>
      </div>`;

    el.innerHTML = `
      <div class="stamp stamp-like">LIKE</div>
      <div class="stamp stamp-nope">NOPE</div>
      <div class="swipe-card-media" style="${bg}">
        <div class="swipe-card-gradient"></div>
        <button class="swipe-card-save" aria-label="שמור" title="שמור" onclick="event.stopPropagation();RM.SWIPE.saveCard(${item.id}, this)">🤍</button>
        <span class="swipe-card-score ${scoreCls}">${Math.round(score)}% Match</span>
        ${item.images && item.images.length > 1
          ? `<div class="swipe-card-photos">${item.images.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}</div>`
          : ''}
      </div>
      <div class="swipe-card-body">
        <h3>${RM.escapeHtml(item.title)}</h3>
        <div class="loc">📍 ${RM.escapeHtml(item.city)}${item.neighborhood ? ' · ' + RM.escapeHtml(item.neighborhood) : ''}</div>
        <div class="price">₪${(item.price || 0).toLocaleString()} <small style="font-weight:500;color:var(--text-muted)">לחודש</small></div>
        <div class="swipe-card-reason">${RM.escapeHtml(bd.reason || '')}</div>
        <div class="swipe-card-amen">${amenities}</div>
        <div class="swipe-card-bars">
          ${bar('מיקום', bd.location_score)}
          ${bar('מחיר', bd.budget_score)}
          ${bar('סגנון', bd.lifestyle_score)}
          ${bar('תאריכים', bd.availability_score)}
        </div>
      </div>`;
    return el;
  }

  // ---------- Drag + swipe physics ----------
  function wireDrag(el) {
    let startX = 0, startY = 0, currentX = 0, currentY = 0, dragging = false, startTime = 0;

    const stampLike = el.querySelector(".stamp-like");
    const stampNope = el.querySelector(".stamp-nope");

    function onDown(e) {
      if (e.target.closest(".swipe-card-save")) return;
      dragging = true; startTime = Date.now();
      const p = eventPoint(e);
      startX = p.x; startY = p.y; currentX = 0; currentY = 0;
      el.classList.add("dragging");
      el.setPointerCapture?.(e.pointerId);
    }
    function onMove(e) {
      if (!dragging) return;
      const p = eventPoint(e);
      currentX = p.x - startX; currentY = p.y - startY;
      const rot = currentX / 20;
      el.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rot}deg)`;
      stampLike.style.opacity = Math.max(0, Math.min(1, currentX / 120));
      stampNope.style.opacity = Math.max(0, Math.min(1, -currentX / 120));
    }
    function onUp() {
      if (!dragging) return;
      dragging = false; el.classList.remove("dragging");
      const velocity = Math.abs(currentX) / Math.max(1, Date.now() - startTime);
      const threshold = 120;
      if (currentX > threshold || velocity > 0.6 && currentX > 40) {
        animateOff("right");
      } else if (currentX < -threshold || velocity > 0.6 && currentX < -40) {
        animateOff("left");
      } else {
        el.style.transform = "";
        stampLike.style.opacity = 0;
        stampNope.style.opacity = 0;
      }
    }

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", (e) => {
      if (Math.abs(currentX) < 5 && !e.target.closest(".swipe-card-save")) {
        openDetail(cards[idx]);
      }
    });
  }

  function eventPoint(e) {
    if (e.clientX !== undefined) return { x: e.clientX, y: e.clientY };
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function animateOff(dir) {
    const el = deck.querySelector(".swipe-card:not([style*='scale'])") || deck.querySelector(".swipe-card");
    if (!el) return;
    const flyX = dir === "right" ? window.innerWidth * 1.2 : -window.innerWidth * 1.2;
    const rot = dir === "right" ? 30 : -30;
    el.style.transition = "transform 0.45s ease, opacity 0.45s";
    el.style.transform = `translate(${flyX}px, 0) rotate(${rot}deg)`;
    el.style.opacity = 0;

    const action = dir === "right" ? "liked" : "passed";
    RM.vibrate(dir === "right" ? 40 : 20);
    const id = cards[idx]?.id;
    if (id) recordAction(id, action);

    history.push(idx);
    idx += 1;
    setTimeout(renderStack, 300);
    updateCounter();
  }

  async function recordAction(listingId, action) {
    try {
      const res = await RM.apiFetch("/api/matches/action", {
        method: "POST", body: { listing_id: listingId, action },
      });
      if (action === "liked" && res.match_score >= 85) {
        // Suggest starting a chat — landlord gets a notification too
        window.RM.toast("התאמה מעולה! שלח הודעה לבעל הדירה 💬", "success");
      }
    } catch (e) { /* already logged server-side */ }
  }

  function saveCard(listingId, btn) {
    btn.textContent = "❤️";
    recordAction(listingId, "saved");
    RM.vibrate(30);
  }

  function undoSwipe() {
    const last = history.pop();
    if (last == null) return;
    idx = last;
    renderStack();
    updateCounter();
  }

  function updateCounter() {
    if (counter) counter.textContent = `${Math.max(0, cards.length - idx)} התאמות`;
  }

  // ---------- Detail drawer ----------
  function openDetail(item) {
    if (!item) return;
    const overlay = document.getElementById("detail-overlay");
    const drawer = document.getElementById("detail-drawer");
    const content = document.getElementById("detail-content");
    if (!overlay || !drawer || !content) return;
    const bd = item.match || {};
    content.innerHTML = `
      <h2 style="margin:0 0 4px;">${RM.escapeHtml(item.title)}</h2>
      <p class="small">📍 ${RM.escapeHtml(item.city)}${item.neighborhood ? ' · ' + RM.escapeHtml(item.neighborhood) : ''}</p>
      <p style="font-size:1.5rem;font-weight:800;color:var(--coral-1);margin:12px 0;">₪${(item.price||0).toLocaleString()} <span style="font-size:0.85rem;font-weight:500;color:var(--text-muted)">לחודש</span></p>
      <div class="chip-group" style="margin:8px 0 16px;">
        <span class="chip active">${RM.escapeHtml(item.match?.reason || '')}</span>
      </div>
      <h3 style="margin-top:16px;">פירוט ההתאמה</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${row("מיקום", bd.location_score)}
        ${row("מחיר", bd.budget_score)}
        ${row("סגנון חיים", bd.lifestyle_score)}
        ${row("תאריכים", bd.availability_score)}
      </div>
      <h3 style="margin-top:16px;">תיאור</h3>
      <p>${RM.escapeHtml(item.description || "אין תיאור")}</p>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-primary btn-block" onclick="RM.SWIPE.contactPublisher(${item.id})">📩 שלח הודעה</button>
        <a class="btn btn-outline" href="/listings/${item.id}">פרטים מלאים</a>
      </div>`;
    overlay.classList.add("open");
    drawer.classList.add("open");
    overlay.addEventListener("click", closeDetail, { once: true });
  }

  function row(label, val) {
    const v = Math.round(val || 0);
    return `<div><small>${label}</small><div class="track" style="background:var(--border);height:6px;border-radius:99px;overflow:hidden;"><div style="height:100%;background:var(--coral-gradient);width:${v}%;"></div></div><small>${v}%</small></div>`;
  }

  function closeDetail() {
    const overlay = document.getElementById("detail-overlay");
    const drawer = document.getElementById("detail-drawer");
    overlay?.classList.remove("open");
    drawer?.classList.remove("open");
  }

  async function contactPublisher(listingId) {
    try {
      const res = await RM.apiFetch("/chat/api/conversations/start", {
        method: "POST", body: { listing_id: listingId },
      });
      window.location.href = res.redirect;
    } catch (e) { RM.toast(e.message, "error"); }
  }

  // ---------- UI bindings ----------
  if (minScoreInput) {
    minScoreInput.addEventListener("change", (e) => {
      const v = parseInt(e.target.value, 10);
      if (minScoreLabel) minScoreLabel.textContent = v + "%";
      load(v);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowRight") animateOff("right");
    else if (e.key === "ArrowLeft") animateOff("left");
    else if (e.key === "z" && (e.ctrlKey || e.metaKey)) undoSwipe();
  });

  window.RM.SWIPE = {
    swipeRight: () => animateOff("right"),
    swipeLeft: () => animateOff("left"),
    undo: undoSwipe,
    saveCard,
    contactPublisher,
    closeDetail,
    demoMatch,
  };

  // ---------- Match celebration ----------
  function demoMatch(payload) {
    const root = document.getElementById("match-root");
    const me = window.RM_CONFIG.currentUser || {};
    const other = (payload && payload.other) || { first_name: "בעל הדירה", initials: "?" };
    root.innerHTML = `
      <canvas class="confetti-canvas"></canvas>
      <div class="match-celebration">
        <div class="match-celebration-card">
          <h1>התאמה! 🎉</h1>
          <p>שניכם אהבתם — זמן לפתוח שיחה.</p>
          <div class="match-avatars">
            <div class="match-avatar">${RM.escapeHtml((me.firstName || '?').slice(0,1))}</div>
            <div class="match-heart">💖</div>
            <div class="match-avatar">${RM.escapeHtml(other.initials || '?')}</div>
          </div>
          <div class="match-celebration-actions">
            <button class="btn btn-outline" onclick="document.getElementById('match-root').innerHTML=''">המשך לגלוש</button>
          </div>
        </div>
      </div>`;
    runConfetti(root.querySelector("canvas"));
  }

  function runConfetti(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;
    const colors = ["#FF4458", "#FF7854", "#06B6D4", "#10B981", "#F59E0B"];
    const parts = [];
    for (let i = 0; i < 120; i++) {
      parts.push({
        x: W / 2, y: H * 0.3,
        vx: (Math.random() - 0.5) * 10, vy: Math.random() * -8 - 3,
        r: 4 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      });
    }
    const start = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, W, H);
      parts.forEach(p => {
        p.vy += 0.2; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
        ctx.restore();
      });
      if (t - start < 3000) requestAnimationFrame(frame);
      else canvas.remove();
    })(start);
  }

  // init
  load(0);
})();
