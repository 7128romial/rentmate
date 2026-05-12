import {
  canSwipeToday,
  getSubscription,
  setSubscription,
  remainingSwipesToday,
  FREE_DAILY_SWIPE_LIMIT,
  syncSubscriptionFromBackend,
} from './storage.js';

function buildModal() {
  const existing = document.getElementById('subscription-limit-modal');
  if (existing) return existing;
  const overlay = document.createElement('div');
  overlay.id = 'subscription-limit-modal';
  overlay.className = 'sub-modal-overlay';
  overlay.innerHTML = `
    <div class="sub-modal">
      <div class="sub-modal-badge">PRO</div>
      <h2 class="sub-modal-title">הגעת למכסה היומית</h2>
      <p class="sub-modal-body">
        במסלול החינמי אפשר ${FREE_DAILY_SWIPE_LIMIT} סוויפים ליום.<br>
        שדרגי ל-PRO וקבלי סוויפים ללא הגבלה, סינון מתקדם, וגישה ראשונה לדירות חדשות.
      </p>
      <ul class="sub-modal-perks">
        <li>סוויפים ללא הגבלה</li>
        <li>סינון מתקדם וסידור לפי התאמה</li>
        <li>צ'אט AI מורחב</li>
        <li>תמיכה מהירה</li>
      </ul>
      <div class="sub-modal-actions">
        <button type="button" class="sub-modal-upgrade">שדרג ל-PRO</button>
        <button type="button" class="sub-modal-close">לא עכשיו</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLimitModal();
  });
  overlay.querySelector('.sub-modal-close').addEventListener('click', closeLimitModal);
  overlay.querySelector('.sub-modal-upgrade').addEventListener('click', () => {
    window.location.href = '/checkout.html';
  });
  return overlay;
}

export function openLimitModal() {
  const overlay = buildModal();
  overlay.classList.add('show');
}

export function closeLimitModal() {
  const overlay = document.getElementById('subscription-limit-modal');
  if (overlay) overlay.classList.remove('show');
}

export { canSwipeToday, getSubscription, setSubscription, remainingSwipesToday, FREE_DAILY_SWIPE_LIMIT, syncSubscriptionFromBackend };
