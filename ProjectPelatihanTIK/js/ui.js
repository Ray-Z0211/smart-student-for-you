import { icon } from "./icons.js";

// Mengubah karakter berbahaya menjadi teks biasa
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

// Notifikasi singkat. type: "info" | "success" | "warning" | "error"
export function toast(message, type = "info", duration = 4000) {
  const region = document.getElementById("toast-region");
  if (!region) return;

  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.textContent = message; // textContent = aman dari XSS

  region.appendChild(el);
  while (region.children.length > 3) region.firstElementChild.remove();

  setTimeout(() => el.remove(), duration);
}

export function pageHeader(title, subtitle = "") {
  return `
    <header class="page-header">
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
    </header>`;
}

export function loadingState(text = "Memuat…") {
  return `
    <div class="loading" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <span>${escapeHtml(text)}</span>
    </div>`;
}

export function emptyState({ iconName = "sparkle", title, text }) {
  return `
    <div class="empty-state">
      <span class="empty-state__icon">${icon(iconName)}</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(text)}</p>
    </div>`;
}

export function errorState(message) {
  return `
    <section class="card">
      <div class="empty-state">
        <h2>Terjadi kesalahan</h2>
        <p>${escapeHtml(message)}</p>
        <button type="button" class="btn btn--primary" data-action="retry">Coba lagi</button>
      </div>
    </section>`;
}

// Halaman sementara untuk fitur yang belum dibangun (jujur, bukan fitur palsu)
export function renderComingSoon(container, { title, subtitle, step, features = [] }) {
  const items = features.map((f) => `<li>${escapeHtml(f)}</li>`).join("");
  container.innerHTML = `
    ${pageHeader(title, subtitle)}
    <section class="card coming-soon">
      <span class="badge">Segera hadir · dibangun di Langkah ${escapeHtml(step)}</span>
      <h2>Fitur ini belum tersedia</h2>
      <p>Halaman ini masih kerangka. Yang direncanakan:</p>
      <ul class="feature-list">${items}</ul>
    </section>`;
}

// Dialog konfirmasi. Mengembalikan Promise<boolean> (true jika pengguna menekan tombol konfirmasi).
export function confirmDialog({ title, message, confirmText = "Ya", cancelText = "Batal", danger = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "dialog dialog--sm";
    dlg.setAttribute("aria-labelledby", "confirm-title");
    dlg.innerHTML = `
      <div class="dialog__body">
        <h2 id="confirm-title">${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        <div class="dialog__actions">
          <button type="button" class="btn" data-v="no">${escapeHtml(cancelText)}</button>
          <button type="button" class="btn ${danger ? "btn--danger" : "btn--primary"}" data-v="yes">${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    let result = false;
    dlg.addEventListener("click", (event) => {
      const value = event.target.closest("[data-v]")?.dataset.v;
      if (value) {
        result = value === "yes";
        dlg.close();
      } else if (event.target === dlg) {
        dlg.close(); // klik area gelap = batal
      }
    });
    dlg.addEventListener("close", () => {
      dlg.remove();
      resolve(result);
    });
    document.body.appendChild(dlg);
    dlg.showModal();
  });
}

// Menyalin teks ke clipboard. Mengembalikan true jika berhasil.
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* lanjut ke cara cadangan */ }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
