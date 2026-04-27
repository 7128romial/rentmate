import { setSubrole } from './src/storage.js';

document.querySelectorAll('.choice-card').forEach((btn) => {
  btn.addEventListener('click', () => {
    const sub = btn.dataset.subrole;
    setSubrole(sub);
    if (sub === 'host') window.location.href = '/roommate_host.html';
    else window.location.href = '/roommate_seeker.html';
  });
});
