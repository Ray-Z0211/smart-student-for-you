import { icon } from "../icons.js";
import { pageHeader, escapeHtml, toast } from "../ui.js";
import * as store from "../store.js";
import * as quizzes from "../quiz-engine.js";
import * as notes from "../notes-engine.js";
import * as chat from "../chat-engine.js";
import { logQuizDone } from "../activity.js";

// Status selama halaman terbuka (kuis yang sedang dikerjakan tidak disimpan sampai selesai)
const ui = { ai: null, busy: false, view: "menu", quiz: null, index: 0, answers: [], result: null, xp: 0 };

const SOURCE_LABEL = {
  sample: "Kuis contoh (bukan dari AI)",
  auto: "Soal otomatis tanpa AI (isian rumpang dari materimu)",
  ai: "Dibuat oleh AI",
};

const badgeHtml = () =>
  ui.ai === null ? `<span class="badge">Memeriksa server…</span>`
  : ui.ai ? `<span class="badge">AI aktif</span>`
  : `<span class="badge badge--demo">Tanpa AI</span>`;

const dateText = (iso) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const multiline = (text) => escapeHtml(text).replace(/\n/g, "<br>");

function bar(value, label) {
  return `<div class="progress" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}">
            <div class="progress__bar" style="width:${value}%"></div></div>`;
}

/* ====================== Menu ====================== */
function menuHtml() {
  const draft = store.getSetting("quizSource", "");
  const samples = quizzes.SAMPLES.map((s) => `
    <li><button type="button" class="btn" data-action="sample" data-id="${s.id}">${escapeHtml(s.title)} <span class="note">(${s.questions.length} soal)</span></button></li>`).join("");

  const history = quizzes.loadResults().slice(0, 5);
  const historyHtml = history.length
    ? `<ul class="plain-list">${history.map((r) => `
        <li><strong>${escapeHtml(r.title)}</strong>: ${r.correct} / ${r.total} (${Math.round((r.correct / r.total) * 100)}%)
          <span class="note">${escapeHtml(dateText(r.ts))}${r.weak?.length ? ` · ulangi: ${escapeHtml(r.weak.slice(0, 3).join(", "))}` : ""}</span></li>`).join("")}</ul>`
    : `<p class="note">Belum ada kuis yang diselesaikan. Hasilnya akan tampil di sini.</p>`;

  return `
    <section class="card stack" aria-labelledby="h-make">
      <h2 id="h-make" class="section-title">Buat kuis dari materimu</h2>
      <div class="field">
        <label for="q-input">Tempel teks materi</label>
        <textarea id="q-input" rows="7" maxlength="${notes.MAX_TEXT}" placeholder="Tempel materi di sini, minimal ${notes.MIN_TEXT} karakter…">${escapeHtml(draft)}</textarea>
        <p class="hint">Bisa juga dari halaman Catatan lewat tombol "Buat kuis".</p>
      </div>
      <div class="field">
        <label for="q-count">Jumlah soal</label>
        <select id="q-count"><option value="5">5 soal</option><option value="10">10 soal</option></select>
      </div>
      ${ui.ai ? "" : `<p class="note"><strong>Tanpa AI:</strong> soal dibuat otomatis berbentuk isian rumpang dari kalimat di materimu. Sederhana, dan pilihan jawabannya diambil dari istilah lain di materi yang sama.</p>`}
      <div class="nav-row">
        <button type="button" class="btn btn--primary" id="q-go" data-action="generate">${icon("sparkle")}<span id="q-go-label">${ui.ai ? "Buat kuis dengan AI" : "Buat kuis"}</span></button>
        <button type="button" class="btn" id="q-local" data-action="generate-local" ${ui.ai ? "" : "hidden"}>Buat tanpa AI</button>
      </div>
    </section>

    <section class="card section" aria-labelledby="h-sample">
      <h2 id="h-sample" class="section-title">Kuis contoh</h2>
      <p class="note">Soal tetap yang sudah disiapkan, bukan buatan AI. Cocok untuk mencoba.</p>
      <ul class="sample-list">${samples}</ul>
    </section>

    <section class="card section" aria-labelledby="h-hist">
      <h2 id="h-hist" class="section-title">Riwayat kuis</h2>
      ${historyHtml}
    </section>`;
}

/* ====================== Mengerjakan ====================== */
function playHtml() {
  const q = ui.quiz.questions[ui.index];
  const total = ui.quiz.questions.length;
  const current = ui.answers[ui.index];
  const answered = ui.answers.filter((a) => a !== undefined).length;
  const last = ui.index === total - 1;

  const choices = q.options.map((opt, i) => `
    <label class="choice">
      <input type="radio" name="answer" value="${i}" ${current === i ? "checked" : ""} />
      <span class="choice__text"><span class="choice__dot" aria-hidden="true"></span>${escapeHtml(opt)}</span>
    </label>`).join("");

  return `
    <section class="card" aria-label="Kuis">
      <p class="note">${escapeHtml(ui.quiz.title)} · ${escapeHtml(SOURCE_LABEL[ui.quiz.source] ?? "")}</p>
      <div class="test-progress">
        <div class="test-progress__head"><span>Soal ${ui.index + 1} dari ${total}</span><span>${answered} terjawab</span></div>
        ${bar(Math.round((answered / total) * 100), "Jumlah soal yang sudah dijawab")}
      </div>
      <fieldset class="question" id="q-focus" tabindex="-1">
        <legend>${multiline(q.question)}</legend>
        <div class="choices">${choices}</div>
      </fieldset>
      <div class="test-nav">
        <button type="button" class="btn" data-action="prev" ${ui.index === 0 ? "disabled" : ""}>${icon("chevronLeft")}Sebelumnya</button>
        <button type="button" class="btn btn--primary" data-action="next" ${current === undefined ? "disabled" : ""}>${last ? "Selesai" : "Lanjut"}${icon("chevronRight")}</button>
      </div>
      <p><button type="button" class="btn" data-action="quit">Keluar dari kuis</button></p>
    </section>`;
}

/* ====================== Hasil ====================== */
function resultHtml() {
  const r = ui.result;
  const verdict = r.pct >= 80 ? "Bagus sekali!" : r.pct >= 60 ? "Lumayan, terus berlatih." : "Ayo pelajari lagi materinya.";
  const review = r.items.map((x, i) => `
    <li class="review ${x.ok ? "is-right" : "is-wrong"}">
      <div class="review__head"><span class="chip ${x.ok ? "chip--low" : "chip--high"}">${x.ok ? "Benar" : "Salah"}</span><strong>Soal ${i + 1}</strong></div>
      <p class="review__q">${multiline(x.q.question)}</p>
      <p>Jawabanmu: <strong>${escapeHtml(x.q.options[x.chosen] ?? "(tidak dijawab)")}</strong></p>
      ${x.ok ? "" : `<p>Jawaban benar: <strong>${escapeHtml(x.q.options[x.q.answer])}</strong></p>`}
      ${x.q.explanation ? `<p class="note">${multiline(x.q.explanation)}</p>` : ""}
    </li>`).join("");

  return `
    <section class="card" aria-labelledby="h-score">
      <h2 id="h-score" class="section-title">Hasil kuis: ${escapeHtml(ui.quiz.title)}</h2>
      <p class="score" id="q-focus" tabindex="-1">${r.correct} / ${r.total} <span>(${r.pct}%)</span></p>
      <p>${verdict}${ui.xp ? ` Kamu mendapat <strong>+${ui.xp} XP</strong>.` : ""}</p>
      ${bar(r.pct, "Nilai kuis")}
      <p class="note">${escapeHtml(SOURCE_LABEL[ui.quiz.source] ?? "")}</p>
    </section>

    <section class="card section" aria-labelledby="h-weak">
      <h2 id="h-weak" class="section-title">Materi yang perlu dipelajari lagi</h2>
      ${r.weak.length
        ? `<ul class="plain-list">${r.weak.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
        : `<p>Semua jawabanmu benar, tidak ada materi yang perlu diulang.</p>`}
    </section>

    <section class="section" aria-labelledby="h-review">
      <h2 id="h-review" class="section-title">Pembahasan</h2>
      <ol class="review-list">${review}</ol>
    </section>

    <div class="nav-row">
      <button type="button" class="btn btn--primary" data-action="retry">Ulangi kuis ini</button>
      <button type="button" class="btn" data-action="menu">Kuis lain</button>
    </div>`;
}

/* ====================== Halaman ====================== */
export function render(container) {
  container.innerHTML = `
    <div class="quiz-page">
      <div class="page-head">
        ${pageHeader("Kuis", "Uji pemahamanmu dengan soal latihan.")}
        <span id="q-badge">${badgeHtml()}</span>
      </div>
      <div id="q-body"></div>
    </div>`;

  const root = container.firstElementChild;
  const $ = (sel) => root.querySelector(sel);
  const body = $("#q-body");

  function draw({ focus = false } = {}) {
    $("#q-badge").innerHTML = badgeHtml();
    body.innerHTML = ui.view === "play" && ui.quiz ? playHtml() : ui.view === "result" && ui.result ? resultHtml() : menuHtml();
    if (focus) { body.querySelector("#q-focus")?.focus(); window.scrollTo(0, 0); }
  }

  function start(quiz) {
    ui.quiz = quiz;
    ui.index = 0;
    ui.answers = [];
    ui.result = null;
    ui.view = "play";
    draw({ focus: true });
  }

  function setBusy(v) {
    ui.busy = v;
    root.querySelectorAll("[data-action='generate'], [data-action='generate-local']").forEach((b) => { b.disabled = v; });
    const label = $("#q-go-label");
    if (label) label.textContent = v ? "Membuat kuis…" : ui.ai ? "Buat kuis dengan AI" : "Buat kuis";
  }

  async function generate(forceLocal) {
    if (ui.busy) return;
    const text = $("#q-input").value.trim();
    const count = Number($("#q-count").value) === 10 ? 10 : 5;
    const err = notes.validateInput(text);
    if (err) return toast(err, "warning");

    store.setSetting("quizSource", text);
    setBusy(true);
    try {
      if (ui.ai === null) ui.ai = await chat.checkStatus();
      let quiz;
      if (ui.ai && !forceLocal) {
        quiz = await quizzes.generateAI(text, chat.getPrefs().level, count);
      } else {
        const res = quizzes.generateLocal(text, count);
        if (!res.ok) throw new Error(res.error);
        quiz = res.quiz;
        if (quiz.questions.length < count) toast(`Materi terbatas, hanya ${quiz.questions.length} soal yang bisa dibuat.`, "info", 6000);
      }
      start(quiz);
    } catch (error) {
      toast(error.message || "Gagal membuat kuis. Coba lagi.", "error", 6000);
      setBusy(false);
      draw();
    }
  }

  function next() {
    if (ui.answers[ui.index] === undefined) return;
    if (ui.index < ui.quiz.questions.length - 1) {
      ui.index += 1;
      return draw({ focus: true });
    }
    // Selesai
    const result = quizzes.grade(ui.quiz, ui.answers);
    const id = quizzes.newAttemptId();
    ui.xp = logQuizDone(id, result.correct, result.total);
    quizzes.saveResult({ id, title: ui.quiz.title, source: ui.quiz.source, correct: result.correct, total: result.total, weak: result.weak });
    ui.result = result;
    ui.view = "result";
    toast(ui.xp ? `Kuis selesai! +${ui.xp} XP` : "Kuis selesai!", "success");
    return draw({ focus: true });
  }

  // Pendengar dipasang pada elemen baru (bukan <main>) agar tidak menumpuk saat pindah halaman
  root.addEventListener("click", (event) => {
    const radio = event.target.closest('input[name="answer"]');
    if (radio) {
      ui.answers[ui.index] = Number(radio.value);
      root.querySelector('[data-action="next"]')?.removeAttribute("disabled");
      return;
    }
    const el = event.target.closest("[data-action]");
    if (!el || !root.contains(el)) return;
    switch (el.dataset.action) {
      case "generate": return generate(false);
      case "generate-local": return generate(true);
      case "sample": {
        const quiz = quizzes.sampleQuiz(el.dataset.id);
        return quiz ? start(quiz) : toast("Kuis tidak ditemukan.", "error");
      }
      case "prev": ui.index = Math.max(0, ui.index - 1); return draw({ focus: true });
      case "next": return next();
      case "quit": ui.view = "menu"; ui.quiz = null; return draw({ focus: true });
      case "retry": return start(quizzes.shuffleQuiz(ui.quiz));
      case "menu": ui.view = "menu"; ui.quiz = null; ui.result = null; return draw({ focus: true });
      default: return undefined;
    }
  });

  draw();
  if (ui.ai === null) {
    chat.checkStatus().then((ok) => { ui.ai = ok; if (root.isConnected && ui.view === "menu") draw(); });
  }
}
