const SEEN_KEY = 'rentmate_seen_welcome';

document.getElementById('welcome-cta').addEventListener('click', () => {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch (e) {
    /* ignore */
  }
  window.location.href = '/';
});
