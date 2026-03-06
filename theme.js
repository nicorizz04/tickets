// Dark mode manager
export function initDarkMode() {
  const html = document.documentElement;
  const toggle = document.getElementById('dark-mode-toggle');
  
  // Load saved preference or default to light
  const isDark = localStorage.getItem('darkMode') === 'true';
  setDarkMode(isDark);
  
  if (toggle) {
    toggle.checked = isDark;
    toggle.addEventListener('change', () => {
      const newDarkMode = toggle.checked;
      setDarkMode(newDarkMode);
      localStorage.setItem('darkMode', newDarkMode);
    });
  }
}

function setDarkMode(isDark) {
  const html = document.documentElement;
  if (isDark) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}
