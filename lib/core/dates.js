const MONTHS = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, março: 3, marco: 3,
  abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6, jul: 7, julho: 7,
  ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12
};

function pad(n) { return String(n).padStart(2, '0'); }
function valid(y, m, d) {
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function normalizeDate(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  let s = String(value).trim();
  if (!s || s === '-' || /sem data|a confirmar|n\/d/i.test(s)) return '';
  s = s.replace(/\s+/g, ' ').replace(/[–—]/g, '-');
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m && valid(Number(m[1]), Number(m[2]), Number(m[3]))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m && valid(Number(m[3]), Number(m[2]), Number(m[1]))) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2})(?!\d)/);
  if (m) {
    const yy = Number(m[3]);
    const y = yy >= 70 ? 1900 + yy : 2000 + yy;
    if (valid(y, Number(m[2]), Number(m[1]))) return `${y}-${pad(m[2])}-${pad(m[1])}`;
  }
  m = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/(\d{1,2})\s+de\s+([a-z]{3,9})\s+de\s+(\d{4})/i);
  if (m) {
    const month = MONTHS[m[2]];
    if (valid(Number(m[3]), month, Number(m[1]))) return `${m[3]}-${pad(month)}-${pad(m[1])}`;
  }
  return '';
}

export function dateMillis(date) {
  const d = normalizeDate(date);
  return d ? Date.parse(`${d}T00:00:00Z`) : 0;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addMonthsIso(iso, months) {
  const d = new Date(`${normalizeDate(iso) || todayIso()}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + Number(months || 0));
  return d.toISOString().slice(0, 10);
}

export function previousBusinessDayIso(iso) {
  const d = new Date(`${normalizeDate(iso)}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return '';
  do { d.setUTCDate(d.getUTCDate() - 1); } while ([0, 6].includes(d.getUTCDay()));
  return d.toISOString().slice(0, 10);
}

export function eligibilityDateFromEvent(event = {}) {
  const dateCom = normalizeDate(event.dateCom || event.dataCom || event.recordDate || event.comDate);
  if (dateCom) return { date: dateCom, source: 'dateCom' };
  const exDate = normalizeDate(event.exDate || event.dataEx);
  if (exDate) return { date: previousBusinessDayIso(exDate), source: 'exDatePreviousBusinessDay' };
  return { date: '', source: 'missing' };
}


export function formatBrDate(value, fallback = '') {
  const iso = normalizeDate(value);
  if (iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  const raw = String(value || '').trim();
  return raw || fallback;
}

export function formatBrDateTime(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (/^\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}$/.test(raw) || /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(raw)) return formatBrDate(raw, fallback);
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(parsed)).replace(',', '');
  }
  return formatBrDate(raw, fallback);
}

export function withBrDateDisplays(record = {}, fields = []) {
  if (!record || typeof record !== 'object') return record;
  const out = { ...record };
  for (const field of fields) {
    const raw = out[field];
    const display = String(field).endsWith('At') || String(raw || '').includes('T')
      ? formatBrDateTime(raw, '')
      : formatBrDate(raw, '');
    if (display) out[`${field}Display`] = display;
  }
  return out;
}
