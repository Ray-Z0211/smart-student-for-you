import * as store from "./store.js";
import { isValidDateStr, isValidTimeStr, parseDate, toDateStr, diffDays } from "./dates.js";
import { logTaskDone } from "./activity.js";

export const PRIORITIES = { low: "Rendah", medium: "Sedang", high: "Tinggi" };
export const LIMITS = { title: 100, description: 500 };
const RANK = { high: 0, medium: 1, low: 2 };

function newId() {
  // randomUUID hanya ada di koneksi aman (https/localhost), jadi siapkan cadangan
  return globalThis.crypto?.randomUUID?.() ?? `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function isTaskLike(t) {
  return t && typeof t.id === "string" && typeof t.title === "string" && isValidDateStr(t.date);
}

function load() {
  const raw = store.get(store.KEYS.TASKS, []);
  return Array.isArray(raw) ? raw.filter(isTaskLike) : [];
}

function save(list) {
  return store.set(store.KEYS.TASKS, list);
}

export function listTasks() {
  return load();
}

export function getTask(id) {
  return load().find((t) => t.id === id) ?? null;
}

// Memeriksa input dari formulir. Mengembalikan { errors, clean }.
export function validate(data) {
  const errors = {};
  const title = String(data.title ?? "").trim();
  const description = String(data.description ?? "").trim();
  const priority = String(data.priority ?? "medium");
  const date = String(data.date ?? "");
  const time = String(data.time ?? "");

  if (!title) errors.title = "Judul tugas wajib diisi.";
  else if (title.length > LIMITS.title) errors.title = `Judul maksimal ${LIMITS.title} karakter.`;
  if (description.length > LIMITS.description) errors.description = `Deskripsi maksimal ${LIMITS.description} karakter.`;
  if (!(priority in PRIORITIES)) errors.priority = "Pilih prioritas yang tersedia.";
  if (!date) errors.date = "Tanggal tenggat wajib diisi.";
  else if (!isValidDateStr(date)) errors.date = "Tanggal tidak valid.";
  if (time && !isValidTimeStr(time)) errors.time = "Jam tidak valid.";

  return { errors, clean: { title, description, priority, date, time } };
}

export function addTask(data) {
  const { errors, clean } = validate(data);
  if (Object.keys(errors).length) return { ok: false, errors };
  const now = new Date().toISOString();
  const task = { id: newId(), ...clean, done: false, doneAt: null, createdAt: now, updatedAt: now };
  const list = load();
  list.push(task);
  if (!save(list)) return { ok: false, errors: { _form: "Gagal menyimpan. Penyimpanan browser mungkin penuh." } };
  return { ok: true, task };
}

export function updateTask(id, data) {
  const { errors, clean } = validate(data);
  if (Object.keys(errors).length) return { ok: false, errors };
  const list = load();
  const task = list.find((t) => t.id === id);
  if (!task) return { ok: false, errors: { _form: "Tugas tidak ditemukan. Mungkin sudah dihapus." } };
  Object.assign(task, clean, { updatedAt: new Date().toISOString() });
  if (!save(list)) return { ok: false, errors: { _form: "Gagal menyimpan perubahan." } };
  return { ok: true, task };
}

export function deleteTask(id) {
  const list = load();
  const next = list.filter((t) => t.id !== id);
  if (next.length === list.length) return false;
  return save(next);
}

// Menandai selesai / belum selesai. XP hanya diberikan sekali per tugas.
export function toggleDone(id) {
  const list = load();
  const task = list.find((t) => t.id === id);
  if (!task) return { ok: false, error: "Tugas tidak ditemukan." };
  task.done = !task.done;
  task.doneAt = task.done ? new Date().toISOString() : null;
  task.updatedAt = new Date().toISOString();
  if (!save(list)) return { ok: false, error: "Gagal menyimpan perubahan." };
  const xp = task.done ? logTaskDone(task) : 0;
  return { ok: true, task, xp };
}

// Waktu tenggat. Jika jam kosong dianggap akhir hari (23:59).
export function dueDateTime(task) {
  const d = parseDate(task.date);
  const [h, m] = task.time ? task.time.split(":").map(Number) : [23, 59];
  d.setHours(h, m, 0, 0);
  return d;
}

// "done" | "overdue" | "today" | "soon" (<= 2 hari) | "normal"
export function getStatus(task, now = new Date()) {
  if (task.done) return "done";
  if (dueDateTime(task) < now) return "overdue";
  const days = diffDays(task.date, toDateStr(now));
  if (days === 0) return "today";
  if (days <= 2) return "soon";
  return "normal";
}

// Urutan: belum selesai dulu, lalu tanggal, jam (tanpa jam di akhir), prioritas
export function sortTasks(list) {
  return [...list].sort((a, b) =>
    Number(a.done) - Number(b.done) ||
    a.date.localeCompare(b.date) ||
    (a.time || "99:99").localeCompare(b.time || "99:99") ||
    RANK[a.priority] - RANK[b.priority]
  );
}
