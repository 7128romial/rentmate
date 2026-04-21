/* PWA service worker registration + add-to-home-screen prompt. */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => { /* ignore */ });
    });
  }

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.createElement('div');
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <span>התקן את RentMate במסך הבית</span>
      <button class="btn btn-primary btn-sm" id="pwa-install-yes">התקן</button>
      <button class="btn btn-ghost btn-sm" id="pwa-install-no">לא תודה</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('pwa-install-yes').addEventListener('click', async () => {
      banner.remove();
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      }
    });
    document.getElementById('pwa-install-no').addEventListener('click', () => {
      banner.remove();
      localStorage.setItem('rm_pwa_dismissed', '1');
    });
    if (localStorage.getItem('rm_pwa_dismissed') === '1') banner.remove();
  });
})();
