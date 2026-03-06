import { signUpUser } from './auth.js';

const ADMIN_KEY = 'admin123'; // Cod secret pentru a fi admin

function qs(id) { return document.getElementById(id); }

function setMessage(msg, isError = false) {
  const el = qs('register-message');
  if (!el) return;
  el.textContent = msg || '';
  el.className = `mt-4 text-sm text-center ${isError ? 'text-red-600' : 'text-green-600'}`;
}

// Detectează mode din URL (user sau admin)
function detectMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') || 'user';
}

async function boot() {
  const mode = detectMode();
  const isAdmin = mode === 'admin';

  // Update UI based on mode
  if (isAdmin) {
    qs('page-title').textContent = 'Creare Cont Admin';
    qs('page-subtitle').textContent = 'Înregistrează-te ca administrator';
    qs('admin-section').classList.remove('hidden');
    qs('login-link-admin').classList.remove('hidden');
    qs('login-link-client').classList.add('hidden');
    qs('submit-btn').classList.remove('from-primary', 'to-primary/80', 'hover:from-primary/90', 'hover:to-primary/70');
    qs('submit-btn').classList.add('from-amber-500', 'to-amber-600', 'hover:from-amber-600', 'hover:to-amber-700');
  } else {
    qs('page-title').textContent = 'Creare Cont Client';
    qs('page-subtitle').textContent = 'Înregistrează-te pentru a submite tichete';
    qs('login-link-client').classList.remove('hidden');
    qs('login-link-admin').classList.add('hidden');
  }

  // Login links
  qs('login-link-client')?.addEventListener('click', () => {
    window.location.href = 'user_page.html';
  });
  
  qs('login-link-admin')?.addEventListener('click', () => {
    window.location.href = 'admin_page.html';
  });

  qs('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage('');

    const fullName = qs('register-name').value.trim();
    const email = qs('register-email').value.trim();
    const password = qs('register-password').value;
    const confirmPassword = qs('register-password-confirm').value;
    const adminKey = qs('register-admin-key').value;

    // Validation
    if (!fullName) {
      setMessage('Introduceti numele complet.', true);
      return;
    }
    if (!email) {
      setMessage('Introduceti emailul.', true);
      return;
    }
    if (password.length < 8) {
      setMessage('Parola trebuie să aibă cel puțin 8 caractere.', true);
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Parolele nu se potrivesc.', true);
      return;
    }
    if (isAdmin && adminKey !== ADMIN_KEY) {
      setMessage('Cod admin incorect.', true);
      return;
    }

    try {
      setMessage('Se procesează înregistrarea...');
      const role = isAdmin ? 'admin' : 'user';
      await signUpUser({ email, password, fullName, role });
      setMessage('Cont creat cu succes! Te vei conecta acum.');
      
      setTimeout(() => {
        window.location.href = isAdmin ? 'admin_page.html' : 'user_page.html';
      }, 2000);
    } catch (err) {
      setMessage(err.message || 'Înregistrare eșuată.', true);
    }
  });
}

boot();
