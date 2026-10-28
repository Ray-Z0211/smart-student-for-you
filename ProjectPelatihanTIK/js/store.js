const PREFIX = "sa_"; // semua kunci diawali "sa_" agar tidak bentrok dengan situs lain

// Daftar kunci resmi yang akan dipakai fitur-fitur berikutnya
export const KEYS = {
  TASKS: "tasks",
  NOTES: "notes",
  QUIZZES: "quizzes",
  CAREER: "career",
  ACTIVITY: "activity",
  SETTINGS: "settings",
  CHAT: "chat",
};

const memory = new Map(); // cadangan jika LocalStorage tidak tersedia

function checkStorage() {
  try {
    const testKey = "__sa_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const persistent = checkStorage();

export function isPersistent() {
  return persistent;
}

// Membaca data. Mengembalikan `fallback` jika belum ada atau rusak.
export function get(key, fallback = null) {
  if (!persistent) {
    return memory.has(key) ? structuredClone(memory.get(key)) : fallback;
  }
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn(`Gagal membaca "${key}":`, error);
    return fallback;
  }
}

// Menyimpan data. Mengembalikan true jika berhasil, false jika gagal.
export function set(key, value) {
  if (!persistent) {
    memory.set(key, structuredClone(value));
    return true;
  }
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Gagal menyimpan "${key}":`, error);
    return false;
  }
}

export function remove(key) {
  memory.delete(key);
  if (!persistent) return;
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (error) {
    console.warn(`Gagal menghapus "${key}":`, error);
  }
}

// Pengaturan kecil (misalnya sidebar diciutkan atau tidak)
export function getSetting(name, fallback) {
  const settings = get(KEYS.SETTINGS, {});
  return name in settings ? settings[name] : fallback;
}

export function setSetting(name, value) {
  const settings = get(KEYS.SETTINGS, {});
  settings[name] = value;
  return set(KEYS.SETTINGS, settings);
}
