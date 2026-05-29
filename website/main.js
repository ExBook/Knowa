const countdown = document.querySelector('#countdown');
let remaining = 24 * 60;

function tick() {
  if (!countdown) {
    return;
  }
  remaining = remaining <= 20 * 60 ? 24 * 60 : remaining - 1;
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');
  countdown.textContent = `${minutes}:${seconds}`;
}

setInterval(tick, 1000);

const path = document.querySelector('#backup-path');
if (path) {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) {
    path.textContent = '%LOCALAPPDATA%\\com.exbook.exlocal\\backups';
  } else if (platform.includes('linux')) {
    path.textContent = '~/.local/share/com.exbook.exlocal/backups';
  }
}
