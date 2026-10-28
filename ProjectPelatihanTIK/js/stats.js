import * as store from "./store.js";
import { getActivity, totalXp } from "./activity.js";
import { listTasks, getStatus } from "./tasks.js";
import { todayStr, addDays, startOfWeek, parseDate, DAYS_SHORT_MON_FIRST } from "./dates.js";

// Semua angka di sini dihitung dari log aktivitas dan daftar tugas yang nyata. Tidak ada angka buatan.

export const GOAL_LIMITS = { daily: { min: 1, max: 20 }, weekly: { min: 1, max: 100 } };
const DEFAULT_GOALS = { daily: 1, weekly: 5 };

// Mengubah input jadi bilangan bulat dalam batas. Mengembalikan null jika tidak valid.
function parseGoal(value, { min, max }) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

export function getGoals() {
  const saved = store.getSetting("goals", {});
  return {
    daily: parseGoal(saved?.daily, GOAL_LIMITS.daily) ?? DEFAULT_GOALS.daily,
    weekly: parseGoal(saved?.weekly, GOAL_LIMITS.weekly) ?? DEFAULT_GOALS.weekly,
  };
}

// Mengembalikan { ok, errors } atau { ok, goals }
export function saveGoals(input) {
  const daily = parseGoal(input.daily, GOAL_LIMITS.daily);
  const weekly = parseGoal(input.weekly, GOAL_LIMITS.weekly);
  const errors = {};
  if (daily === null) errors.daily = `Isi angka bulat ${GOAL_LIMITS.daily.min}–${GOAL_LIMITS.daily.max}.`;
  if (weekly === null) errors.weekly = `Isi angka bulat ${GOAL_LIMITS.weekly.min}–${GOAL_LIMITS.weekly.max}.`;
  if (Object.keys(errors).length) return { ok: false, errors };
  if (!store.setSetting("goals", { daily, weekly })) {
    return { ok: false, errors: { _form: "Gagal menyimpan target. Penyimpanan browser mungkin penuh." } };
  }
  return { ok: true, goals: { daily, weekly } };
}

// Level 2 butuh 50 XP, level 3 butuh 100 XP lagi, level 4 butuh 150 XP lagi, dan seterusnya.
export function levelInfo(xp) {
  let level = 1;
  let floor = 0;
  while (xp >= floor + 50 * level) {
    floor += 50 * level;
    level += 1;
  }
  const need = 50 * level;
  const into = xp - floor;
  return { level, into, need, pct: Math.round((into / need) * 100) };
}

// Streak = jumlah hari berturut-turut yang ada tugas selesai.
// Jika hari ini belum ada, streak kemarin masih dihitung (belum putus).
export function streakInfo(doneDates, today) {
  const days = new Set(doneDates);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best, doneToday: days.has(today) };
}

export function getStats(now = new Date()) {
  const today = todayStr();
  const done = getActivity().filter((a) => a.type === "task_done");
  const perDay = new Map();
  for (const a of done) perDay.set(a.date, (perDay.get(a.date) ?? 0) + 1);

  const tasks = listTasks();
  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => getStatus(t, now) === "overdue").length;
  const dueToday = open.filter((t) => t.date === today).length;

  const weekStart = startOfWeek(today);
  let weekDone = 0;
  for (let i = 0; i < 7; i++) weekDone += perDay.get(addDays(weekStart, i)) ?? 0;

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return {
      date,
      label: DAYS_SHORT_MON_FIRST[(parseDate(date).getDay() + 6) % 7],
      count: perDay.get(date) ?? 0,
      isToday: date === today,
    };
  });

  const xp = totalXp();
  const streak = streakInfo(perDay.keys(), today);
  const level = levelInfo(xp);

  return {
    today,
    xp,
    level,
    streak,
    goals: getGoals(),
    totalTasks: tasks.length,
    openCount: open.length,
    overdue,
    dueToday,
    totalDone: done.length,
    todayDone: perDay.get(today) ?? 0,
    weekDone,
    last7,
  };
}

// Pencapaian: hanya terbuka jika syaratnya benar-benar terpenuhi dari aktivitasmu.
export function getAchievements(s) {
  const defs = [
    { id: "first", title: "Langkah pertama", desc: "Selesaikan 1 tugas.", value: s.totalDone, target: 1 },
    { id: "five", title: "Mulai konsisten", desc: "Selesaikan 5 tugas.", value: s.totalDone, target: 5 },
    { id: "twenty", title: "Rajin", desc: "Selesaikan 20 tugas.", value: s.totalDone, target: 20 },
    { id: "streak3", title: "Streak 3 hari", desc: "Selesaikan tugas 3 hari berturut-turut.", value: s.streak.best, target: 3 },
    { id: "streak7", title: "Streak 7 hari", desc: "Selesaikan tugas 7 hari berturut-turut.", value: s.streak.best, target: 7 },
    { id: "level3", title: "Level 3", desc: "Capai level 3.", value: s.level.level, target: 3 },
  ];
  return defs.map((d) => ({ ...d, earned: d.value >= d.target, shown: Math.min(d.value, d.target) }));
}

// Saran dari data yang ada. Jika datanya kosong, sarannya mengajak mulai.
export function getSuggestions(s) {
  const tips = [];
  if (s.totalTasks === 0) {
    tips.push("Kamu belum punya tugas. Buka halaman Jadwal dan tambahkan tugas pertamamu.");
    return tips;
  }
  if (s.overdue > 0) {
    tips.push(`Ada ${s.overdue} tugas yang terlambat. Selesaikan atau ubah tenggatnya di halaman Jadwal.`);
  }
  if (s.streak.current > 0 && !s.streak.doneToday) {
    tips.push(`Selesaikan 1 tugas hari ini agar streak ${s.streak.current} harimu tidak putus.`);
  }
  if (s.todayDone < s.goals.daily) {
    const left = s.goals.daily - s.todayDone;
    tips.push(s.dueToday > 0
      ? `Target harian kurang ${left} tugas lagi. Ada ${s.dueToday} tugas yang tenggatnya hari ini.`
      : `Target harian kurang ${left} tugas lagi. Tambahkan atau kerjakan tugas dari halaman Jadwal.`);
  } else {
    tips.push("Target harianmu sudah tercapai. Kerja bagus!");
  }
  if (s.weekDone >= s.goals.weekly) {
    tips.push("Target mingguanmu sudah tercapai.");
  } else if (s.weekDone > 0) {
    tips.push(`Target mingguan kurang ${s.goals.weekly - s.weekDone} tugas lagi.`);
  }
  return tips;
}
