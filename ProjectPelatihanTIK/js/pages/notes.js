import { icon } from "../icons.js";
import { pageHeader, escapeHtml, toast, confirmDialog, copyText } from "../ui.js";
import * as store from "../store.js";
import * as notes from "../notes-engine.js";
import * as chat from "../chat-engine.js";

// Status selama halaman terbuka. ai: null = sedang diperiksa, true = server AI aktif, false = tanpa AI
const ui = { ai: null, busy: false, current: null };

const badgeHtml = () =>
  ui.ai === null ? `<span class="badge">Memeriksa server…</span>`
  : ui.ai ? `<span class="badge">AI aktif</span>`
  : `<span class="badge badge--demo">Tanpa AI</span>`;

const dateText = (iso) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

function sourceLabel(ai) {
  return ai
    ? `<p class="note">Dirangkum oleh AI. Tetap periksa kembali dengan bukumu.</p>`
    : `<p class="note"><strong>Rangkuman otomatis tanpa AI.</strong> Aplikasi memilih kalimat yang paling sering memuat kata penting. Hasilnya bisa kurang tepat, jadi cek kembali dengan materimu.</p>`;
}

function contentHtml(r) {
  const points = r.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
  const terms = r.terms.map((t) => `
    <li><strong>${escapeHtml(t.term)}</strong>${t.note ? `<span class="note">${escapeHtml(t.note)}</span>` : ""}</li>`).join("");
  return `
    <h3>Poin penting</h3>
    <ol class="plain-list">${points}</ol>
    ${r.terms.length ? `<h3>Istilah penting${r.ai ? "" : ` <span class="note">(dari kata yang sering muncul, beserta kalimat asalnya)</span>`}</h3>
    <ul class="plain-list term-list">${terms}</ul>` : ""}`;
}

function resultHtml(r) {
  return `
    <section class="card" aria-labelledby="h-result">
      <h2 id="h-result" class="section-title">Hasil rangkuman</h2>
      ${sourceLabel(r.ai)}
      ${contentHtml(r)}
      <div class="field">
        <label for="n-title">Judul catatan (untuk disimpan)</label>
        <input id="n-title" type="text" maxlength="80" value="${escapeHtml(r.title)}" />
      </div>
      <div class="nav-row">
        <button type="button" class="btn" data-action="copy">Salin</button>
        <button type="button" class="btn btn--primary" data-action="save">${icon("plus")}Simpan catatan</button>
        <button type="button" class="btn" data-action="quiz">Buat kuis dari materi ini</button>
      </div>
    </section>`;
}

function savedHtml(list) {
  if (!list.length) {
    return `<div class="empty-state"><span class="empty-state__icon">${icon("notes")}</span><h2>Belum ada catatan tersimpan</h2><p>Rangkum materi lalu tekan Simpan catatan.</p></div>`;
  }
  return `<ul class="career-list">${list.map((n) => `
    <li>
      <details class="career">
        <summary class="career__sum note-sum">
          <span class="career__name">${escapeHtml(n.title)}</span>
          <span class="note">${escapeHtml(dateText(n.ts))} · ${n.ai ? "AI" : "otomatis"}</span>
          <span class="career__chev" aria-hidden="true">${icon("chevronRight")}</span>
        </summary>
        <div class="career__body">
          ${contentHtml({ points: n.points, terms: Array.isArray(n.terms) ? n.terms : [], ai: n.ai })}
          <div class="nav-row">
            <button type="button" class="btn" data-action="saved-copy" data-id="${escapeHtml(n.id)}">Salin</button>
            <button type="button" class="btn" data-action="saved-quiz" data-id="${escapeHtml(n.id)}">Buat kuis</button>
            <button type="button" class="btn btn--danger" data-action="saved-delete" data-id="${escapeHtml(n.id)}">${icon("trash")}Hapus</button>
          </div>
        </div>
      </details>
    </li>`).join("")}</ul>`;
}

export function render(container) {
  container.innerHTML = `
    <div class="notes-page">
      <div class="page-head">
        ${pageHeader("Catatan", "Rangkum materi menjadi poin-poin penting yang mudah dibaca.")}
        <span id="n-badge">${badgeHtml()}</span>
      </div>

      <section class="card stack" aria-labelledby="h-input">
        <h2 id="h-input" class="section-title">Materi</h2>
        <div class="field">
          <label for="n-input">Tempel teks materi pelajaran</label>
          <textarea id="n-input" maxlength="${notes.MAX_TEXT}" rows="8" placeholder="Tempel materi di sini, minimal ${notes.MIN_TEXT} karakter…"></textarea>
          <p class="hint"><span id="n-count">0</span> / ${notes.MAX_TEXT} karakter</p>
        </div>
        <div class="nav-row">
          <button type="button" class="btn btn--primary" id="n-go" data-action="summarize">${icon("sparkle")}<span id="n-go-label">Rangkum</span></button>
          <button type="button" class="btn" id="n-local" data-action="summarize-local" hidden>Rangkum tanpa AI</button>
          <button type="button" class="btn" data-action="clear">Bersihkan</button>
        </div>
      </section>

      <div id="n-result" class="section" aria-live="polite"></div>

      <section class="section" aria-labelledby="h-saved">
        <h2 id="h-saved" class="section-title">Catatan tersimpan</h2>
        <div id="n-saved"></div>
      </section>
    </div>`;

  const root = container.firstElementChild;
  const $ = (sel) => root.querySelector(sel);
  const input = $("#n-input");

  const drawStatus = () => {
    $("#n-badge").innerHTML = badgeHtml();
    $("#n-go-label").textContent = ui.ai ? "Rangkum dengan AI" : "Rangkum";
    $("#n-local").hidden = !ui.ai;
  };
  const drawSaved = () => { $("#n-saved").innerHTML = savedHtml(notes.loadNotes()); };
  const drawResult = () => { $("#n-result").innerHTML = ui.current ? resultHtml(ui.current) : ""; };
  const setBusy = (v) => {
    ui.busy = v;
    root.querySelectorAll("[data-action='summarize'], [data-action='summarize-local']").forEach((b) => { b.disabled = v; });
    if (v) $("#n-result").innerHTML = `<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span><span>Sedang merangkum…</span></div>`;
  };

  async function summarize(forceLocal) {
    if (ui.busy) return;
    const text = input.value.trim();
    const err = notes.validateInput(text);
    if (err) return toast(err, "warning");
    setBusy(true);
    ui.current = null;
    try {
      if (ui.ai === null) ui.ai = await chat.checkStatus();
      drawStatus();
      const useAI = ui.ai && !forceLocal;
      const result = useAI ? await notes.askNotesAI(text, chat.getPrefs().level) : notes.summarizeLocal(text);
      if (!result.points.length) throw new Error("Materi terlalu pendek untuk dirangkum. Tambahkan lebih banyak kalimat.");
      ui.current = { ...result, source: text, title: notes.defaultTitle(text) };
    } catch (error) {
      toast(error.message || "Gagal merangkum. Coba lagi.", "error", 6000);
    } finally {
      setBusy(false);
      drawResult();
      if (ui.current) $("#n-result").scrollIntoView({ block: "start" });
    }
  }

  function gotoQuiz(source) {
    store.setSetting("quizSource", String(source ?? "").slice(0, notes.MAX_TEXT));
    location.hash = "#/kuis";
  }

  // Pendengar dipasang pada elemen baru (bukan <main>) agar tidak menumpuk saat pindah halaman
  input.addEventListener("input", () => { $("#n-count").textContent = String(input.value.length); });

  root.addEventListener("click", async (event) => {
    const el = event.target.closest("[data-action]");
    if (!el || !root.contains(el)) return;
    const { action, id } = el.dataset;

    if (action === "summarize") return summarize(false);
    if (action === "summarize-local") return summarize(true);
    if (action === "clear") {
      input.value = "";
      $("#n-count").textContent = "0";
      ui.current = null;
      drawResult();
      return input.focus();
    }
    if (action === "copy" && ui.current) {
      const title = $("#n-title")?.value.trim() || ui.current.title;
      const ok = await copyText(notes.toPlainText({ ...ui.current, title }));
      return toast(ok ? "Rangkuman disalin." : "Gagal menyalin. Blok teksnya lalu salin manual.", ok ? "success" : "error");
    }
    if (action === "save" && ui.current) {
      const title = $("#n-title")?.value.trim() || ui.current.title;
      const saved = notes.addNote({ ...ui.current, title });
      if (!saved) return toast("Gagal menyimpan. Penyimpanan browser mungkin penuh.", "error");
      toast("Catatan disimpan.", "success");
      return drawSaved();
    }
    if (action === "quiz" && ui.current) return gotoQuiz(ui.current.source);

    const note = id ? notes.getNote(id) : null;
    if (action === "saved-copy" && note) {
      const ok = await copyText(notes.toPlainText({ ...note, terms: note.terms ?? [] }));
      return toast(ok ? "Catatan disalin." : "Gagal menyalin.", ok ? "success" : "error");
    }
    if (action === "saved-quiz" && note) {
      if (!note.source) return toast("Materi asli catatan ini tidak tersimpan.", "warning");
      return gotoQuiz(note.source);
    }
    if (action === "saved-delete" && note) {
      const yes = await confirmDialog({ title: "Hapus catatan?", message: `"${note.title}" akan dihapus dari browser ini.`, confirmText: "Hapus", danger: true });
      if (!yes) return;
      notes.deleteNote(id);
      toast("Catatan dihapus.", "success");
      drawSaved();
    }
  });

  drawStatus();
  drawSaved();
  if (ui.ai === null) chat.checkStatus().then((ok) => { ui.ai = ok; if (root.isConnected) drawStatus(); });
}
