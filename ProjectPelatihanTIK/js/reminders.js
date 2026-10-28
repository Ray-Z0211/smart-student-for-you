import * as store from "./store.js";
import { listTasks, dueDateTime } from "./tasks.js";
import { toast } from "./ui.js";

// Pengingat HANYA muncul selama aplikasi terbuka (pesan di dalam aplikasi).
// Pengingat saat aplikasi tertutup butuh PWA + notifikasi push (fitur lanjutan).
const LEAD_MINUTES = 15;        // mulai mengingatkan 15 menit sebelum jam tugas
const LATE_GRACE_MINUTES = 30;  // masih diingatkan jika baru terlambat <= 30 menit
const CHECK_EVERY_MS = 30000;

let timer = null;

export function isEnabled() {
  return store.getSetting("remindersEnabled", true);
}

export function setEnabled(value) {
  store.setSetting("remindersEnabled", Boolean(value));
}

export function checkReminders(now = new Date()) {
  if (!isEnabled()) return;
  const notified = store.getSetting("notified", {});
  let changed = false;

  for (const task of listTasks()) {
    if (task.done || !task.time) continue; // hanya tugas yang punya jam
    const key = `${task.date} ${task.time}`; // jika jam diubah, pengingat aktif lagi
    if (notified[task.id] === key) continue;

    const minutes = (dueDateTime(task) - now) / 60000;
    if (minutes > LEAD_MINUTES || minutes < -LATE_GRACE_MINUTES) continue;

    const text = minutes > 0
      ? `Pengingat: "${task.title}" pukul ${task.time}, ${Math.ceil(minutes)} menit lagi.`
      : `Pengingat: "${task.title}" sudah jatuh tempo (pukul ${task.time}).`;
    toast(text, "warning", 12000);
    notified[task.id] = key;
    changed = true;
  }
  if (changed) store.setSetting("notified", notified);
}

export function startReminders() {
  if (timer) return;
  checkReminders();
  timer = setInterval(() => checkReminders(), CHECK_EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkReminders();
  });
}
