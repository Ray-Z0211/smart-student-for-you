import { icon } from "../icons.js";
import { pageHeader, escapeHtml, toast } from "../ui.js";
import { formatShort } from "../dates.js";
import * as stats from "../stats.js";

function statCard(iconName, label, value, sub = "") {
  return `
    <div class="card stat">
      <div class="stat__label">${icon(iconName)}<span>${escapeHtml(label)}</span></div>
      <div class="stat__value">${escapeHtml(value)}</div>
      ${sub ? `<div class="stat__sub">${escapeHtml(sub)}</div>` : ""}
    </div>`;
}

function progressBar(value, max, label) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return `<div class="progress" role="progressbar" aria-label="${escapeHtml(label)}"
               aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.min(value, max)}">
            <div class="progress__bar" style="width:${pct}%"></div>
          </div>`;
}

function chartHtml(days) {
  const W = 350, H = 190, padX = 8, top = 24, bottom = 30;
  const plotH = H - top - bottom;
  const max = Math.max(1, ...days.map((d) => d.count));
  const slot = (W - padX * 2) / days.length;
  const bw = Math.min(28, slot * 0.6);

  const bars = days.map((d, i) => {
    const h = d.count ? Math.max(4, (d.count / max) * plotH) : 0;
    const x = padX + slot * i + (slot - bw) / 2;
    const y = top + plotH - h;
    const cx = x + bw / 2;
    return `
      ${h ? `<rect class="chart__bar ${d.isToday ? "is-today" : ""}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="6" />` : ""}
      <text class="chart__val" x="${cx.toFixed(1)}" y="${(y - 6).toFixed(1)}">${d.count}</text>
      <text class="chart__lbl" x="${cx.toFixed(1)}" y="${H - 10}">${d.label}</text>`;
  }).join("");

  const total = days.reduce((sum, d) => sum + d.count, 0);
  const summary = `Grafik batang tugas selesai 7 hari terakhir. Total ${total} tugas.`;
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${summary}" preserveAspectRatio="xMidYMid meet">
      <line class="chart__axis" x1="${padX}" x2="${W - padX}" y1="${top + plotH}" y2="${top + plotH}" />
      ${bars}
    </svg>`;
}

function dataTable(days) {
  const rows = days.map((d) => `<tr><th scope="row">${d.label}, ${formatShort(d.date)}${d.isToday ? " (hari ini)" : ""}</th><td>${d.count}</td></tr>`).join("");
  return `
    <details class="data-details">
      <summary>Lihat dalam bentuk angka</summary>
      <table class="data-table">
        <thead><tr><th scope="col">Hari</th><th scope="col">Tugas selesai</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>`;
}

function goalsCard(s) {
  const { goals } = s;
  return `
    <section class="card" aria-labelledby="h-goals">
      <h2 id="h-goals" class="section-title">Target belajar</h2>
      <div class="stack">
        <div class="goal">
          <div class="goal__head"><span>Hari ini</span><span>${s.todayDone} / ${goals.daily} tugas</span></div>
          ${progressBar(s.todayDone, goals.daily, "Target harian")}
        </div>
        <div class="goal">
          <div class="goal__head"><span>Minggu ini (Senin–Minggu)</span><span>${s.weekDone} / ${goals.weekly} tugas</span></div>
          ${progressBar(s.weekDone, goals.weekly, "Target mingguan")}
        </div>
      </div>

      <form class="goal-form" id="goal-form" novalidate>
        <h3>Ubah target</h3>
        <div class="field-row">
          <div class="field">
            <label for="g-daily">Tugas per hari</label>
            <input id="g-daily" name="daily" type="number" inputmode="numeric" min="${stats.GOAL_LIMITS.daily.min}" max="${stats.GOAL_LIMITS.daily.max}" value="${goals.daily}" aria-describedby="e-daily" />
            <p class="field-error" id="e-daily" role="alert" hidden></p>
          </div>
          <div class="field">
            <label for="g-weekly">Tugas per minggu</label>
            <input id="g-weekly" name="weekly" type="number" inputmode="numeric" min="${stats.GOAL_LIMITS.weekly.min}" max="${stats.GOAL_LIMITS.weekly.max}" value="${goals.weekly}" aria-describedby="e-weekly" />
            <p class="field-error" id="e-weekly" role="alert" hidden></p>
          </div>
        </div>
        <p class="field-error" id="e-goalform" role="alert" hidden></p>
        <button type="submit" class="btn btn--primary">Simpan target</button>
      </form>
    </section>`;
}

function achievementsCard(s) {
  const list = stats.getAchievements(s);
  const items = list.map((a) => `
    <li class="achv ${a.earned ? "is-earned" : ""}">
      <span class="achv__icon">${icon(a.earned ? "check" : "target")}</span>
      <div class="achv__body">
        <strong>${escapeHtml(a.title)}</strong>
        <span>${escapeHtml(a.desc)}</span>
        <span class="chip ${a.earned ? "chip--low" : ""}">${a.earned ? "Diraih" : `${a.shown} / ${a.target}`}</span>
      </div>
    </li>`).join("");
  return `
    <section class="card" aria-labelledby="h-achv">
      <h2 id="h-achv" class="section-title">Pencapaian</h2>
      <ul class="achv-grid">${items}</ul>
    </section>`;
}

function view(s) {
  const lv = s.level;
  const streakSub = s.streak.best > 0 ? `Terbaik: ${s.streak.best} hari` : "Selesaikan tugas untuk memulai";
  return `
    <div class="stat-grid">
      ${statCard("sparkle", "Total XP", String(s.xp), `${lv.into} / ${lv.need} XP ke level berikutnya`)}
      ${statCard("target", "Level", String(lv.level))}
      ${statCard("clock", "Streak", `${s.streak.current} hari`, streakSub)}
      ${statCard("check", "Tugas selesai", String(s.totalDone), `Belum selesai: ${s.openCount}`)}
    </div>

    <section class="card section" aria-labelledby="h-level">
      <h2 id="h-level" class="section-title">Menuju level ${lv.level + 1}</h2>
      ${progressBar(lv.into, lv.need, "Progres XP menuju level berikutnya")}
      <p class="note">XP: tugas prioritas Tinggi +15, lainnya +10. XP hanya diberikan sekali per tugas. Menyelesaikan kuis memberi 5 sampai 15 XP per percobaan. Streak dan grafik dihitung dari tugas yang selesai.</p>
    </section>

    <div class="progress-layout">
      <section class="card" aria-labelledby="h-chart">
        <h2 id="h-chart" class="section-title">Tugas selesai 7 hari terakhir</h2>
        ${chartHtml(s.last7)}
        ${dataTable(s.last7)}
      </section>
      ${goalsCard(s)}
    </div>

    <section class="card section" aria-labelledby="h-tips">
      <h2 id="h-tips" class="section-title">Saran dari datamu</h2>
      <ul class="tips">${stats.getSuggestions(s).map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      ${s.overdue > 0 ? `<p class="note">Terlambat: ${s.overdue} tugas.</p>` : ""}
    </section>

    ${achievementsCard(s)}`;
}

function showGoalErrors(form, errors) {
  let first = null;
  for (const name of ["daily", "weekly"]) {
    const msg = form.querySelector(`#e-${name}`);
    const input = form.querySelector(`[name="${name}"]`);
    if (errors[name]) {
      msg.textContent = errors[name];
      msg.hidden = false;
      input.setAttribute("aria-invalid", "true");
      first ??= input;
    } else {
      msg.hidden = true;
      input.removeAttribute("aria-invalid");
    }
  }
  const general = form.querySelector("#e-goalform");
  general.textContent = errors._form ?? "";
  general.hidden = !errors._form;
  first?.focus();
}

export function render(container) {
  container.innerHTML = `
    <div class="progress-page">
      ${pageHeader("Progres", "Pantau perkembangan belajarmu. Semua angka dihitung dari tugas yang benar-benar kamu selesaikan.")}
      <div id="progress-body"></div>
    </div>`;

  const root = container.firstElementChild;
  const body = root.querySelector("#progress-body");

  function draw() {
    body.innerHTML = view(stats.getStats());
  }

  // Pendengar dipasang pada elemen baru (bukan <main>) agar tidak menumpuk saat pindah halaman
  root.addEventListener("submit", (event) => {
    if (event.target.id !== "goal-form") return;
    event.preventDefault();
    const form = event.target;
    const result = stats.saveGoals(Object.fromEntries(new FormData(form)));
    if (!result.ok) return showGoalErrors(form, result.errors);
    toast("Target belajar disimpan.", "success");
    return draw();
  });

  draw();
}
