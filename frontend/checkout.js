import { API_BASE, authHeaders, getToken } from './src/config.js';
import { renderBottomNav } from './src/nav.js';
import { setSubscription } from './src/storage.js';

renderBottomNav('profile');

const form = document.getElementById('checkout-form');
const submitBtn = document.getElementById('checkout-submit');
const btnText = submitBtn.querySelector('.checkout-btn-text');
const btnSpinner = submitBtn.querySelector('.checkout-btn-spinner');
const priceEl = document.getElementById('checkout-price');
const btnAmountEl = document.getElementById('checkout-btn-amount');

const ccNumber = document.getElementById('cc-number');
const ccExp = document.getElementById('cc-exp');
const ccCvv = document.getElementById('cc-cvv');

// Format card number as "4242 4242 4242 4242"
ccNumber.addEventListener('input', () => {
  const digits = ccNumber.value.replace(/\D/g, '').slice(0, 16);
  ccNumber.value = digits.replace(/(.{4})/g, '$1 ').trim();
});
// Format expiry as "MM/YY"
ccExp.addEventListener('input', () => {
  let d = ccExp.value.replace(/\D/g, '').slice(0, 4);
  if (d.length >= 3) d = `${d.slice(0, 2)}/${d.slice(2)}`;
  ccExp.value = d;
});
ccCvv.addEventListener('input', () => {
  ccCvv.value = ccCvv.value.replace(/\D/g, '').slice(0, 4);
});

async function fetchPrice() {
  try {
    const res = await fetch(`${API_BASE}/api/subscription`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const price = data.price_nis || 29;
    priceEl.textContent = String(price);
    btnAmountEl.textContent = String(price);
    if (data.tier === 'pro') {
      // Already PRO — redirect to profile
      window.location.href = '/profile.html';
    }
  } catch (e) {
    /* ignore — keep defaults */
  }
}
fetchPrice();

function basicValidate() {
  const digits = ccNumber.value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) {
    alert('מספר הכרטיס לא תקין');
    return false;
  }
  if (!/^\d{2}\/\d{2}$/.test(ccExp.value)) {
    alert('תוקף בפורמט MM/YY');
    return false;
  }
  if (ccCvv.value.length < 3) {
    alert('CVV דורש 3 ספרות לפחות');
    return false;
  }
  return true;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!basicValidate()) return;

  submitBtn.disabled = true;
  btnText.hidden = true;
  btnSpinner.hidden = false;

  try {
    const intentRes = await fetch(`${API_BASE}/api/subscription/checkout`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    if (!intentRes.ok) throw new Error('checkout failed');
    const intent = await intentRes.json();

    // Simulate payment processing delay
    await new Promise((r) => setTimeout(r, 800));

    const confirmRes = await fetch(`${API_BASE}/api/subscription/confirm`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ intent_id: intent.intent_id }),
    });
    if (!confirmRes.ok) throw new Error('confirm failed');
    const confirmed = await confirmRes.json();
    setSubscription(confirmed.tier || 'pro');

    btnText.textContent = '✓ שודרגת ל-PRO!';
    btnSpinner.hidden = true;
    btnText.hidden = false;
    setTimeout(() => {
      window.location.href = '/profile.html';
    }, 900);
  } catch (err) {
    console.error(err);
    btnSpinner.hidden = true;
    btnText.hidden = false;
    submitBtn.disabled = false;
    alert('משהו השתבש. נסי שוב בעוד רגע.');
  }
});
