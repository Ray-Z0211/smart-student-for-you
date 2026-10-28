import { initRouter } from "./router.js";
import { initNav, setActive } from "./nav.js";
import * as store from "./store.js";
import { toast } from "./ui.js";
import { startReminders } from "./reminders.js";

function start() {
  initNav();

  // Link "Lewati ke konten": ditangani manual agar tidak mengubah alamat (#) milik router
  document.getElementById("skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("main").focus();
  });

  if (!store.isPersistent()) {
    toast(
      "Penyimpanan browser tidak tersedia, jadi datamu akan hilang saat halaman ditutup.",
      "warning",
      8000
    );
  }

  initRouter((route) => setActive(route));
  startReminders();
}

start();
