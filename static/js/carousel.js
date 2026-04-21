/* Photo carousel with swipe — attach to any container matching `.rm-carousel`.
   Container expects: <div class="rm-carousel" data-images='[{"url":"..."},...]'></div> */
(function () {
  function mount(el) {
    let imgs = [];
    try { imgs = JSON.parse(el.dataset.images || '[]'); } catch (e) { return; }
    if (!imgs.length) {
      el.innerHTML = '<div class="rm-carousel-placeholder">🏠</div>';
      return;
    }

    el.classList.add('rm-carousel');
    let idx = 0;

    const track = document.createElement('div');
    track.className = 'rm-carousel-track';
    imgs.forEach((img, i) => {
      const slide = document.createElement('div');
      slide.className = 'rm-carousel-slide';
      slide.style.backgroundImage = `url("${img.url}")`;
      track.appendChild(slide);
    });

    const dots = document.createElement('div');
    dots.className = 'rm-carousel-dots';
    imgs.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'rm-carousel-dot' + (i === 0 ? ' active' : '');
      d.addEventListener('click', (e) => { e.stopPropagation(); go(i); });
      dots.appendChild(d);
    });

    el.innerHTML = '';
    el.appendChild(track);
    el.appendChild(dots);

    function go(i) {
      idx = Math.max(0, Math.min(imgs.length - 1, i));
      track.style.transform = `translateX(${idx * (el.dir === 'rtl' ? 100 : -100)}%)`;
      dots.querySelectorAll('.rm-carousel-dot').forEach((d, di) => {
        d.classList.toggle('active', di === idx);
      });
    }

    let startX = 0, currentX = 0, dragging = false;
    el.addEventListener('pointerdown', (e) => {
      dragging = true; startX = e.clientX; currentX = 0;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      currentX = e.clientX - startX;
    });
    el.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(currentX) > 50) {
        go(idx + (currentX < 0 ? 1 : -1));
      }
      currentX = 0;
    });

    // Click zones: left half prev, right half next
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('rm-carousel-dot')) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) go(idx - 1); else go(idx + 1);
    });
  }

  function mountAll() {
    document.querySelectorAll('.rm-carousel[data-images]:not([data-mounted])').forEach(el => {
      el.dataset.mounted = '1';
      mount(el);
    });
  }

  window.RMCarousel = { mount, mountAll };
  document.addEventListener('DOMContentLoaded', mountAll);
})();
