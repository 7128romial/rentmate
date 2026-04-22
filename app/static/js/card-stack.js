/* ============================================================== *
 * RMCardStack — vanilla-JS port of yuyakaido/CardStackView (Android)
 * https://github.com/yuyakaido/CardStackView
 *
 * Provides a configurable Tinder-style swipeable card stack with the
 * same public API surface as the Android library so that future card
 * stack screens (matches, candidates, etc.) can reuse it.
 *
 * Usage:
 *   const stack = new RMCardStack(containerEl, {
 *     stackFrom: 'bottom', visibleCount: 3,
 *     translationInterval: 8, scaleInterval: 0.95,
 *     swipeThreshold: 0.3, maxDegree: 20,
 *     swipeDirection: 'horizontal',  // 'horizontal' | 'vertical' | 'freedom'
 *     canScrollHorizontal: true, canScrollVertical: true,
 *     swipeableMethod: 'both',       // 'both' | 'auto' | 'manual' | 'none'
 *     overlayInterpolator: t => t,   // linear by default
 *     listeners: {
 *       onCardDragging:    ({direction, ratio}) => {},
 *       onCardSwiped:      ({direction, item}) => {},
 *       onCardRewound:     ({item}) => {},
 *       onCardCanceled:    ({item}) => {},
 *       onCardAppeared:    ({el, position, item}) => {},
 *       onCardDisappeared: ({el, position, item}) => {},
 *     },
 *     renderCard: (item, layer, helpers) => htmlString,  // required
 *   });
 *   stack.setItems([...]);
 *   stack.swipe('right'); stack.rewind();
 * ========================================================================== */

(function () {
  const DIRECTIONS = ['left', 'right', 'top', 'bottom'];

  const DEFAULTS = {
    stackFrom: 'none',                // 'none' | 'top' | 'bottom' | 'left' | 'right'
    visibleCount: 3,
    translationInterval: 8,           // px between stacked cards
    scaleInterval: 0.95,              // each layer is 95% of previous
    swipeThreshold: 0.3,              // 0..1 — proportion of card width to confirm swipe
    maxDegree: 20,                    // max rotation in degrees while dragging
    swipeDirection: 'horizontal',     // 'horizontal' | 'vertical' | 'freedom'
    canScrollHorizontal: true,
    canScrollVertical: true,
    swipeableMethod: 'both',          // 'both' | 'auto' | 'manual' | 'none'
    swipeAnimationDuration: 350,      // ms
    rewindAnimationDuration: 300,
    overlayInterpolator: (t) => t,    // linear
    listeners: {},
    renderCard: () => '<div></div>',
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pointerXY(e) {
    if (e.clientX !== undefined) return { x: e.clientX, y: e.clientY };
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: 0, y: 0 };
  }

  class RMCardStack {
    constructor(container, opts) {
      this.container = container;
      this.opts = Object.assign({}, DEFAULTS, opts || {});
      this.opts.listeners = Object.assign({}, opts && opts.listeners);
      this.items = [];
      this.idx = 0;
      this.history = [];   // { idx, direction } — for rewind
      this.container.classList.add('rmcs-deck');
      this.container.style.position = 'relative';
      this.container.style.touchAction = 'none';
    }

    setItems(items) {
      this.items = (items || []).slice();
      this.idx = 0;
      this.history = [];
      this._render();
    }

    appendItems(more) {
      this.items = this.items.concat(more || []);
      this._render();
    }

    get currentItem() { return this.items[this.idx]; }
    get remaining() { return Math.max(0, this.items.length - this.idx); }

    // ---------- Public actions ----------
    swipe(direction) {
      if (!this._isAutoAllowed()) return;
      if (!DIRECTIONS.includes(direction)) return;
      this._animateOff(direction);
    }

    rewind() {
      const last = this.history.pop();
      if (last == null) return;
      this.idx = last.idx;
      this._render();
      this._fire('onCardRewound', { item: this.currentItem });
    }

    // ---------- Internal rendering ----------
    _render() {
      const old = Array.from(this.container.querySelectorAll('.rmcs-card'));
      old.forEach(el => {
        const item = el._rmcsItem;
        const pos = el._rmcsPosition;
        this._fire('onCardDisappeared', { el, position: pos, item });
        el.remove();
      });
      this.container.innerHTML = '';

      if (this.idx >= this.items.length) {
        this._renderEmpty();
        return;
      }

      const visible = Math.min(this.opts.visibleCount, this.items.length - this.idx);
      // Render back-to-front so the front card is last in DOM (highest stacking order).
      for (let layer = visible - 1; layer >= 0; layer--) {
        const itemIdx = this.idx + layer;
        const item = this.items[itemIdx];
        const card = this._buildCard(item, layer);
        card._rmcsItem = item;
        card._rmcsPosition = itemIdx;
        this.container.appendChild(card);
        this._fire('onCardAppeared', { el: card, position: itemIdx, item });
      }

      // Wire drag only on the front card (the actionable one).
      const front = this.container.querySelector('.rmcs-card.rmcs-front');
      if (front) this._wireDrag(front);
    }

    _renderEmpty() {
      const slot = this.container.querySelector('.rmcs-empty');
      if (slot) slot.style.display = '';
    }

    _buildCard(item, layer) {
      const el = document.createElement('div');
      el.className = 'rmcs-card' + (layer === 0 ? ' rmcs-front' : '');
      el.style.position = 'absolute';
      el.style.inset = '0';
      el.style.willChange = 'transform, opacity';
      el.style.transition = layer === 0
        ? 'box-shadow 0.2s'
        : 'transform 0.25s ease, opacity 0.25s';

      // Layer offsets — direction depends on stackFrom
      const tx = layer * this._stackOffsetX();
      const ty = layer * this._stackOffsetY();
      const scale = Math.pow(this.opts.scaleInterval, layer);
      el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      el.style.zIndex = String(1000 - layer);
      if (layer === this.opts.visibleCount - 1) el.style.opacity = '0.5';

      // Skeleton overlays — author's renderCard may add real content too
      const overlays = `
        <div class="rmcs-overlay rmcs-overlay-left" data-rmcs-overlay="left"></div>
        <div class="rmcs-overlay rmcs-overlay-right" data-rmcs-overlay="right"></div>
        <div class="rmcs-overlay rmcs-overlay-top" data-rmcs-overlay="top"></div>
        <div class="rmcs-overlay rmcs-overlay-bottom" data-rmcs-overlay="bottom"></div>`;

      el.innerHTML = this.opts.renderCard(item, layer, {
        overlayMarkup: overlays,
      }) + overlays;

      return el;
    }

    _stackOffsetX() {
      const t = this.opts.translationInterval;
      switch (this.opts.stackFrom) {
        case 'left': return -t;
        case 'right': return t;
        default: return 0;
      }
    }
    _stackOffsetY() {
      const t = this.opts.translationInterval;
      switch (this.opts.stackFrom) {
        case 'top': return -t;
        case 'bottom':
        default: return t;
        case 'none': return 0;
      }
    }

    // ---------- Drag handling ----------
    _wireDrag(el) {
      let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false, startTime = 0;
      const overlays = {};
      DIRECTIONS.forEach(d => { overlays[d] = el.querySelector(`[data-rmcs-overlay="${d}"]`); });

      const onDown = (e) => {
        if (!this._isManualAllowed()) return;
        if (e.target.closest('[data-rmcs-no-drag]')) return;
        dragging = true; startTime = Date.now();
        const p = pointerXY(e);
        startX = p.x; startY = p.y; dx = 0; dy = 0;
        el.style.transition = 'none';
        try { el.setPointerCapture && e.pointerId != null && el.setPointerCapture(e.pointerId); } catch (_) {}
      };

      const onMove = (e) => {
        if (!dragging) return;
        const p = pointerXY(e);
        let nextDx = p.x - startX;
        let nextDy = p.y - startY;
        if (!this.opts.canScrollHorizontal || this.opts.swipeDirection === 'vertical') nextDx = 0;
        if (!this.opts.canScrollVertical || this.opts.swipeDirection === 'horizontal') nextDy = 0;
        dx = nextDx; dy = nextDy;
        this._applyDragTransform(el, dx, dy);
        const { direction, ratio } = this._dragSignal(dx, dy);
        this._updateOverlays(overlays, dx, dy);
        this._fire('onCardDragging', { direction, ratio });
      };

      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        const { direction, ratio } = this._dragSignal(dx, dy);
        const velocity = Math.hypot(dx, dy) / Math.max(1, Date.now() - startTime);
        if (ratio >= this.opts.swipeThreshold || velocity > 0.6) {
          this._animateOff(direction);
        } else {
          // Cancel — snap back
          el.style.transition = 'transform 0.25s ease';
          el.style.transform = '';
          DIRECTIONS.forEach(d => { if (overlays[d]) overlays[d].style.opacity = '0'; });
          this._fire('onCardCanceled', { item: this.currentItem });
        }
      };

      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('pointerleave', onUp);
    }

    _applyDragTransform(el, dx, dy) {
      const w = el.clientWidth || 1;
      const rotation = clamp(dx / w, -1, 1) * this.opts.maxDegree;
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`;
    }

    _dragSignal(dx, dy) {
      const el = this.container.querySelector('.rmcs-front');
      const w = (el && el.clientWidth) || this.container.clientWidth || 1;
      const h = (el && el.clientHeight) || this.container.clientHeight || 1;
      const rx = dx / w;
      const ry = dy / h;
      let direction = 'right', primary = 0;
      const absRx = Math.abs(rx), absRy = Math.abs(ry);
      if (this.opts.swipeDirection === 'horizontal' || absRx >= absRy) {
        direction = dx >= 0 ? 'right' : 'left';
        primary = absRx;
      } else {
        direction = dy >= 0 ? 'bottom' : 'top';
        primary = absRy;
      }
      return { direction, ratio: this.opts.overlayInterpolator(clamp(primary, 0, 1)) };
    }

    _updateOverlays(overlays, dx, dy) {
      const el = this.container.querySelector('.rmcs-front');
      const w = (el && el.clientWidth) || 1;
      const h = (el && el.clientHeight) || 1;
      const rx = dx / w, ry = dy / h;
      const interp = this.opts.overlayInterpolator;
      if (overlays.right) overlays.right.style.opacity = interp(clamp(rx, 0, 1));
      if (overlays.left) overlays.left.style.opacity = interp(clamp(-rx, 0, 1));
      if (overlays.bottom) overlays.bottom.style.opacity = interp(clamp(ry, 0, 1));
      if (overlays.top) overlays.top.style.opacity = interp(clamp(-ry, 0, 1));
    }

    _animateOff(direction) {
      const el = this.container.querySelector('.rmcs-front');
      if (!el) return;
      const item = this.currentItem;
      const w = window.innerWidth, h = window.innerHeight;
      let tx = 0, ty = 0, rot = 0;
      switch (direction) {
        case 'right': tx = w * 1.2; rot = this.opts.maxDegree * 1.2; break;
        case 'left': tx = -w * 1.2; rot = -this.opts.maxDegree * 1.2; break;
        case 'top': ty = -h * 1.2; break;
        case 'bottom': ty = h * 1.2; break;
      }
      el.style.transition = `transform ${this.opts.swipeAnimationDuration}ms ease, opacity ${this.opts.swipeAnimationDuration}ms`;
      el.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
      el.style.opacity = '0';

      this.history.push({ idx: this.idx, direction });
      this.idx += 1;
      this._fire('onCardSwiped', { direction, item });
      setTimeout(() => this._render(), Math.max(150, this.opts.swipeAnimationDuration - 50));
    }

    _isAutoAllowed() { return ['both', 'auto'].includes(this.opts.swipeableMethod); }
    _isManualAllowed() { return ['both', 'manual'].includes(this.opts.swipeableMethod); }

    _fire(name, payload) {
      const fn = this.opts.listeners && this.opts.listeners[name];
      if (typeof fn === 'function') {
        try { fn(payload); } catch (e) { console.error(`[RMCardStack] ${name} listener error`, e); }
      }
    }
  }

  window.RMCardStack = RMCardStack;
})();
