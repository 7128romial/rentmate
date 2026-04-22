/* swipe.js — match deck for /matches/swipe.
   Uses the RMCardStack library (port of yuyakaido/CardStackView) for the gesture engine,
   keeps all RentMate-specific concerns here: API integration, score visualization,
   detail drawer, match celebration. */
(function () {
  const deck = document.getElementById('deck');
  if (!deck) return;
  if (typeof RMCardStack !== 'function') {
    console.error('[swipe] RMCardStack library not loaded');
    return;
  }

  const counter = document.getElementById('swipe-counter');
  const minScoreInput = document.getElementById('min-score');
  const minScoreLabel = document.getElementById('min-score-val');

  const stack = new RMCardStack(deck, {
    stackFrom: 'bottom',
    visibleCount: 3,
    translationInterval: 12,
    scaleInterval: 0.96,
    swipeThreshold: 0.32,
    maxDegree: 22,
    swipeDirection: 'freedom',     // up = super-like, left/right = pass/like
    canScrollHorizontal: true,
    canScrollVertical: true,
    swipeableMethod: 'both',
    swipeAnimationDuration: 380,
    rewindAnimationDuration: 320,
    overlayInterpolator: (t) => Math.pow(t, 0.85),  // slight ease-out for label fade
    renderCard: renderListingCard,
    listeners: {
      onCardSwiped:    ({ direction, item }) => onSwiped(direction, item),
      onCardCanceled:  () => RM.vibrate(15),
      onCardRewound:   () => RM.vibrate(20),
      onCardAppeared:  () => updateCounter(),
    },
  });

  // --------------------------------------------------------------------------
  // Card render — produces the inner HTML of one listing card
  // --------------------------------------------------------------------------
  function renderListingCard(item, layer) {
    const score = (item.match && item.match.total) || 0;
    const scoreCls = score >= 80 ? '' : score >= 60 ? 'mid' : 'low';
    const bg = item.primary_image ? `background-image:url('${item.primary_image}');` : '';
    const photoDots = (item.images && item.images.length > 1)
      ? `<div class="swipe-card-photos">${item.images.map((_, i) =>
          `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}</div>`
      : '';

    const amenities = Object.entries(item.amenities || {})
      .filter(([, v]) => v)
      .map(([k]) => {
        const label = { elevator: 'מעלית', parking: 'חנייה', balcony: 'מרפסת',
                        furnished: 'מרוהטת', pets: 'חיות', smoking: 'עישון' }[k] || k;
        return `<span class="badge badge-coral">${label}</span>`;
      }).join('');

    const bd = item.match || {};
    const bar = (label, v) => `
      <div class="swipe-card-bar">
        <div class="track"><div class="fill" style="width:${Math.min(100, v || 0)}%"></div></div>
        <span>${label}</span>
      </div>`;

    return `
      <div class="swipe-card-inner">
        <div class="swipe-card-media" style="${bg}">
          <div class="swipe-card-gradient"></div>
          <button class="swipe-card-save" data-rmcs-no-drag aria-label="Super-like" title="Super-like (↑)"
                  onclick="RM.SWIPE.swipeUp()">⭐</button>
          <span class="swipe-card-score ${scoreCls}">${Math.round(score)}% Match</span>
          ${photoDots}
        </div>
        <div class="swipe-card-body">
          <h3>${RM.escapeHtml(item.title || '')}</h3>
          <div class="loc">📍 ${RM.escapeHtml(item.city || '')}${item.neighborhood ? ' · ' + RM.escapeHtml(item.neighborhood) : ''}</div>
          <div class="price">₪${(item.price || 0).toLocaleString()} <small style="font-weight:500;color:var(--text-muted)">לחודש</small></div>
          ${bd.reason ? `<div class="swipe-card-reason">${RM.escapeHtml(bd.reason)}</div>` : ''}
          <div class="swipe-card-amen">${amenities}</div>
          <div class="swipe-card-bars">
            ${bar('מיקום', bd.location_score)}
            ${bar('מחיר', bd.budget_score)}
            ${bar('סגנון', bd.lifestyle_score)}
            ${bar('תאריכים', bd.availability_score)}
          </div>
        </div>
      </div>`;
  }

  // --------------------------------------------------------------------------
  // Behavior
  // --------------------------------------------------------------------------
  async function load(minScore = 0) {
    deck.innerHTML = renderSkeleton();
    try {
      const data = await RM.apiFetch(`/api/matches?min_score=${minScore}&limit=50`);
      stack.setItems(data.items || []);
      updateCounter();
    } catch (e) {
      deck.innerHTML = `<div class="swipe-empty"><div class="emoji">⚠️</div><p>${RM.escapeHtml(e.message)}</p></div>`;
    }
  }

  function renderSkeleton() {
    return `<div class="swipe-card"><div class="swipe-card-media skeleton"></div><div class="swipe-card-body"><div class="skeleton" style="height:20px;width:60%;margin-bottom:8px;"></div><div class="skeleton" style="height:16px;width:40%;"></div></div></div>`;
  }

  function onSwiped(direction, item) {
    if (!item) return;
    const action = direction === 'right' ? 'liked'
                 : direction === 'left'  ? 'passed'
                 : direction === 'top'   ? 'saved'
                 : 'passed';
    RM.vibrate(direction === 'right' ? 40 : direction === 'top' ? 60 : 20);
    RM.apiFetch('/api/matches/action', {
      method: 'POST', body: { listing_id: item.id, action },
    }).then(res => {
      if (action === 'liked' && res.match_score >= 85) {
        RM.toast('התאמה מעולה! שלח/י הודעה לבעל הדירה 💬', 'success');
      }
    }).catch(() => {});
    updateCounter();
  }

  function updateCounter() {
    if (counter) counter.textContent = `${stack.remaining} התאמות`;
  }

  // --------------------------------------------------------------------------
  // Detail drawer (tap the card to open)
  // --------------------------------------------------------------------------
  function openDetail(item) {
    if (!item) return;
    const overlay = document.getElementById('detail-overlay');
    const drawer = document.getElementById('detail-drawer');
    const content = document.getElementById('detail-content');
    if (!overlay || !drawer || !content) return;
    const bd = item.match || {};
    content.innerHTML = `
      <h2 style="margin:0 0 4px;">${RM.escapeHtml(item.title || '')}</h2>
      <p class="small">📍 ${RM.escapeHtml(item.city || '')}${item.neighborhood ? ' · ' + RM.escapeHtml(item.neighborhood) : ''}</p>
      <p style="font-size:1.5rem;font-weight:800;color:var(--coral-1);margin:12px 0;">
        ₪${(item.price || 0).toLocaleString()}
        <span style="font-size:0.85rem;font-weight:500;color:var(--text-muted)">לחודש</span>
      </p>
      <div class="chip-group" style="margin:8px 0 16px;">
        <span class="chip active">${RM.escapeHtml(bd.reason || '')}</span>
      </div>
      <h3 style="margin-top:16px;">פירוט ההתאמה</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${row('מיקום', bd.location_score)}
        ${row('מחיר', bd.budget_score)}
        ${row('סגנון חיים', bd.lifestyle_score)}
        ${row('תאריכים', bd.availability_score)}
      </div>
      <h3 style="margin-top:16px;">תיאור</h3>
      <p>${RM.escapeHtml(item.description || 'אין תיאור')}</p>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-primary btn-block" onclick="RM.SWIPE.contactPublisher(${item.id})">📩 שלח/י הודעה</button>
        <a class="btn btn-outline" href="/listings/${item.id}">פרטים מלאים</a>
      </div>`;
    overlay.classList.add('open');
    drawer.classList.add('open');
    overlay.addEventListener('click', closeDetail, { once: true });
  }

  function row(label, val) {
    const v = Math.round(val || 0);
    return `<div><small>${label}</small><div style="background:var(--border);height:6px;border-radius:99px;overflow:hidden;"><div style="height:100%;background:var(--coral-gradient);width:${v}%;"></div></div><small>${v}%</small></div>`;
  }

  function closeDetail() {
    document.getElementById('detail-overlay')?.classList.remove('open');
    document.getElementById('detail-drawer')?.classList.remove('open');
  }

  async function contactPublisher(listingId) {
    try {
      const res = await RM.apiFetch('/chat/api/conversations/start', {
        method: 'POST', body: { listing_id: listingId },
      });
      window.location.href = res.redirect;
    } catch (e) { RM.toast(e.message, 'error'); }
  }

  // --------------------------------------------------------------------------
  // Bindings
  // --------------------------------------------------------------------------
  if (minScoreInput) {
    minScoreInput.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      if (minScoreLabel) minScoreLabel.textContent = v + '%';
      load(v);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') stack.swipe('right');
    else if (e.key === 'ArrowLeft') stack.swipe('left');
    else if (e.key === 'ArrowUp') stack.swipe('top');
    else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) stack.rewind();
  });

  // Tap-to-detail (the library already swallows drags; a click on a non-no-drag area = tap)
  deck.addEventListener('click', (e) => {
    if (e.target.closest('[data-rmcs-no-drag]')) return;
    if (stack.currentItem) openDetail(stack.currentItem);
  });

  // Public surface for the floating action bar
  window.RM.SWIPE = {
    swipeRight: () => stack.swipe('right'),
    swipeLeft:  () => stack.swipe('left'),
    swipeUp:    () => stack.swipe('top'),
    undo:       () => stack.rewind(),
    closeDetail,
    contactPublisher,
    demoMatch,
    stack,
  };

  // --------------------------------------------------------------------------
  // Match celebration (kept here, not in the library — it's app-specific)
  // --------------------------------------------------------------------------
  function demoMatch(payload) {
    const root = document.getElementById('match-root');
    if (!root) return;
    const me = (window.RM_CONFIG || {}).currentUser || {};
    const other = (payload && payload.other) || { first_name: 'בעל הדירה', initials: '?' };
    root.innerHTML = `
      <canvas class="confetti-canvas"></canvas>
      <div class="match-celebration">
        <div class="match-celebration-card">
          <h1>התאמה! 🎉</h1>
          <p>שניכם אהבתם — זמן לפתוח שיחה.</p>
          <div class="match-avatars">
            <div class="match-avatar">${RM.escapeHtml((me.firstName || '?').slice(0, 1))}</div>
            <div class="match-heart">💖</div>
            <div class="match-avatar">${RM.escapeHtml(other.initials || '?')}</div>
          </div>
          <div class="match-celebration-actions">
            <button class="btn btn-outline" onclick="document.getElementById('match-root').innerHTML=''">המשך לגלוש</button>
          </div>
        </div>
      </div>`;
    runConfetti(root.querySelector('canvas'));
  }

  function runConfetti(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;
    const colors = ['#FF4458', '#FF7854', '#06B6D4', '#10B981', '#F59E0B'];
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

  // Init
  load(0);
})();
