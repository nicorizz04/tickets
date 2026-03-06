import { supabase } from './supabaseClient.js';
import { getSession, getUser, getMyProfile, signIn, signOut, signUpUser } from './auth.js';
import { escapeHtml, formatDate, getCategoryBadgeClass, getPriorityBadgeClass, getStatusBadgeClass } from './ui_helpers.js';
import { classifyTicket, summarizeTickets, detectCategory, detectPriority } from './ai.js';

const PRIORITY_LABELS = { Low: 'Scăzută', Medium: 'Medie', High: 'Înaltă' };

let ticketsCache = [];

function qs(id) { return document.getElementById(id); }

function openModal() {
  qs('modal')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  qs('modal')?.classList.add('hidden');
  document.body.style.overflow = '';
}

function setAuthMessage(msg, isError = false) {
  const el = qs('auth-message');
  if (!el) return;
  el.textContent = msg || '';
  el.className = `mt-4 text-sm ${isError ? 'text-red-600' : 'text-gray-600'}`;
}

function updateStats(tickets) {
  qs('stat-total').textContent = tickets.length;
  qs('stat-pending').textContent = tickets.filter(t => t.status === 'Pending').length;
  qs('stat-completed').textContent = tickets.filter(t => t.status === 'Completed').length;
}

function renderTickets(tickets) {
  const tbody = qs('tickets-tbody');
  if (!tbody) return;
  if (!tickets.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">Nu ai încă tichete.</td></tr>`;
    return;
  }
  tbody.innerHTML = tickets.map(t => {
    const shortId = t.id ? t.id.slice(0, 8) : '–';
    return `
      <tr class="hover:bg-gray-50 transition">
        <td class="px-6 py-4 font-mono text-sm text-gray-600">#${shortId}</td>
        <td class="px-6 py-4 font-medium text-gray-800">
          <div>${escapeHtml(t.description || '–').substring(0, 80)}${(t.description && t.description.length > 80) ? '…' : ''}</div>
          ${t.image_url ? `<a href="${t.image_url}" target="_blank" class="text-xs text-primary hover:underline mt-1 inline-block">🖼️ Vizualizează imagine</a>` : ''}
        </td>
        <td class="px-6 py-4"><span class="px-2.5 py-1 text-xs font-medium rounded-full ${getCategoryBadgeClass(t.category)}">${escapeHtml(t.category)}</span></td>
        <td class="px-6 py-4"><span class="px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(t.status)}">${escapeHtml(t.status)}</span></td>
        <td class="px-6 py-4"><span class="px-2.5 py-1 text-xs font-medium rounded-full ${getPriorityBadgeClass(t.priority)}">${PRIORITY_LABELS[t.priority] || t.priority}</span></td>
        <td class="px-6 py-4 text-sm text-gray-500">${formatDate(t.created_at)}</td>
      </tr>
    `;
  }).join('');
}

async function fetchMyTickets() {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  ticketsCache = data || [];
  updateStats(ticketsCache);
  renderTickets(ticketsCache);
}

async function analyzeDescriptionWithAI() {
  const description = qs('ticket-description')?.value?.trim();
  if (!description || description.length < 10) {
    console.log('[AI] Description too short, skipping analysis');
    return;
  }

  console.log('[AI] Analyzing description:', description.substring(0, 50) + '...');
  
  try {
    const result = await classifyTicket(description);
    console.log('[AI] Classification result:', result);
    
    if (!result) {
      console.error('[AI] No result returned from classification');
      qs('ticket-category').value = 'Software';
      qs('ticket-priority').value = 'Medium';
      return;
    }

    // Set select fields directly
    if (result.category && ['Hardware', 'Software'].includes(result.category)) {
      qs('ticket-category').value = result.category;
      console.log('[AI] Set category to:', result.category);
    } else {
      qs('ticket-category').value = 'Software';
    }

    // Set priority
    if (result.priority && ['Low', 'Medium', 'High'].includes(result.priority)) {
      qs('ticket-priority').value = result.priority;
      console.log('[AI] Set priority to:', result.priority);
    } else {
      qs('ticket-priority').value = 'Medium';
    }
  } catch (err) {
    console.error('[AI] Analysis error:', err);
    // Default fallback
    qs('ticket-category').value = 'Software';
    qs('ticket-category-select').value = 'Software';
    qs('ticket-priority').value = 'Medium';
    qs('ticket-priority-select').value = 'Medium';
  }
}

async function createNewTicket() {
  const user = await getUser();
  if (!user) throw new Error('Nu ești autentificat.');

  const clientName = qs('ticket-client-name')?.value?.trim() || null;
  const category = qs('ticket-category')?.value;
  const priority = qs('ticket-priority')?.value;
  const description = qs('ticket-description')?.value?.trim() || null;
  const imageFile = qs('ticket-image')?.files?.[0];

  if (!description) throw new Error('Descrierea este obligatorie.');

  let imageUrl = null;

  // Upload image if provided
  if (imageFile) {
    // Validate file size (max 5MB)
    if (imageFile.size > 5 * 1024 * 1024) {
      throw new Error('Imaginea este prea mare (maxim 5MB).');
    }

    // Upload to storage
    const fileName = `${user.id}/${Date.now()}_${imageFile.name}`;
    const { data, error: uploadError } = await supabase.storage
      .from('ticket_images')
      .upload(fileName, imageFile);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from('ticket_images')
      .getPublicUrl(fileName);
    imageUrl = publicUrl.publicUrl;
  }

  const { error } = await supabase.from('tickets').insert({
    client_name: clientName,
    created_by: user.id,
    category,
    priority,
    description,
    image_url: imageUrl,
    status: 'Pending'
  });
  if (error) throw error;

  closeModal();
  qs('ticket-form')?.reset();
  qs('ticket-category').value = '...';
  qs('ticket-priority').value = '...';
  await fetchMyTickets();
}

async function showApp() {
  qs('auth-section')?.classList.add('hidden');
  qs('app-section')?.classList.remove('hidden');
  qs('logout-btn')?.classList.remove('hidden');
  await fetchMyTickets();
}

async function showAuth() {
  qs('auth-section')?.classList.remove('hidden');
  qs('app-section')?.classList.add('hidden');
  qs('logout-btn')?.classList.add('hidden');
}

async function boot() {
  // Auth forms
  qs('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthMessage('');
    try {
      await signIn({ email: qs('login-email').value.trim(), password: qs('login-password').value });
      await showApp();
    } catch (err) {
      setAuthMessage(err.message || 'Login eșuat.', true);
    }
  });

  qs('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthMessage('');
    try {
      await signUpUser({
        fullName: qs('reg-fullname').value.trim(),
        email: qs('reg-email').value.trim(),
        password: qs('reg-password').value
      });
      setAuthMessage('Cont creat. Dacă ai email confirmation activ, verifică inboxul.');
    } catch (err) {
      setAuthMessage(err.message || 'Register eșuat.', true);
    }
  });

  qs('logout-btn')?.addEventListener('click', async () => {
    await signOut();
    await showAuth();
  });

  // Modal
  qs('open-modal')?.addEventListener('click', openModal);
  qs('close-modal')?.addEventListener('click', closeModal);
  qs('modal-backdrop')?.addEventListener('click', closeModal);
  
  // AI analysis triggers
  let aiTimeout;
  qs('ticket-description')?.addEventListener('input', () => {
    clearTimeout(aiTimeout);
    aiTimeout = setTimeout(async () => {
      await analyzeDescriptionWithAI();
    }, 1500); // Analyze after 1.5s of inactivity
  });

  qs('ticket-description')?.addEventListener('blur', async () => {
    clearTimeout(aiTimeout);
    await analyzeDescriptionWithAI();
  });

  qs('submit-ticket')?.addEventListener('click', async () => {
    try { await createNewTicket(); } catch (err) { alert(err.message || 'Eroare la creare.'); }
  });


// Bulk analyze button
qs('analyze-all')?.addEventListener('click', async () => {
  try {
    const summary = await summarizeTickets(ticketsCache);
    alert('Rezumat:\n' + summary);
  } catch (err) {
    alert('Eroare la analiza AI: ' + err.message);
  }
});

  // Auto session
  const session = await getSession();
  if (session) {
    // ensure profile exists (optional)
    try { await getMyProfile(); } catch { /* ignore */ }
    await showApp();
  } else {
    await showAuth();
  }
}

boot();

