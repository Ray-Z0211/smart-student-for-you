import { loadingState, errorState, emptyState } from "./ui.js";

// SATU-SATUNYA daftar halaman. Sidebar, bottom nav, drawer, dan Beranda semuanya membaca dari sini.
// group "main"  = tampil di bottom navigation HP
// group "more"  = tampil di drawer (tombol Menu) di HP
export const routes = [
  { id: "dashboard", path: "/", label: "Beranda", short: "Beranda", icon: "home", group: "main",
    desc: "Ringkasan aktivitas dan jalan pintas ke semua fitur.",
    load: () => import("./pages/dashboard.js") },
  { id: "learning", path: "/belajar", label: "Belajar AI", short: "Belajar", icon: "chat", group: "main",
    desc: "Tanya materi pelajaran dan dapatkan penjelasan sesuai tingkatmu.",
    load: () => import("./pages/learning.js") },
  { id: "schedule", path: "/jadwal", label: "Jadwal", short: "Jadwal", icon: "calendar", group: "main",
    desc: "Atur tugas, tenggat waktu, dan kegiatan harianmu.",
    load: () => import("./pages/schedule.js") },
  { id: "career", path: "/karier", label: "Karier", short: "Karier", icon: "target", group: "more",
    desc: "Tes minat, rekomendasi jurusan, dan roadmap karier.",
    load: () => import("./pages/career.js") },
  { id: "notes", path: "/catatan", label: "Catatan", short: "Catatan", icon: "notes", group: "more",
    desc: "Rangkum materi menjadi poin-poin penting.",
    load: () => import("./pages/notes.js") },
  { id: "quiz", path: "/kuis", label: "Kuis", short: "Kuis", icon: "quiz", group: "more",
    desc: "Uji pemahamanmu dengan soal latihan.",
    load: () => import("./pages/quiz.js") },
  { id: "progress", path: "/progres", label: "Progres", short: "Progres", icon: "chart", group: "main",
    desc: "Pantau perkembangan belajar, XP, dan streak.",
    load: () => import("./pages/progress.js") },
];

const APP_NAME = "AI Smart Student Assistant";

let onChange = null;
let navToken = 0;      // penanda agar halaman lama tidak menimpa halaman baru
let firstLoad = true;

function currentPath() {
  const path = location.hash.replace(/^#/, "").split("?")[0];
  return path === "" ? "/" : path;
}

function mainEl() {
  return document.getElementById("main");
}

async function navigate() {
  const token = ++navToken;
  const main = mainEl();
  const route = routes.find((r) => r.path === currentPath()) ?? null;

  if (!route) {
    document.title = `Tidak ditemukan · ${APP_NAME}`;
    if (onChange) onChange(null);
    main.innerHTML = `
      <section class="card">
        ${emptyState({
          iconName: "quiz",
          title: "Halaman tidak ditemukan",
          text: "Alamat yang kamu buka tidak ada di aplikasi ini.",
        })}
        <p style="text-align:center"><a class="btn btn--primary" href="#/">Kembali ke Beranda</a></p>
      </section>`;
    return;
  }

  document.title = `${route.label} · ${APP_NAME}`;
  if (onChange) onChange(route);
  main.innerHTML = loadingState("Memuat halaman…");

  try {
    const module = await route.load();
    if (token !== navToken) return; // pengguna sudah pindah halaman lain
    main.innerHTML = "";
    await module.render(main);
  } catch (error) {
    if (token !== navToken) return;
    console.error(`Gagal memuat halaman "${route.id}":`, error);
    main.innerHTML = errorState("Halaman tidak dapat dimuat. Periksa koneksi lalu coba lagi.");
    main.querySelector('[data-action="retry"]')?.addEventListener("click", navigate);
  }

  if (token !== navToken) return;
  if (!firstLoad) {
    main.focus({ preventScroll: true }); // membantu pengguna keyboard dan pembaca layar
    window.scrollTo(0, 0);
  }
  firstLoad = false;
}

export function initRouter(callback) {
  onChange = callback;
  window.addEventListener("hashchange", navigate);
  navigate();
}
