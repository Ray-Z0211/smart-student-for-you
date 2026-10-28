import { icon } from "../icons.js";
import { pageHeader, escapeHtml, toast, confirmDialog } from "../ui.js";
import * as engine from "../career-engine.js";
import { QUESTIONS, ANSWER_LABELS } from "../data/career-data.js";

// Status tampilan (hanya selama halaman terbuka). Jawaban sendiri disimpan di LocalStorage.
const ui = { started: false, index: 0, showAll: false };

function bar(value, label) {
  return `<div class="progress" role="progressbar" aria-label="${escapeHtml(label)}"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}">
            <div class="progress__bar" style="width:${value}%"></div>
          </div>`;
}

/* ====================== Tampilan: pengantar ====================== */

function introView(answeredCount) {
  const total = QUESTIONS.length;
  const resume = answeredCount > 0;
  return `
    <section class="card stack" aria-labelledby="h-intro">
      <h2 id="h-intro" class="section-title">Tes minat</h2>
      <p>Tes ini untuk remaja SMP, SMA, SMK, atau yang sebaya. Isinya ${total} pernyataan tentang kegiatan sehari-hari. Pilih seberapa kamu menyukainya.</p>
      <p>Ini bukan ujian dan bukan tes IQ. Tidak ada jawaban benar atau salah, dan waktunya sekitar 5 menit. Jawab sesuai dirimu yang sebenarnya, bukan yang kamu kira orang lain inginkan.</p>
      <p class="note">Jawabanmu hanya disimpan di browser ini. Hasilnya adalah gambaran minat, bukan jaminan kesuksesan atau peluang pasti mendapat pekerjaan.</p>
      ${resume ? `<p><strong>${answeredCount} dari ${total}</strong> pertanyaan sudah kamu jawab.</p>` : ""}
      <p><button type="button" class="btn btn--primary" data-action="start">${resume ? "Lanjutkan tes" : "Mulai tes"}${icon("chevronRight")}</button></p>
      ${resume ? `<p><button type="button" class="btn" data-action="reset">Ulangi dari awal</button></p>` : ""}
    </section>`;
}

/* ====================== Tampilan: pertanyaan ====================== */

function questionView(state) {
  const total = QUESTIONS.length;
  const q = QUESTIONS[ui.index];
  const current = state.answers[q.id];
  const answered = Object.keys(state.answers).length;
  const last = ui.index === total - 1;

  const choices = ANSWER_LABELS.map((label, value) => `
    <label class="choice">
      <input type="radio" name="answer" value="${value}" ${current === value ? "checked" : ""} />
      <span class="choice__text"><span class="choice__dot" aria-hidden="true"></span>${escapeHtml(label)}</span>
    </label>`).join("");

  return `
    <section class="card" aria-label="Tes minat">
      <div class="test-progress">
        <div class="test-progress__head">
          <span>Pertanyaan ${ui.index + 1} dari ${total}</span>
          <span>${answered} terjawab</span>
        </div>
        ${bar(Math.round((answered / total) * 100), "Jumlah pertanyaan yang sudah dijawab")}
      </div>

      <fieldset class="question" id="q-focus" tabindex="-1">
        <legend>Seberapa kamu suka: ${escapeHtml(q.text)}</legend>
        <div class="choices">${choices}</div>
      </fieldset>

      <div class="test-nav">
        <button type="button" class="btn" data-action="prev" ${ui.index === 0 ? "disabled" : ""}>${icon("chevronLeft")}Sebelumnya</button>
        <button type="button" class="btn btn--primary" data-action="next" ${current === undefined ? "disabled" : ""}>${last ? "Lihat hasil" : "Lanjut"}${icon("chevronRight")}</button>
      </div>
    </section>`;
}

/* ====================== Tampilan: hasil ====================== */

function careerCard(m, rank, open) {
  const c = m.career;
  return `
    <li>
      <details class="career" ${open ? "open" : ""}>
        <summary class="career__sum">
          <span class="career__rank">${rank}</span>
          <span class="career__name">${escapeHtml(c.title)}</span>
          <span class="career__pct">${m.match}%</span>
          <span class="career__chev" aria-hidden="true">${icon("chevronRight")}</span>
        </summary>
        <div class="career__body">
          ${bar(m.match, `Kecocokan minat dengan ${c.title}`)}
          <p class="note">Kecocokan minat ${m.match}%. Ini bukan prediksi keberhasilan.</p>
          <p>${escapeHtml(c.desc)}</p>
          <h4>Mengapa cocok</h4>
          <p>${escapeHtml(m.reason)}</p>
          <h4>Jurusan kuliah terkait</h4>
          <p class="chips">${c.majors.map((x) => `<span class="chip">${escapeHtml(x)}</span>`).join("")}</p>
          <h4>Keterampilan yang dibutuhkan</h4>
          <ul class="plain-list">${c.skills.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
          <h4>Roadmap belajar</h4>
          <ol class="plain-list">${c.roadmap.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ol>
        </div>
      </details>
    </li>`;
}

function resultView(state) {
  const scores = engine.categoryScores(state.answers);
  const ranking = engine.profileRanking(scores);
  const matches = engine.careerMatches(scores);
  const majors = engine.recommendMajors(matches);
  const top = matches.slice(0, 5);
  const rest = matches.slice(5);

  const profileRows = ranking.map((p) => `
    <li class="profile-row">
      <div class="goal__head"><span><strong>${escapeHtml(p.name)}</strong></span><span>${p.score}%</span></div>
      ${bar(p.score, `Skor minat ${p.name}`)}
      <p class="note">${escapeHtml(p.desc)}</p>
    </li>`).join("");

  const majorItems = majors.map((m) => `
    <li><strong>${escapeHtml(m.major)}</strong>
      <span class="note">Terkait: ${escapeHtml(m.careers.slice(0, 2).join(", "))}</span></li>`).join("");

  return `
    <div class="stack">
      <section class="card" aria-labelledby="h-profile">
        <h2 id="h-profile" class="section-title">Profil minatmu</h2>
        <p>Tiga minat tertinggimu: <strong>${ranking.slice(0, 3).map((p) => escapeHtml(p.name)).join(", ")}</strong>.</p>
        <ul class="profile-list">${profileRows}</ul>
      </section>

      <section aria-labelledby="h-careers">
        <h2 id="h-careers" class="section-title">Rekomendasi karier</h2>
        <ul class="career-list">${top.map((m, i) => careerCard(m, i + 1, i === 0)).join("")}</ul>
        ${rest.length ? `
          <p><button type="button" class="btn" data-action="toggle-all" aria-expanded="${ui.showAll}">${ui.showAll ? "Sembunyikan karier lainnya" : `Tampilkan ${rest.length} karier lainnya`}</button></p>
          ${ui.showAll ? `<ul class="career-list">${rest.map((m, i) => careerCard(m, i + 6, false)).join("")}</ul>` : ""}` : ""}
      </section>

      <section class="card" aria-labelledby="h-majors">
        <h2 id="h-majors" class="section-title">Jurusan kuliah yang bisa kamu pertimbangkan</h2>
        <ul class="plain-list">${majorItems}</ul>
      </section>

      <section class="card" aria-labelledby="h-note">
        <h2 id="h-note" class="section-title">Catatan penting</h2>
        <p class="note">Persentase menunjukkan seberapa dekat minatmu dengan profil sebuah profesi berdasarkan jawabanmu. Itu bukan jaminan kesuksesan, bukan peluang pasti diterima kerja, dan tidak menilai kemampuanmu. Pertimbangkan juga nilai, kemampuan, kondisi keluarga, dan hasil mencoba langsung. Minatmu juga bisa berubah seiring waktu, jadi tes ini boleh diulang. Kalau kamu masih SMP, hasil ini bisa membantu memilih SMA atau SMK. Bicarakan dengan guru BK, orang tua, atau orang yang kamu percaya.</p>
        <p><button type="button" class="btn" data-action="reset">Ulangi tes</button></p>
      </section>
    </div>`;
}

/* ====================== Halaman ====================== */

export function render(container) {
  container.innerHTML = `
    <div class="career-page">
      ${pageHeader("Karier", "Tes minat untuk remaja: kenali kegiatan yang kamu suka, lalu lihat jurusan dan karier yang dekat dengan minatmu.")}
      <div id="career-body"></div>
    </div>`;

  const root = container.firstElementChild;
  const body = root.querySelector("#career-body");

  function draw({ focusQuestion = false } = {}) {
    const state = engine.loadState();
    const count = Object.keys(state.answers).length;
    if (state.completedAt) body.innerHTML = resultView(state);
    else if (ui.started) body.innerHTML = questionView(state);
    else body.innerHTML = introView(count);

    if (focusQuestion) body.querySelector("#q-focus")?.focus({ preventScroll: false });
  }

  function go(delta) {
    ui.index = Math.min(QUESTIONS.length - 1, Math.max(0, ui.index + delta));
    draw({ focusQuestion: true });
  }

  function next() {
    const state = engine.loadState();
    if (state.answers[QUESTIONS[ui.index].id] === undefined) return;
    if (ui.index < QUESTIONS.length - 1) return go(1);

    const result = engine.finishTest();
    if (!result.ok) {
      ui.index = engine.firstUnanswered(state.answers);
      toast("Masih ada pertanyaan yang belum dijawab.", "warning");
      return draw({ focusQuestion: true });
    }
    toast("Tes selesai! Ini hasil minatmu.", "success");
    ui.showAll = false;
    draw();
    return window.scrollTo(0, 0);
  }

  async function reset() {
    const yes = await confirmDialog({
      title: "Ulangi tes?",
      message: "Semua jawaban dan hasil tes minatmu akan dihapus dari browser ini.",
      confirmText: "Ya, ulangi",
      danger: true,
    });
    if (!yes) return;
    engine.resetTest();
    ui.started = false;
    ui.index = 0;
    ui.showAll = false;
    toast("Tes direset.", "info");
    draw();
  }

  // Pendengar dipasang pada elemen baru (bukan <main>) agar tidak menumpuk saat pindah halaman
  root.addEventListener("click", (event) => {
    const input = event.target.closest('input[name="answer"]');
    if (input) {
      const qIndex = ui.index;
      const ok = engine.saveAnswer(QUESTIONS[qIndex].id, Number(input.value));
      if (!ok) return toast("Gagal menyimpan jawaban. Penyimpanan browser mungkin penuh.", "error");
      root.querySelector('[data-action="next"]')?.removeAttribute("disabled");
      // Sentuhan atau klik (detail > 0) lanjut otomatis. Keyboard (detail = 0) tidak, agar panah tidak melompat.
      if (event.detail > 0) setTimeout(() => { if (ui.started && ui.index === qIndex) next(); }, 250);
      return undefined;
    }

    const el = event.target.closest("[data-action]");
    if (!el || !root.contains(el)) return undefined;
    switch (el.dataset.action) {
      case "start": {
        const state = engine.loadState();
        ui.started = true;
        ui.index = engine.firstUnanswered(state.answers);
        return draw({ focusQuestion: true });
      }
      case "prev": return go(-1);
      case "next": return next();
      case "reset": return reset();
      case "toggle-all": ui.showAll = !ui.showAll; return draw();
      default: return undefined;
    }
  });

  draw();
}
