import { icon } from "../icons.js";
import { escapeHtml, toast, emptyState, confirmDialog } from "../ui.js";
import * as dates from "../dates.js";
import * as tasksApi from "../tasks.js";
import * as reminders from "../reminders.js";

const { PRIORITIES, LIMITS } = tasksApi;

// Status disimpan selama aplikasi terbuka (tanggal selalu mulai dari hari ini saat halaman dibuka)
const state = {
  view: "day",            // "day" | "week" | "all"
  date: dates.todayStr(), // tanggal yang sedang dilihat
  cal: { y: 0, m: 0 },    // bulan yang tampil di kalender
  calOpen: window.innerWidth >= 768,
  showDone: true,
};

function syncCal() {
  const d = dates.parseDate(state.date);
  state.cal = { y: d.getFullYear(), m: d.getMonth() };
}

/* ====================== Potongan tampilan ====================== */

function relativeLabel(task, now) {
  const diff = dates.diffDays(task.date, dates.toDateStr(now));
  if (diff < 0) return `Terlambat ${-diff} hari`;
  if (diff === 0) return task.time ? `Hari ini ${task.time}` : "Hari ini";
  if (diff === 1) return "Besok";
  return `${diff} hari lagi`;
}

const STATUS_LABEL = { overdue: "Terlambat", today: "Hari ini", soon: "Segera" };

function taskItem(task, now) {
  const status = tasksApi.getStatus(task, now);
  const title = escapeHtml(task.title);
  const when = `${dates.formatShort(task.date)}${task.time ? ` · ${task.time}` : ""}`;
  const statusChip = STATUS_LABEL[status]
    ? `<span class="chip chip--${status}">${STATUS_LABEL[status]}</span>`
    : "";
  return `
    <li class="task ${task.done ? "is-done" : ""} task--${status}">
      <button type="button" class="task__check" data-action="toggle" data-id="${task.id}"
              aria-pressed="${task.done}"
              aria-label="${task.done ? "Tandai belum selesai" : "Tandai selesai"}: ${title}">
        <span class="task__box">${task.done ? icon("check") : ""}</span>
      </button>
      <div class="task__main">
        <p class="task__title">${title}</p>
        ${task.description ? `<p class="task__desc">${escapeHtml(task.description)}</p>` : ""}
        <div class="task__meta">
          <span class="chip chip--${task.priority}">Prioritas ${PRIORITIES[task.priority]}</span>
          <span class="chip">${icon("clock")}${escapeHtml(when)}</span>
          ${statusChip}
        </div>
      </div>
      <div class="task__actions">
        <button type="button" class="btn btn--icon" data-action="edit" data-id="${task.id}" aria-label="Ubah tugas: ${title}">${icon("edit")}</button>
        <button type="button" class="btn btn--icon" data-action="delete" data-id="${task.id}" aria-label="Hapus tugas: ${title}">${icon("trash")}</button>
      </div>
    </li>`;
}

function miniItem(task) {
  const title = escapeHtml(task.title);
  return `
    <li class="mini ${task.done ? "is-done" : ""}">
      <button type="button" class="task__check" data-action="toggle" data-id="${task.id}"
              aria-pressed="${task.done}"
              aria-label="${task.done ? "Tandai belum selesai" : "Tandai selesai"}: ${title}">
        <span class="task__box">${task.done ? icon("check") : ""}</span>
      </button>
      <button type="button" class="mini__title" data-action="edit" data-id="${task.id}" aria-label="Ubah tugas: ${title}">
        ${title}${task.time ? `<span class="mini__time">${task.time}</span>` : ""}
      </button>
    </li>`;
}

function reminderCard() {
  const on = reminders.isEnabled();
  return `
    <section class="card" aria-label="Pengingat">
      <label class="switch-row">
        <input type="checkbox" data-action="toggle-reminders" ${on ? "checked" : ""} />
        <span>Pengingat 15 menit sebelum jam tugas</span>
      </label>
      <p class="note">Pengingat hanya muncul sebagai pesan di dalam aplikasi selama aplikasi ini terbuka. Pengingat saat aplikasi ditutup belum didukung.</p>
    </section>`;
}

function attentionCard(all, now) {
  const urgent = tasksApi
    .sortTasks(all.filter((t) => ["overdue", "today", "soon"].includes(tasksApi.getStatus(t, now))));
  if (!urgent.length) return "";
  const shown = urgent.slice(0, 5);
  const rest = urgent.length - shown.length;
  const items = shown
    .map((t) => {
      const status = tasksApi.getStatus(t, now);
      return `<li><button type="button" data-action="pick-date" data-date="${t.date}">
        <span class="attention__title">${escapeHtml(t.title)}</span>
        <span class="chip chip--${status}">${escapeHtml(relativeLabel(t, now))}</span>
      </button></li>`;
    })
    .join("");
  return `
    <section class="card" aria-labelledby="h-attn">
      <h2 id="h-attn" class="section-title">Mendekati tenggat</h2>
      <ul class="attention">${items}</ul>
      ${rest > 0 ? `<p class="note">dan ${rest} tugas lainnya. Lihat di tab "Semua".</p>` : ""}
    </section>`;
}

function toolbar() {
  const views = [["day", "Harian"], ["week", "Mingguan"], ["all", "Semua"]];
  const seg = views
    .map(([id, label]) => `<button type="button" data-action="set-view" data-view="${id}" aria-pressed="${state.view === id}">${label}</button>`)
    .join("");

  let nav = "";
  if (state.view === "day") {
    nav = `
      <div class="date-nav">
        <button type="button" class="btn btn--icon" data-action="prev" aria-label="Hari sebelumnya">${icon("chevronLeft")}</button>
        <input type="date" data-action="jump-date" value="${state.date}" aria-label="Pilih tanggal" />
        <button type="button" class="btn btn--icon" data-action="next" aria-label="Hari berikutnya">${icon("chevronRight")}</button>
      </div>
      <div class="nav-row">
        <button type="button" class="btn" data-action="today">Hari ini</button>
        <button type="button" class="btn" data-action="toggle-cal" aria-expanded="${state.calOpen}">${icon("calendar")}Kalender</button>
      </div>`;
  } else if (state.view === "week") {
    const start = dates.startOfWeek(state.date);
    const end = dates.addDays(start, 6);
    nav = `
      <div class="date-nav">
        <button type="button" class="btn btn--icon" data-action="prev" aria-label="Minggu sebelumnya">${icon("chevronLeft")}</button>
        <div class="date-nav__label">${dates.formatShort(start)} – ${dates.formatShort(end)} ${dates.parseDate(end).getFullYear()}</div>
        <button type="button" class="btn btn--icon" data-action="next" aria-label="Minggu berikutnya">${icon("chevronRight")}</button>
      </div>
      <div class="nav-row"><button type="button" class="btn" data-action="today">Minggu ini</button></div>`;
  }

  return `
    <div class="toolbar">
      <div class="segmented" role="group" aria-label="Pilih tampilan">${seg}</div>
      ${nav}
      <label class="switch-row">
        <input type="checkbox" data-action="toggle-show-done" ${state.showDone ? "checked" : ""} />
        <span>Tampilkan tugas yang sudah selesai</span>
      </label>
    </div>`;
}

function calendarHtml(all) {
  const { y, m } = state.cal;
  const { offset, total } = dates.monthGrid(y, m);
  const today = dates.todayStr();
  const open = new Map();
  for (const t of all) if (!t.done) open.set(t.date, (open.get(t.date) ?? 0) + 1);

  const dow = dates.DAYS_SHORT_MON_FIRST.map((d) => `<span class="cal__dow" aria-hidden="true">${d}</span>`).join("");
  const blanks = Array.from({ length: offset }, () => "<span></span>").join("");
  const days = Array.from({ length: total }, (_, i) => {
    const day = i + 1;
    const str = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const count = open.get(str) ?? 0;
    const cls = ["cal__day", str === today ? "is-today" : "", count ? "has-open" : ""].filter(Boolean).join(" ");
    const label = `${dates.formatLong(str)}${count ? `, ${count} tugas belum selesai` : ""}`;
    return `<button type="button" class="${cls}" data-action="pick-date" data-date="${str}" aria-pressed="${str === state.date}" aria-label="${escapeHtml(label)}">${day}</button>`;
  }).join("");

  return `
    <div class="cal__head">
      <button type="button" class="btn btn--icon" data-action="cal-prev" aria-label="Bulan sebelumnya">${icon("chevronLeft")}</button>
      <h3 aria-live="polite">${dates.monthLabel(y, m)}</h3>
      <button type="button" class="btn btn--icon" data-action="cal-next" aria-label="Bulan berikutnya">${icon("chevronRight")}</button>
    </div>
    <div class="cal__grid">${dow}${blanks}${days}</div>
    <p class="note">Titik kuning = ada tugas yang belum selesai.</p>`;
}

function addButton(date, text = "Tambah tugas") {
  return `<button type="button" class="btn btn--primary" data-action="add-on-date" data-date="${date}">${icon("plus")}${text}</button>`;
}

function dayView(all, now) {
  const list = tasksApi.sortTasks(all.filter((t) => t.date === state.date && (state.showDone || !t.done)));
  const isToday = state.date === dates.todayStr();
  const body = list.length
    ? `<ul class="task-list">${list.map((t) => taskItem(t, now)).join("")}</ul>`
    : `<div class="card">
         ${emptyState({
           iconName: "calendar",
           title: "Belum ada tugas",
           text: state.showDone
             ? "Tidak ada tugas pada tanggal ini. Tambahkan satu untuk mulai merencanakan harimu."
             : "Tidak ada tugas yang belum selesai pada tanggal ini.",
         })}
         <p style="text-align:center">${addButton(state.date)}</p>
       </div>`;

  return `
    <div class="day-layout">
      ${state.calOpen ? `<section class="card" aria-label="Kalender">${calendarHtml(all)}</section>` : ""}
      <section aria-labelledby="h-day">
        <div class="day-head">
          <h2 id="h-day" class="section-title">${dates.formatLong(state.date)}</h2>
          ${isToday ? '<span class="badge">Hari ini</span>' : ""}
        </div>
        ${body}
      </section>
    </div>`;
}

function weekView(all) {
  const start = dates.startOfWeek(state.date);
  const today = dates.todayStr();
  const cards = Array.from({ length: 7 }, (_, i) => {
    const str = dates.addDays(start, i);
    const list = tasksApi.sortTasks(all.filter((t) => t.date === str && (state.showDone || !t.done)));
    const openCount = list.filter((t) => !t.done).length;
    return `
      <section class="card day-card ${str === today ? "is-today" : ""}" aria-label="${dates.formatLong(str)}">
        <button type="button" class="day-card__head" data-action="pick-date" data-date="${str}">
          <span>${dates.dayName(str)}, ${dates.formatShort(str)}</span>
          <span class="chip">${openCount} belum selesai</span>
        </button>
        ${list.length
          ? `<ul class="mini-list">${list.map(miniItem).join("")}</ul>`
          : '<p class="day-card__empty">Tidak ada tugas.</p>'}
      </section>`;
  }).join("");
  return `<div class="week-grid">${cards}</div>`;
}

function allView(all, now) {
  if (!all.length) {
    return `<div class="card">
      ${emptyState({ iconName: "calendar", title: "Belum ada tugas", text: "Tambahkan tugas pertamamu. Setelah selesai, kamu akan mendapat XP." })}
      <p style="text-align:center">${addButton(dates.todayStr(), "Tambah tugas pertama")}</p>
    </div>`;
  }
  const open = tasksApi.sortTasks(all.filter((t) => !t.done));
  const done = all.filter((t) => t.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  const section = (id, title, list) => `
    <section aria-labelledby="${id}">
      <h2 id="${id}" class="section-title">${title} (${list.length})</h2>
      ${list.length ? `<ul class="task-list">${list.map((t) => taskItem(t, now)).join("")}</ul>` : '<p class="note">Tidak ada.</p>'}
    </section>`;
  return `<div class="stack">
    ${section("h-open", "Belum selesai", open)}
    ${state.showDone ? section("h-done", "Selesai", done) : ""}
  </div>`;
}

function formHtml(task, isEdit) {
  const opts = Object.entries(PRIORITIES)
    .map(([value, label]) => `<option value="${value}" ${task.priority === value ? "selected" : ""}>${label}</option>`)
    .join("");
  return `
    <form class="dialog__body" novalidate>
      <h2 id="task-dialog-title">${isEdit ? "Ubah tugas" : "Tambah tugas"}</h2>

      <div class="field">
        <label for="f-title">Judul <span aria-hidden="true">*</span></label>
        <input id="f-title" name="title" type="text" maxlength="${LIMITS.title}" required autocomplete="off"
               value="${escapeHtml(task.title)}" aria-describedby="e-title" />
        <p class="field-error" id="e-title" role="alert" hidden></p>
      </div>

      <div class="field">
        <label for="f-description">Deskripsi (opsional)</label>
        <textarea id="f-description" name="description" maxlength="${LIMITS.description}" aria-describedby="e-description">${escapeHtml(task.description)}</textarea>
        <p class="field-error" id="e-description" role="alert" hidden></p>
      </div>

      <div class="field">
        <label for="f-priority">Prioritas</label>
        <select id="f-priority" name="priority" aria-describedby="e-priority">${opts}</select>
        <p class="field-error" id="e-priority" role="alert" hidden></p>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="f-date">Tanggal tenggat <span aria-hidden="true">*</span></label>
          <input id="f-date" name="date" type="date" required value="${task.date}" aria-describedby="e-date" />
          <p class="field-error" id="e-date" role="alert" hidden></p>
        </div>
        <div class="field">
          <label for="f-time">Jam (opsional)</label>
          <input id="f-time" name="time" type="time" value="${task.time}" aria-describedby="e-time" />
          <p class="field-error" id="e-time" role="alert" hidden></p>
        </div>
      </div>
      <p class="hint note">Pengingat hanya aktif untuk tugas yang punya jam.</p>

      <p class="field-error" id="e-form" role="alert" hidden></p>

      <div class="dialog__actions">
        <button type="button" class="btn" data-action="close-form">Batal</button>
        <button type="submit" class="btn btn--primary">${isEdit ? "Simpan perubahan" : "Simpan tugas"}</button>
      </div>
    </form>`;
}

function showErrors(form, errors) {
  let firstInvalid = null;
  for (const name of ["title", "description", "priority", "date", "time"]) {
    const message = form.querySelector(`#e-${name}`);
    const input = form.querySelector(`[name="${name}"]`);
    if (errors[name]) {
      message.textContent = errors[name];
      message.hidden = false;
      input.setAttribute("aria-invalid", "true");
      firstInvalid ??= input;
    } else {
      message.hidden = true;
      input.removeAttribute("aria-invalid");
    }
  }
  const general = form.querySelector("#e-form");
  general.textContent = errors._form ?? "";
  general.hidden = !errors._form;
  firstInvalid?.focus();
}

/* ====================== Halaman ====================== */

export function render(container) {
  state.date = dates.todayStr();
  syncCal();

  container.innerHTML = `
    <div class="schedule">
      <div class="page-head">
        <header class="page-header">
          <h1>Jadwal</h1>
          <p>Atur tugas, tenggat waktu, dan kegiatan harianmu.</p>
        </header>
        <button type="button" class="btn btn--primary" data-action="add">${icon("plus")}Tambah tugas</button>
      </div>
      <div class="stack" id="sched-view"></div>
      <dialog id="task-dialog" class="dialog" aria-labelledby="task-dialog-title"></dialog>
    </div>`;

  // Pendengar dipasang pada elemen baru ini (bukan <main>) agar tidak menumpuk saat pindah halaman
  const root = container.firstElementChild;
  const viewEl = root.querySelector("#sched-view");
  const dialog = root.querySelector("#task-dialog");

  function draw() {
    // simpan fokus agar pengguna keyboard tidak "terlempar" setelah tampilan digambar ulang
    const active = document.activeElement;
    const focusKey = active && root.contains(active) && active.dataset?.action
      ? { action: active.dataset.action, id: active.dataset.id, date: active.dataset.date, view: active.dataset.view }
      : null;

    const all = tasksApi.listTasks();
    const now = new Date();
    const body = state.view === "day" ? dayView(all, now) : state.view === "week" ? weekView(all) : allView(all, now);
    viewEl.innerHTML = reminderCard() + attentionCard(all, now) + toolbar() + body;

    if (focusKey) {
      const selector = Object.entries(focusKey)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `[data-${k}="${CSS.escape(v)}"]`)
        .join("");
      viewEl.querySelector(selector)?.focus();
    }
  }

  function openForm(task, presetDate) {
    const values = task ?? { title: "", description: "", priority: "medium", date: presetDate ?? state.date, time: "" };
    dialog.dataset.editId = task?.id ?? "";
    dialog.innerHTML = formHtml(values, Boolean(task));
    dialog.showModal();
  }

  function goToDate(date) {
    state.date = date;
    syncCal();
  }

  function handleToggle(id) {
    const result = tasksApi.toggleDone(id);
    if (!result.ok) return toast(result.error, "error");
    if (!result.task.done) toast("Tugas dikembalikan ke belum selesai.", "info");
    else if (result.xp > 0) toast(`Tugas selesai! +${result.xp} XP`, "success");
    else toast("Tugas selesai. XP untuk tugas ini sudah pernah kamu dapatkan.", "info");
    return draw();
  }

  async function handleDelete(id) {
    const task = tasksApi.getTask(id);
    if (!task) return;
    const yes = await confirmDialog({
      title: "Hapus tugas?",
      message: `"${task.title}" akan dihapus permanen. XP yang sudah kamu dapatkan tidak berkurang.`,
      confirmText: "Hapus",
      danger: true,
    });
    if (!yes) return;
    if (tasksApi.deleteTask(id)) toast("Tugas dihapus.", "success");
    else toast("Gagal menghapus tugas.", "error");
    draw();
  }

  root.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (!el || !root.contains(el)) return;
    const { action, id, date, view } = el.dataset;

    switch (action) {
      case "add": return openForm(null);
      case "add-on-date": return openForm(null, date);
      case "edit": return openForm(tasksApi.getTask(id));
      case "delete": return handleDelete(id);
      case "toggle": return handleToggle(id);
      case "close-form": return dialog.close();
      case "set-view": state.view = view; return draw();
      case "prev":
      case "next": {
        const step = (state.view === "week" ? 7 : 1) * (action === "prev" ? -1 : 1);
        goToDate(dates.addDays(state.date, step));
        return draw();
      }
      case "today": goToDate(dates.todayStr()); return draw();
      case "pick-date": goToDate(date); state.view = "day"; return draw();
      case "toggle-cal": state.calOpen = !state.calOpen; return draw();
      case "cal-prev":
      case "cal-next": {
        const d = new Date(state.cal.y, state.cal.m + (action === "cal-prev" ? -1 : 1), 1);
        state.cal = { y: d.getFullYear(), m: d.getMonth() };
        return draw();
      }
      default: return undefined; // kotak centang dan input tanggal ditangani oleh "change"
    }
  });

  root.addEventListener("change", (event) => {
    const el = event.target;
    switch (el.dataset?.action) {
      case "jump-date":
        if (dates.isValidDateStr(el.value)) { goToDate(el.value); draw(); }
        break;
      case "toggle-show-done": state.showDone = el.checked; draw(); break;
      case "toggle-reminders":
        reminders.setEnabled(el.checked);
        toast(el.checked ? "Pengingat diaktifkan." : "Pengingat dimatikan.", "info");
        break;
      default: break;
    }
  });

  // Kirim formulir (tambah / ubah)
  dialog.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    const editId = dialog.dataset.editId;
    const result = editId ? tasksApi.updateTask(editId, data) : tasksApi.addTask(data);
    if (!result.ok) return showErrors(form, result.errors);

    dialog.close();
    goToDate(result.task.date); // pindah ke tanggal tugas agar langsung terlihat
    toast(editId ? "Tugas diperbarui." : `Tugas ditambahkan untuk ${dates.formatLong(result.task.date)}.`, "success");
    return draw();
  });

  // Klik area gelap di luar formulir = tutup
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  draw();
}
