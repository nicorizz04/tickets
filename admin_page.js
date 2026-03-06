import { supabase } from './supabaseClient.js';
import { getSession, getMyProfile, signInAdmin, signOut } from './auth.js';
import { escapeHtml, formatDate, getCategoryBadgeClass, getPriorityBadgeClass, getStatusBadgeClass } from './ui_helpers.js';

const PRIORITY_LABELS = { Low: 'Scăzută', Medium: 'Medie', High: 'Înaltă' };
const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'];
const CATEGORY_MAP = { Hardware: 'hardware', Software: 'software' };

let ticketsCache = [];
let currentFilter = 'all';
let prioritySort = 'none'; // 'none', 'asc', 'desc'
let isAdminLoggedIn = false;

function qs(id) { return document.getElementById(id); }

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

async function deleteTicket(id) {
  const t = ticketsCache.find(x => x.id === id);
  if (!t) return;
  if (t.status !== 'Completed') {
    alert('Poți șterge doar tichete Completed.');
    return;
  }
  const ok = confirm('Sigur vrei să ștergi acest tichet (Completed)? Acțiunea este permanentă.');
  if (!ok) return;

  const { error } = await supabase.from('tickets').delete().eq('id', id);
  if (error) throw error;

  ticketsCache = ticketsCache.filter(x => x.id !== id);
  updateStats(ticketsCache);
  renderTickets();
}

function renderTickets() {
  const tbody = qs('tickets-tbody');
  if (!tbody) return;

  let filtered = currentFilter === 'all'
    ? ticketsCache.slice()
    : ticketsCache.filter(t => CATEGORY_MAP[t.category] === currentFilter);

  // priority sort if requested
  const PRIORITY_MAP = { Low: 1, Medium: 2, High: 3 };
  if (prioritySort === 'asc' || prioritySort === 'desc') {
    filtered.sort((a, b) => {
      const va = PRIORITY_MAP[a.priority] || 0;
      const vb = PRIORITY_MAP[b.priority] || 0;
      return prioritySort === 'asc' ? va - vb : vb - va;
    });
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Niciun tichet.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    const shortId = t.id ? t.id.slice(0, 8) : '–';
    const canDelete = t.status === 'Completed';
    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
        <td class="px-6 py-4 font-mono text-sm text-gray-600 dark:text-gray-400">#${shortId}</td>
        <td class="px-6 py-4 font-medium text-gray-800 dark:text-gray-200">${escapeHtml(t.description || '–').substring(0, 80)}${(t.description && t.description.length > 80) ? '…' : ''}</td>
        <td class="px-6 py-4"><span class="px-2.5 py-1 text-xs font-medium rounded-full ${getCategoryBadgeClass(t.category)}">${escapeHtml(t.category)}</span></td>
        <td class="px-6 py-4">
          <select class="status-select px-2.5 py-1 text-xs font-medium rounded-full border-0 cursor-pointer ${getStatusBadgeClass(t.status)}"
                  data-id="${t.id}">
            ${STATUS_OPTIONS.map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td class="px-6 py-4"><span class="px-2.5 py-1 text-xs font-medium rounded-full ${getPriorityBadgeClass(t.priority)}">${PRIORITY_LABELS[t.priority] || t.priority}</span></td>
        <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">${formatDate(t.created_at)}</td>
        <td class="px-6 py-4">
          ${canDelete
            ? `<button type="button" class="delete-btn px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition" data-id="${t.id}">Șterge</button>`
            : `<span class="text-xs text-gray-400">—</span>`}
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async function () {
      const id = this.dataset.id;
      const newStatus = this.value;
      try {
        const { error } = await supabase.from('tickets').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
        const t = ticketsCache.find(x => x.id === id);
        if (t) t.status = newStatus;
        updateStats(ticketsCache);
        renderTickets();
      } catch (err) {
        alert(err.message || 'Nu pot actualiza statusul.');
      }
    });
  });

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async function () {
      const id = this.dataset.id;
      try {
        await deleteTicket(id);
      } catch (err) {
        alert(err.message || 'Nu pot șterge tichetul.');
      }
    });
  });
}

async function fetchAllTickets() {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  ticketsCache = data || [];
  updateStats(ticketsCache);
  renderTickets();
}

async function showApp() {
  sessionStorage.setItem('adminLoggedIn', 'true');
  qs('auth-section')?.classList.add('hidden');
  qs('app-section')?.classList.remove('hidden');
  qs('logout-btn')?.classList.remove('hidden');
  await fetchAllTickets();
}

async function showAuth() {
  sessionStorage.removeItem('adminLoggedIn');
  qs('auth-section')?.classList.remove('hidden');
  qs('app-section')?.classList.add('hidden');
  qs('logout-btn')?.classList.add('hidden');
}

async function boot() {
  qs('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthMessage('');
    try {
      const email = qs('login-email').value.trim();
      const password = qs('login-password').value;
      
      if (!email || !password) {
        throw new Error('Email și parolă sunt obligatorii.');
      }
      
      await signInAdmin({ email, password });
      isAdminLoggedIn = true;
      await showApp();
    } catch (err) {
      setAuthMessage(err.message || 'Login eșuat.', true);
    }
  });

  qs('logout-btn')?.addEventListener('click', async () => {
    await signOut();
    isAdminLoggedIn = false;
    await showAuth();
  });

  // filter buttons
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter || 'all';
      document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('bg-amber-100', 'dark:bg-amber-900/30'));
      btn.classList.add('bg-amber-100', 'dark:bg-amber-900/30');
      renderTickets();
    });
  });

  // priority sort controls
  const prioritySelect = qs('priority-sort');
  const thPriority = qs('th-priority');
  const priorityIndicator = qs('priority-sort-indicator');
  function updatePriorityIndicator() {
    if (!priorityIndicator) return;
    if (prioritySort === 'asc') priorityIndicator.textContent = '↑';
    else if (prioritySort === 'desc') priorityIndicator.textContent = '↓';
    else priorityIndicator.textContent = '';
  }
  if (prioritySelect) {
    prioritySelect.addEventListener('change', function () {
      prioritySort = this.value;
      updatePriorityIndicator();
      renderTickets();
    });
  }
  if (thPriority) {
    thPriority.addEventListener('click', () => {
      if (prioritySort === 'none') prioritySort = 'asc';
      else if (prioritySort === 'asc') prioritySort = 'desc';
      else prioritySort = 'none';
      if (prioritySelect) prioritySelect.value = prioritySort;
      updatePriorityIndicator();
      renderTickets();
    });
  }

  // initialize arrow indicator even before any sorting chosen
  updatePriorityIndicator();

  // Check if admin is already logged in (stored in session storage)
  if (sessionStorage.getItem('adminLoggedIn') === 'true') {
    const session = await getSession();
    if (session) {
      try {
        const profile = await getMyProfile();
        if (profile && profile.role === 'admin') {
          isAdminLoggedIn = true;
          await showApp();
        } else {
          await showAuth();
        }
      } catch {
        await showAuth();
      }
    } else {
      await showAuth();
    }
  } else {
    await showAuth();
  }
}

boot();

