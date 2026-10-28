import { icon } from "../icons.js";
import { pageHeader, escapeHtml, toast, confirmDialog } from "../ui.js";
import * as chat from "../chat-engine.js";

const EXAMPLES = ["Jelaskan fotosintesis", "Apa itu teorema Pythagoras?", "Apa itu alamat IP?", "Jelaskan hukum Newton"];

// Status selama halaman terbuka
const ui = { ai: null, busy: false }; // ai: null = sedang diperiksa, true = server AI aktif, false = mode demo

function badgeHtml() {
  if (ui.ai === null) return `<span class="badge">Memeriksa server…</span>`;
  if (ui.ai) return `<span class="badge">AI aktif</span>`;
  return `<span class="badge badge--demo">Mode demo</span>`;
}

function statusNote() {
  if (ui.ai === false) {
    return `<p class="note">Mode demo: jawaban berasal dari contoh bawaan untuk beberapa topik, <strong>bukan AI sungguhan</strong>. Server AI belum aktif atau aplikasi tidak dijalankan lewat <code>python server.py</code>.</p>`;
  }
  return "";
}

function optionsHtml(map, selected) {
  return Object.entries(map).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function messageHtml(m) {
  const mine = m.role === "user";
  const who = mine ? "Kamu" : m.demo ? "Asisten (demo, bukan AI)" : "Asisten (AI)";
  return `
    <li class="msg ${mine ? "msg--user" : "msg--ai"}">
      <span class="msg__who">${who}</span>
      <div class="msg__bubble">${mine ? `<p>${escapeHtml(m.content).replace(/\n/g, "<br>")}</p>` : chat.formatText(m.content)}</div>
    </li>`;
}

function emptyHtml() {
  const chips = EXAMPLES.map((t) => `<button type="button" class="chip chip--btn" data-action="example" data-text="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("");
  return `
    <li class="chat-empty">
      <span class="empty-state__icon">${icon("chat")}</span>
      <h2>Tanya apa saja soal pelajaran</h2>
      <p>Pilih tingkat dan mode belajar di atas, lalu ketik pertanyaanmu. Atau coba salah satu contoh:</p>
      <div class="chips">${chips}</div>
    </li>`;
}

export function render(container) {
  const prefs = chat.getPrefs();

  container.innerHTML = `
    <div class="chat-page">
      <div class="page-head">
        ${pageHeader("Belajar AI", "Tanya materi pelajaran dan dapatkan penjelasan sesuai tingkat pendidikanmu.")}
        <span id="chat-badge">${badgeHtml()}</span>
      </div>
      <div id="chat-note"></div>

      <section class="card chat-options" aria-label="Pengaturan belajar">
        <div class="field-row">
          <div class="field">
            <label for="chat-level">Tingkat pendidikan</label>
            <select id="chat-level" data-pref="level">${optionsHtml(chat.LEVELS, prefs.level)}</select>
          </div>
          <div class="field">
            <label for="chat-mode">Mode belajar</label>
            <select id="chat-mode" data-pref="mode">${optionsHtml(chat.MODES, prefs.mode)}</select>
          </div>
        </div>
        <button type="button" class="btn" data-action="clear">${icon("trash")}Hapus percakapan</button>
      </section>

      <ul class="messages" id="chat-messages" aria-live="polite" aria-label="Percakapan"></ul>

      <form class="composer" id="chat-form" novalidate>
        <label for="chat-input" class="sr-only">Tulis pertanyaanmu</label>
        <textarea id="chat-input" rows="1" maxlength="${chat.MAX_INPUT}" placeholder="Tulis pertanyaanmu…" autocomplete="off"></textarea>
        <button type="submit" class="btn btn--primary btn--icon" id="chat-send" aria-label="Kirim">${icon("chevronRight")}</button>
      </form>
    </div>`;

  const root = container.firstElementChild;
  const $ = (sel) => root.querySelector(sel);
  const list = $("#chat-messages");
  const input = $("#chat-input");
  const send = $("#chat-send");

  function drawStatus() {
    $("#chat-badge").innerHTML = badgeHtml();
    $("#chat-note").innerHTML = statusNote();
  }

  function drawMessages() {
    const history = chat.loadHistory();
    list.innerHTML = (history.length ? history.map(messageHtml).join("") : emptyHtml())
      + (ui.busy ? `<li class="msg msg--ai"><span class="msg__who">Asisten</span><div class="msg__bubble"><span class="loading"><span class="spinner" aria-hidden="true"></span><span>Sedang menjawab…</span></span></div></li>` : "");
    list.lastElementChild?.scrollIntoView({ block: "end" });
  }

  function setBusy(value) {
    ui.busy = value;
    send.disabled = value;
    input.disabled = value;
  }

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }

  async function submit(rawText) {
    const text = String(rawText ?? "").trim();
    if (!text || ui.busy) return;
    if (text.length > chat.MAX_INPUT) return toast(`Pertanyaan maksimal ${chat.MAX_INPUT} karakter.`, "error");
    if (!chat.addMessage("user", text)) return toast("Gagal menyimpan pesan. Penyimpanan browser mungkin penuh.", "error");

    input.value = "";
    autoGrow();
    setBusy(true);
    drawMessages();

    try {
      if (ui.ai === null) ui.ai = await chat.checkStatus();
      drawStatus();
      const prefsNow = chat.getPrefs();
      const reply = ui.ai
        ? await chat.askAI(chat.loadHistory(), prefsNow)
        : chat.demoReply(text, prefsNow.mode);
      chat.addMessage("assistant", reply, !ui.ai);
    } catch (error) {
      toast(error.message || "Terjadi kesalahan. Coba lagi.", "error", 6000);
    } finally {
      setBusy(false);
      drawMessages();
      if (matchMedia("(pointer: fine)").matches) input.focus();
    }
  }

  // Pendengar dipasang pada elemen baru (bukan <main>) agar tidak menumpuk saat pindah halaman
  $("#chat-form").addEventListener("submit", (event) => { event.preventDefault(); submit(input.value); });

  input.addEventListener("input", autoGrow);
  input.addEventListener("keydown", (event) => {
    // Di laptop: Enter = kirim, Shift+Enter = baris baru. Di HP: Enter = baris baru (kirim pakai tombol).
    if (event.key === "Enter" && !event.shiftKey && matchMedia("(pointer: fine)").matches) {
      event.preventDefault();
      submit(input.value);
    }
  });

  // Saat mengetik di HP, sembunyikan bottom navigation agar kolom input tidak tertutup
  const setTyping = (on) => document.body.classList.toggle("is-typing", on);
  input.addEventListener("focus", () => setTyping(true));
  input.addEventListener("blur", () => setTyping(false));
  window.addEventListener("hashchange", () => setTyping(false), { once: true });

  root.addEventListener("change", (event) => {
    const name = event.target.dataset?.pref;
    if (name) chat.setPref(name, event.target.value);
  });

  root.addEventListener("click", async (event) => {
    const el = event.target.closest("[data-action]");
    if (!el || !root.contains(el)) return;
    if (el.dataset.action === "example") {
      input.value = el.dataset.text;
      autoGrow();
      input.focus();
    }
    if (el.dataset.action === "clear") {
      const yes = await confirmDialog({
        title: "Hapus percakapan?",
        message: "Semua pesan di halaman ini akan dihapus dari browser.",
        confirmText: "Hapus",
        danger: true,
      });
      if (!yes) return;
      chat.clearHistory();
      toast("Percakapan dihapus.", "success");
      drawMessages();
    }
  });

  drawStatus();
  drawMessages();
  window.scrollTo(0, 0);

  // Periksa apakah server AI aktif (di Live Server hasilnya false, jadi mode demo)
  if (ui.ai === null) {
    chat.checkStatus().then((ok) => { ui.ai = ok; if (root.isConnected) drawStatus(); });
  } else {
    drawStatus();
  }
}
