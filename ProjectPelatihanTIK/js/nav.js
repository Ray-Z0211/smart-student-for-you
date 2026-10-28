import { routes } from "./router.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./ui.js";
import * as store from "./store.js";

const $ = (id) => document.getElementById(id);

function linkHtml(route, extraClass = "nav-link") {
  const label = escapeHtml(route.label);
  return `<a class="${extraClass}" href="#${route.path}" data-route="${route.id}" title="${label}">
    ${icon(route.icon)}<span class="nav-label">${label}</span>
  </a>`;
}

/* ---------- Sidebar ---------- */
function renderSidebar() {
  $("sidebar-logo").innerHTML = icon("sparkle");
  $("topbar-logo").innerHTML = icon("sparkle");
  $("sidebar-nav").innerHTML = routes.map((r) => linkHtml(r)).join("");
}

function applyCollapsed(collapsed) {
  const toggle = $("sidebar-toggle");
  const label = collapsed ? "Perluas menu" : "Ciutkan menu";
  $("app").classList.toggle("is-collapsed", collapsed);
  toggle.innerHTML = `${icon("chevronLeft")}<span class="nav-label">Ciutkan menu</span>`;
  toggle.setAttribute("aria-label", label);
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.title = label;
}

function initSidebarToggle() {
  let collapsed = store.getSetting("sidebarCollapsed", false);
  applyCollapsed(collapsed);
  $("sidebar-toggle").addEventListener("click", () => {
    collapsed = !collapsed;
    applyCollapsed(collapsed);
    store.setSetting("sidebarCollapsed", collapsed);
  });
}

/* ---------- Bottom navigation (HP) ---------- */
function renderBottomNav() {
  const mainRoutes = routes.filter((r) => r.group === "main");
  const items = mainRoutes
    .map((r) => `<a class="bottom-nav__item" href="#${r.path}" data-route="${r.id}">
        ${icon(r.icon)}<span>${escapeHtml(r.short ?? r.label)}</span>
      </a>`)
    .join("");

  $("bottom-nav").innerHTML = `${items}
    <button type="button" class="bottom-nav__item" id="menu-button"
            aria-haspopup="dialog" aria-expanded="false" aria-controls="drawer">
      ${icon("menu")}<span>Menu</span>
    </button>`;
}

/* ---------- Drawer ---------- */
function renderDrawer() {
  const moreRoutes = routes.filter((r) => r.group === "more");
  $("drawer").innerHTML = `
    <div class="drawer__head">
      <h2 class="drawer__title" id="drawer-title">Menu lainnya</h2>
      <button type="button" class="btn btn--icon" id="drawer-close" aria-label="Tutup menu">${icon("close")}</button>
    </div>
    <ul class="drawer__list">
      ${moreRoutes.map((r) => `<li>${linkHtml(r)}</li>`).join("")}
    </ul>`;
}

function setBackgroundInert(value) {
  $("main-wrap").inert = value;
  $("bottom-nav").inert = value;
}

export function openDrawer() {
  $("drawer").classList.add("is-open");
  $("drawer-backdrop").classList.add("is-open");
  $("menu-button").setAttribute("aria-expanded", "true");
  setBackgroundInert(true);
  $("drawer-close").focus();
}

export function closeDrawer(restoreFocus = true) {
  if (!$("drawer").classList.contains("is-open")) return;
  $("drawer").classList.remove("is-open");
  $("drawer-backdrop").classList.remove("is-open");
  $("menu-button").setAttribute("aria-expanded", "false");
  setBackgroundInert(false);
  if (restoreFocus) $("menu-button").focus();
}

function initDrawer() {
  $("menu-button").addEventListener("click", () => {
    $("drawer").classList.contains("is-open") ? closeDrawer() : openDrawer();
  });
  $("drawer-close").addEventListener("click", () => closeDrawer());
  $("drawer-backdrop").addEventListener("click", () => closeDrawer());
  $("drawer").addEventListener("click", (event) => {
    if (event.target.closest("a")) closeDrawer(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });
}

/* ---------- Penanda halaman aktif ---------- */
export function setActive(route) {
  document.querySelectorAll("[data-route]").forEach((el) => {
    if (route && el.dataset.route === route.id) {
      el.setAttribute("aria-current", "page");
    } else {
      el.removeAttribute("aria-current");
    }
  });
  // Tombol Menu ikut menyala jika halaman aktif ada di dalam drawer
  $("menu-button").classList.toggle("is-active", route?.group === "more");
  closeDrawer(false);
}

export function initNav() {
  renderSidebar();
  renderBottomNav();
  renderDrawer();
  initSidebarToggle();
  initDrawer();
}
