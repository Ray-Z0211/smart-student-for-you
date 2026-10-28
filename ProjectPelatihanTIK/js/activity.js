import * as store from "./store.js";
import { todayStr } from "./dates.js";

// Log aktivitas nyata. XP, streak, dan grafik (Langkah 3) dihitung dari sini.
export function getActivity() {
  const list = store.get(store.KEYS.ACTIVITY, []);
  return Array.isArray(list) ? list : [];
}

export function xpForTask(priority) {
  return priority === "high" ? 15 : 10;
}

// XP hanya diberikan SEKALI per tugas. Mengembalikan XP yang didapat (0 jika sudah pernah).
export function logTaskDone(task) {
  const list = getActivity();
  if (list.some((a) => a.type === "task_done" && a.refId === task.id)) return 0;
  const xp = xpForTask(task.priority);
  list.push({
    id: `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    type: "task_done",
    refId: task.id,
    xp,
    date: todayStr(),
    ts: new Date().toISOString(),
  });
  store.set(store.KEYS.ACTIVITY, list);
  return xp;
}

export function totalXp() {
  return getActivity().reduce((sum, a) => sum + (Number(a.xp) || 0), 0);
}

// XP kuis: 5 sampai 15 XP per percobaan (hanya jika kuis minimal 3 soal). Satu percobaan hanya dihitung sekali.
export function logQuizDone(attemptId, correct, total) {
  if (total < 3) return 0;
  const list = getActivity();
  if (list.some((a) => a.type === "quiz_done" && a.refId === attemptId)) return 0;
  const xp = 5 + Math.round((10 * correct) / total);
  list.push({
    id: `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    type: "quiz_done",
    refId: attemptId,
    xp,
    date: todayStr(),
    ts: new Date().toISOString(),
  });
  store.set(store.KEYS.ACTIVITY, list);
  return xp;
}
