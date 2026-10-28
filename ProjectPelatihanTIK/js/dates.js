// Semua tanggal memakai teks lokal "YYYY-MM-DD" (bukan UTC) agar tidak bergeser sehari.
const pad = (n) => String(n).padStart(2, "0");

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const DAYS_SHORT_MON_FIRST = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function toDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateStr(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  return toDateStr(parseDate(str)) === str; // menolak 2026-02-31 dan sejenisnya
}

export function isValidTimeStr(str) {
  return typeof str === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
}

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

// Selisih hari a - b
export function diffDays(a, b) {
  return Math.round((parseDate(a) - parseDate(b)) / 86400000);
}

// Awal minggu (Senin)
export function startOfWeek(str) {
  const d = parseDate(str);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDateStr(d);
}

export function formatLong(str) {
  const d = parseDate(str);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShort(str) {
  const d = parseDate(str);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function dayName(str) {
  return DAYS[parseDate(str).getDay()];
}

export function monthLabel(year, month) {
  return `${MONTHS[month]} ${year}`;
}

// Hari dalam satu bulan untuk kalender (minggu mulai Senin)
export function monthGrid(year, month) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = new Date(year, month + 1, 0).getDate();
  return { offset, total };
}
