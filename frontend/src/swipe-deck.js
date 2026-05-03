// Reusable Tinder-style swipe deck.
//
// Usage:
//   mountSwipeDeck({
//     container,        // DOM element to host the cards
//     items,            // array of data items
//     renderCard,       // (item) => HTMLElement (the card markup)
//     onSwipe,          // (item, direction: 'left'|'right'|'up') => void
//     onEmpty,          // optional () => void, fired when last card is swiped away
//   });
//
// The deck handles:
//  - cards stacked top-down, last item rendered first so newest is on top
//  - horizontal-only Hammer pan (vertical scroll inside the card stays native)
//  - velocity-based fly-off animation when |dx| >= threshold
//  - visual rotation during pan
//  - .removed class while flying off

const PAN_THRESHOLD = 80;

export function mountSwipeDeck({ container, items, renderCard, onSwipe, onEmpty }) {
  if (!container) return;
  container.innerHTML = '';

  const reversed = items.slice().reverse();

  reversed.forEach((item) => {
    const card = renderCard(item);
    if (!card) return;
    container.appendChild(card);

    const hammer = new Hammer(card, { touchAction: 'pan-y' });
    hammer.get('pan').set({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 12 });

    hammer.on('pan', (ev) => {
      if (ev.deltaX === 0) return;
      if (ev.center.x === 0 && ev.center.y === 0) return;
      const rotate = ev.deltaX * 0.05;
      card.style.transform = `translate(${ev.deltaX}px, 0) rotate(${rotate}deg)`;
    });

    hammer.on('panend', (ev) => {
      const keep = Math.abs(ev.deltaX) < PAN_THRESHOLD;
      card.classList.toggle('removed', !keep);

      if (keep) {
        card.style.transform = '';
        return;
      }
      const endX = Math.max(Math.abs(ev.velocity * 800), 300);
      const toX = ev.deltaX > 0 ? endX : -endX;
      const rotate = ev.deltaX * 0.03;
      card.style.transform = `translate(${toX}px, 0) rotate(${rotate}deg)`;
      const direction = ev.deltaX > 0 ? 'right' : 'left';
      const isLast = container.children.length === 1;
      setTimeout(() => card.remove(), 300);
      try {
        onSwipe && onSwipe(item, direction);
      } finally {
        if (isLast && onEmpty) setTimeout(onEmpty, 320);
      }
    });
  });
}

export function programmaticSwipe(container, direction, onSwipe, onEmpty, items) {
  const cards = container.querySelectorAll('.swipe-card:not(.removed)');
  if (!cards.length) return;
  const topCard = cards[cards.length - 1];
  topCard.classList.add('removed');

  let toX = 0;
  let toY = 0;
  if (direction === 'left') toX = -1000;
  if (direction === 'right') toX = 1000;
  if (direction === 'up') toY = -1000;

  topCard.style.transform = `translate(${toX}px, ${toY}px) rotate(${toX * 0.03}deg)`;
  setTimeout(() => topCard.remove(), 300);

  const id = topCard.dataset.id;
  const item = items.find((it) => String(it.id) === String(id));
  const normalizedDir = direction === 'up' ? 'right' : direction;
  const isLast = container.children.length === 1;
  if (item) onSwipe && onSwipe(item, normalizedDir);
  if (isLast && onEmpty) setTimeout(onEmpty, 320);
}
