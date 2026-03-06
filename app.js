/**
 * Ticketing app – Supabase Integration
 * Versiune stabilă - Corecție SQL NOT NULL constraint
 */

const SUPABASE_URL = 'https://btrrerkgrqhfnpjwexmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0cnJlcmtncnFoZm5wandleG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExODY2MTMsImV4cCI6MjA4Njc2MjYxM30.so3voJoc4RfgCbVt4VloPYAM23pFDbFyrplUqjasv_I';

let supabaseClient = null;

// --- INIȚIALIZARE ---
function initSupabase() {
    try {
        if (!window.supabase) {
            console.error('Supabase JS nu este încărcat. Verifică scriptul din HTML.');
            return;
        }
        const { createClient } = window.supabase;
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✓ Supabase client inițializat cu succes');
    } catch (err) {
        console.error('✗ Eroare la inițializarea Supabase:', err);
    }
}

// --- STATE APLICAȚIE ---
let allTickets = [];
let currentFilter = 'all';
let prioritySort = 'none'; // 'none', 'asc', 'desc' (gravitate)

const CATEGORY_MAP = { Hardware: 'hardware', Software: 'software' };
const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'];

// --- HELPERS UI ---
function formatDate(isoString) {
    if (!isoString) return '–';
    const d = new Date(isoString);
    return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'Completed': return 'bg-emerald-100 text-emerald-800';
        case 'In Progress': return 'bg-blue-100 text-blue-800';
        default: return 'bg-amber-100 text-amber-800';
    }
}

function getPriorityBadgeClass(priority) {
    switch (priority) {
        case 'High': return 'bg-red-100 text-red-800';
        case 'Medium': return 'bg-amber-100 text-amber-800';
        default: return 'bg-gray-100 text-gray-700';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// UI helper to show sort indicator arrow in priority header
function updatePriorityIndicator() {
    const priorityIndicator = document.getElementById('priority-sort-indicator');
    if (!priorityIndicator) return;
    if (prioritySort === 'asc') priorityIndicator.textContent = '↑';
    else if (prioritySort === 'desc') priorityIndicator.textContent = '↓';
    else priorityIndicator.textContent = '';
}

// --- OPERAȚIUNI CRUD (SQL) ---

async function fetchTickets() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        allTickets = data || [];
        updateStats(allTickets);
        renderTable(allTickets);
    } catch (err) {
        console.error('Eroare la încărcarea datelor din SQL:', err);
    }
}

async function createNewTicket() {
    if (!supabaseClient) return;

    // COLECTARE DATE DIN FORMULAR
    const clientName = document.getElementById('ticket-client-name')?.value?.trim();
    const category = document.getElementById('ticket-category')?.value;
    const deviceName = document.getElementById('ticket-device-name')?.value?.trim() || 'Nespecificat';
    const priority = document.getElementById('ticket-priority')?.value;
    const description = document.getElementById('ticket-description')?.value?.trim() || '';

    // VALIDARE STRICTĂ (Pentru a evita eroarea NOT NULL din SQL)
    if (!clientName) {
        alert('Câmpul "Nume Client" este obligatoriu!');
        return;
    }

    try {
        // Trimiterea datelor către tabelul SQL din Supabase
        const { data, error } = await supabaseClient.from('tickets').insert({
            client_name: clientName, 
            category: category,
            device_name: deviceName,
            priority: priority,
            description: description,
            status: 'Pending'
        });

        if (error) throw error;
        
        console.log('✓ Tichet salvat în baza de date');
        closeModal();
        resetTicketForm();
        await fetchTickets(); // Refresh tabel după adăugare
    } catch (err) {
        console.error('Eroare SQL la inserare:', err);
        alert('Eroare la salvare: ' + err.message);
    }
}

async function updateTicketStatus(id, newStatus) {
    if (!supabaseClient) return;
    try {
        const { error } = await supabaseClient
            .from('tickets')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) throw error;
        await fetchTickets(); // Refresh date pentru a actualiza badge-urile
    } catch (err) {
        console.error('Eroare la actualizarea statusului:', err);
    }
}

// --- REDARE INTERFAȚĂ ---

function renderTable(tickets) {
    const tbody = document.getElementById('tickets-tbody');
    if (!tbody) return;

    let filtered = currentFilter === 'all'
        ? tickets.slice()   // copy so we can sort safely
        : tickets.filter(t => CATEGORY_MAP[t.category] === currentFilter);

    // sort by priority if requested
    const PRIORITY_MAP = { Low: 1, Medium: 2, High: 3 };
    if (prioritySort === 'asc' || prioritySort === 'desc') {
        filtered.sort((a, b) => {
            const va = PRIORITY_MAP[a.priority] || 0;
            const vb = PRIORITY_MAP[b.priority] || 0;
            return prioritySort === 'asc' ? va - vb : vb - va;
        });
    }

    tbody.innerHTML = filtered.map(ticket => `
        <tr class="hover:bg-gray-50 transition border-b border-gray-100 text-sm">
            <td class="px-6 py-4 font-mono text-xs text-gray-400">#${ticket.id.slice(0,8)}</td>
            <td class="px-6 py-4 font-semibold text-gray-900">${escapeHtml(ticket.client_name)}</td>
            <td class="px-6 py-4 text-gray-600">${escapeHtml(ticket.device_name)}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${ticket.category === 'Software' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}">
                    ${ticket.category}
                </span>
            </td>
            <td class="px-6 py-4">
                <select class="status-select px-2 py-1 rounded border-0 font-bold ${getStatusBadgeClass(ticket.status)}" data-id="${ticket.id}">
                    ${STATUS_OPTIONS.map(s => `<option value="${s}" ${s === ticket.status ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 rounded-full text-xs font-bold ${getPriorityBadgeClass(ticket.priority)}">
                    ${ticket.priority}
                </span>
            </td>
        </tr>
    `).join('');

    // Atașăm evenimente pentru schimbarea statusului direct din tabel
    tbody.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', (e) => updateTicketStatus(e.target.dataset.id, e.target.value));
    });
}

function updateStats(tickets) {
    const total = tickets.length;
    const pending = tickets.filter(t => t.status === 'Pending').length;
    const completed = tickets.filter(t => t.status === 'Completed').length;

    if (document.getElementById('stat-total')) document.getElementById('stat-total').textContent = total;
    if (document.getElementById('stat-pending')) document.getElementById('stat-pending').textContent = pending;
    if (document.getElementById('stat-completed')) document.getElementById('stat-completed').textContent = completed;
}

// --- CONTROL MODAL & EVENIMENTE ---

function openModal() { document.getElementById('modal')?.classList.remove('hidden'); }
function closeModal() { document.getElementById('modal')?.classList.add('hidden'); }
function resetTicketForm() { document.getElementById('ticket-form')?.reset(); }

function initEventListeners() {
    // Butoane Modal
    document.getElementById('open-modal')?.addEventListener('click', openModal);
    document.getElementById('close-modal')?.addEventListener('click', closeModal);
    document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);
    document.getElementById('submit-ticket')?.addEventListener('click', createNewTicket);
    
    // priority sort controls
    const prioritySelect = document.getElementById('priority-sort');
    const priorityIndicator = document.getElementById('priority-sort-indicator');
    const thPriority = document.getElementById('th-priority');


    if (prioritySelect) {
        prioritySelect.addEventListener('change', function() {
            prioritySort = this.value;
            updatePriorityIndicator();
            renderTable(allTickets);
        });
    }

    if (thPriority) {
        thPriority.addEventListener('click', () => {
            // cycle none->asc->desc->none
            if (prioritySort === 'none') prioritySort = 'asc';
            else if (prioritySort === 'asc') prioritySort = 'desc';
            else prioritySort = 'none';
            if (prioritySelect) prioritySelect.value = prioritySort;
            updatePriorityIndicator();
            renderTable(allTickets);
        });
    }

    // Filtre Sidebar
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // UI update pentru butoane
            document.querySelectorAll('.sidebar-btn').forEach(b => {
                b.classList.remove('bg-white/15', 'font-medium');
                b.classList.add('text-white/80');
            });
            this.classList.add('bg-white/15', 'font-medium');
            this.classList.remove('text-white/80');

            // Filtrare date
            currentFilter = this.dataset.filter || 'all';
            renderTable(allTickets);
        });
    });
}

// --- PORNIRE APLICAȚIE ---
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    initEventListeners();
    updatePriorityIndicator();
    fetchTickets();
});