export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatDate(isoString) {
  if (!isoString) return '–';
  const d = new Date(isoString);
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function getStatusBadgeClass(status) {
  switch (status) {
    case 'Completed': return 'bg-emerald-100 text-emerald-800';
    case 'In Progress': return 'bg-blue-100 text-blue-800';
    default: return 'bg-amber-100 text-amber-800';
  }
}

export function getPriorityBadgeClass(priority) {
  switch (priority) {
    case 'High': return 'bg-red-100 text-red-800';
    case 'Medium': return 'bg-amber-100 text-amber-800';
    default: return 'bg-gray-100 text-gray-700';
  }
}

export function getCategoryBadgeClass(category) {
  return category === 'Software' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800';
}

