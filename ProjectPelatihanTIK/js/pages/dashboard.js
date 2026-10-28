import { routes } from "../router.js";
import { icon } from "../icons.js";
import { pageHeader, emptyState, escapeHtml } from "../ui.js";
import * as stats from "../stats.js";

function miniStat(iconName, label, value) {
  return `
    <div class="card stat">
      <div class="stat__label">${icon(iconName)}<span>${escapeHtml(label)}</span></div>
      <div class="stat__value">${escapeHtml(value)}</div>
    </div>`;
}

function activitySection(s) {
  // Belum ada tugas dan belum ada aktivitas: tampilkan empty state yang jujur
  if (s.totalTasks === 0 && s.totalDone === 0) {
    return emptyState({
      iconName: "chart",
      title: "Belum ada aktivitas",
      text: "XP, streak, dan statistik akan muncul di sini setelah kamu menambahkan dan menyelesaikan tugas. Semua angka dihitung dari aktivitas nyatamu.",
    });
  }
  return `
    <div class="stat-grid">
      ${miniStat("check", "Selesai hari ini", `${s.todayDone} / ${s.goals.daily}`)}
      ${miniStat("clock", "Streak", `${s.streak.current} hari`)}
      ${miniStat("sparkle", "Total XP", String(s.xp))}
      ${miniStat("target", "Level", String(s.level.level))}
    </div>
    <p class="note">Belum selesai: ${s.openCount} tugas${s.overdue ? `, ${s.overdue} di antaranya terlambat` : ""}. <a href="#/progres">Lihat progres lengkap</a></p>`;
}

export function render(container) {
  const s = stats.getStats();
  const cards = routes
    .filter((r) => r.id !== "dashboard")
    .map(
      (r) => `
      <a class="quick-card" href="#${r.path}">
        <span class="quick-card__icon">${icon(r.icon)}</span>
        <span class="quick-card__body">
          <strong>${escapeHtml(r.label)}</strong>
          <span>${escapeHtml(r.desc)}</span>
        </span>
      </a>`
    )
    .join("");

  container.innerHTML = `
    ${pageHeader("Selamat datang", "Asisten belajar pribadimu untuk materi, jadwal, dan rencana karier.")}

    <section class="card section" aria-labelledby="h-activity">
      <h2 id="h-activity" class="section-title">Aktivitas hari ini</h2>
      ${activitySection(s)}
    </section>

    <section class="section" aria-labelledby="h-start">
      <h2 id="h-start" class="section-title">Mulai dari mana?</h2>
      <div class="grid">${cards}</div>
    </section>`;
}
