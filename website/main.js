const root = document.documentElement;
const themeStorageKey = 'exlocal.website.theme';
const toggleButtons = document.querySelectorAll('[data-theme-toggle]');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const mobileDemoQuery = window.matchMedia('(max-width: 760px), (pointer: coarse)');

function getInitialTheme() {
  const stored = localStorage.getItem(themeStorageKey);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return prefersDark.matches ? 'dark' : 'light';
}

function setTheme(theme, persist = true) {
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  if (persist) {
    localStorage.setItem(themeStorageKey, theme);
  }
  toggleButtons.forEach((button) => {
    button.setAttribute('aria-label', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    button.dataset.themeState = theme;
  });
}

setTheme(getInitialTheme(), false);

toggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });
});

prefersDark.addEventListener('change', (event) => {
  if (!localStorage.getItem(themeStorageKey)) {
    setTheme(event.matches ? 'dark' : 'light', false);
  }
});

const backupPath = document.querySelector('[data-backup-path]');
if (backupPath) {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) {
    backupPath.textContent = '%LOCALAPPDATA%\\com.exbook.exlocal\\backups';
  } else if (platform.includes('linux')) {
    backupPath.textContent = '~/.local/share/com.exbook.exlocal/backups';
  }
}

function setupDemoEntry() {
  if (document.body.dataset.page !== 'demo') {
    return;
  }

  const locked = mobileDemoQuery.matches;
  document.body.classList.toggle('is-mobile-demo-locked', locked);

  if (!locked) {
    window.location.replace('./app/');
  }
}

setupDemoEntry();
mobileDemoQuery.addEventListener('change', setupDemoEntry);
