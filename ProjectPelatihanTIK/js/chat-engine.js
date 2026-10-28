import * as store from "./store.js";
import { escapeHtml } from "./ui.js";
import { apiUrl } from "./api.js";

export const LEVELS = { smp: "SMP", sma: "SMA", smk: "SMK", kuliah: "Kuliah" };
export const MODES = { simple: "Penjelasan sederhana", deep: "Penjelasan mendalam", steps: "Petunjuk bertahap" };
export const MAX_INPUT = 1000;
const MAX_HISTORY = 60;

/* ---------- Pilihan pengguna ---------- */
export function getPrefs() {
  const level = store.getSetting("chatLevel", "sma");
  const mode = store.getSetting("chatMode", "simple");
  return { level: level in LEVELS ? level : "sma", mode: mode in MODES ? mode : "simple" };
}
export function setPref(name, value) {
  if (name === "level" && value in LEVELS) store.setSetting("chatLevel", value);
  if (name === "mode" && value in MODES) store.setSetting("chatMode", value);
}

/* ---------- Riwayat percakapan (LocalStorage) ---------- */
export function loadHistory() {
  const raw = store.get(store.KEYS.CHAT, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length <= 8000)
    .slice(-MAX_HISTORY);
}
export function addMessage(role, content, demo = false) {
  const list = loadHistory();
  list.push({ role, content, demo: Boolean(demo), ts: new Date().toISOString() });
  return store.set(store.KEYS.CHAT, list.slice(-MAX_HISTORY));
}
export function clearHistory() {
  store.remove(store.KEYS.CHAT);
}

/* ---------- Server AI (opsional) ---------- */
export async function checkStatus() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(apiUrl("api/status"), { signal: controller.signal, cache: "no-store" });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return false;
    const data = await res.json();
    return data.ai === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Pesan yang dikirim ke AI: hanya yang setelah balasan demo terakhir (balasan demo bukan dari AI)
export function contextForAI(history) {
  let start = 0;
  history.forEach((m, i) => { if (m.role === "assistant" && m.demo) start = i + 1; });
  return history.slice(start).slice(-10).map(({ role, content }) => ({ role, content }));
}

export async function askAI(history, { level, mode }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(apiUrl("api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: contextForAI(history), level, mode }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "AI tidak dapat menjawab saat ini.");
    return data.reply;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("AI terlalu lama menjawab. Coba lagi.");
    if (error instanceof TypeError) throw new Error("Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Mode demo: jawaban contoh tetap, BUKAN AI ---------- */
const DEMO_NOTE = "Catatan: ini jawaban contoh bawaan (mode demo), bukan dari AI, dan belum disesuaikan dengan tingkat pendidikanmu.";

const DEMO_TOPICS = [
  {
    title: "Fotosintesis",
    match: /fotosintesis|fotosintesa/,
    simple: "Fotosintesis adalah cara tumbuhan membuat makanannya sendiri.\n\n- Bahan: cahaya matahari, air dari tanah, dan karbon dioksida dari udara.\n- Hasil: gula (makanan untuk tumbuhan) dan oksigen yang dilepas ke udara.\n- Tempat: bagian daun yang hijau karena mengandung klorofil.",
    deep: "Fotosintesis terjadi di kloroplas, organel yang mengandung klorofil.\n\n1. Reaksi terang (di tilakoid): cahaya dipakai untuk memecah air, menghasilkan oksigen, ATP, dan NADPH.\n2. Reaksi gelap atau siklus Calvin (di stroma): ATP dan NADPH dipakai untuk mengubah karbon dioksida menjadi glukosa.\n\nPersamaan umum: 6CO2 + 6H2O + energi cahaya → C6H12O6 + 6O2.",
    steps: "Coba pikirkan sambil menjawab pertanyaan ini:\n\n1. Tumbuhan tidak bisa makan seperti kita. Bahan apa saja yang ada di sekitarnya?\n2. Cahaya matahari berperan sebagai bahan atau sebagai energi?\n3. Bagian daun mana yang berwarna hijau, dan zat apa penyebabnya?\n4. Coba tulis sendiri: bahan + energi → hasil.\n\nKalau sudah, balas dengan jawabanmu, atau ganti ke mode Penjelasan sederhana untuk mencocokkan.",
  },
  {
    title: "Teorema Pythagoras",
    match: /pythagoras|phytagoras|pitagoras|sisi miring/,
    simple: "Pada segitiga siku-siku, kuadrat sisi miring sama dengan jumlah kuadrat dua sisi lainnya.\n\nRumus: a² + b² = c², dengan c adalah sisi miring (sisi terpanjang, di depan sudut siku-siku).\n\nContoh: sisi 3 dan 4 → c² = 9 + 16 = 25 → c = 5.",
    deep: "Teorema Pythagoras hanya berlaku untuk segitiga siku-siku: a² + b² = c².\n\n- Kebalikannya juga benar: jika a² + b² = c², segitiganya siku-siku.\n- Tripel Pythagoras yang sering muncul: 3-4-5, 5-12-13, 8-15-17.\n- Kegunaan: menghitung jarak diagonal, tinggi tiang, atau panjang tangga.\n- Ada banyak cara membuktikannya, salah satunya dengan membandingkan luas persegi.",
    steps: "Coba langkah ini:\n\n1. Gambar segitiga siku-siku. Mana sisi yang paling panjang, dan di mana posisinya?\n2. Jika kedua sisi pendeknya 6 dan 8, berapa kuadrat masing-masing?\n3. Jumlahkan kedua kuadrat itu. Itu sama dengan kuadrat sisi yang mana?\n4. Ambil akar kuadratnya. Berapa panjang sisi miringnya?\n\nBalas dengan jawabanmu, nanti kita cocokkan.",
  },
  {
    title: "Alamat IP",
    match: /alamat ip|ip address|ipv4|ipv6|subnet/,
    simple: "Alamat IP adalah \"alamat rumah\" untuk perangkat di sebuah jaringan, supaya data tahu harus dikirim ke mana.\n\nContoh IPv4: 192.168.1.10. Terdiri dari 4 angka yang masing-masing bernilai 0 sampai 255, dipisah titik.",
    deep: "IPv4 memakai 32 bit, ditulis sebagai 4 oktet (masing-masing 8 bit, nilai 0 sampai 255).\n\n- Subnet mask menentukan bagian network dan bagian host. Contoh 192.168.1.10/24: network 192.168.1.0, host 192.168.1.1 sampai .254, dan .255 adalah alamat broadcast.\n- Alamat privat: 10.0.0.0/8, 172.16.0.0/12, dan 192.168.0.0/16. Alamat ini tidak dipakai langsung di internet, melainkan lewat NAT.\n- DHCP memberi alamat IP otomatis ke perangkat.\n- IPv6 memakai 128 bit karena alamat IPv4 hampir habis.",
    steps: "Coba jawab satu per satu:\n\n1. Kenapa setiap perangkat di jaringan perlu identitas yang unik?\n2. Satu angka dalam IPv4 terdiri dari 8 bit. Berapa nilai terbesar yang bisa dibuat dengan 8 bit?\n3. Pada 192.168.1.10/24, angka /24 berarti berapa bit pertama untuk bagian network?\n4. Dari situ, berapa oktet yang jadi bagian network?\n\nBalas dengan jawabanmu.",
  },
  {
    title: "Hukum Newton",
    match: /newton|hukum gerak/,
    simple: "Tiga hukum gerak Newton:\n\n1. Hukum I: benda diam tetap diam, dan benda bergerak lurus beraturan tetap begitu, kecuali ada gaya yang bekerja.\n2. Hukum II: F = m × a. Makin besar gaya, makin besar percepatan. Makin berat bendanya, makin kecil percepatannya.\n3. Hukum III: jika benda A mendorong benda B, benda B mendorong A dengan gaya sama besar dan arah berlawanan.",
    deep: "- Hukum I (kelembaman) berlaku di kerangka acuan inersia. Jika resultan gaya nol, kecepatan benda tetap.\n- Hukum II: resultan gaya = massa × percepatan (ΣF = m·a). Satuan gaya newton, 1 N = 1 kg·m/s².\n- Hukum III: gaya aksi dan reaksi sama besar, berlawanan arah, dan bekerja pada dua benda yang berbeda. Karena itu keduanya tidak saling meniadakan.\n\nContoh: benda 2 kg didorong dengan gaya total 10 N, maka percepatannya 10 / 2 = 5 m/s².",
    steps: "Coba pikirkan:\n\n1. Kenapa penumpang terdorong ke depan saat mobil mengerem mendadak? Hukum mana yang berperan?\n2. Jika kamu mendorong lemari dan lemari tidak bergerak, apa yang terjadi pada gaya-gayanya?\n3. Benda 2 kg didorong gaya total 10 N. Rumus apa yang kamu pakai, dan berapa percepatannya?\n\nBalas dengan jawabanmu.",
  },
  {
    title: "Model OSI",
    match: /\bosi\b|7 lapis|tujuh lapis/,
    simple: "Model OSI membagi proses komunikasi data di jaringan menjadi 7 lapisan, dari atas ke bawah:\n\n7. Application\n6. Presentation\n5. Session\n4. Transport\n3. Network\n2. Data Link\n1. Physical\n\nSetiap lapisan punya tugas sendiri supaya jaringan lebih mudah dipahami dan diperbaiki.",
    deep: "- Physical: sinyal dan media (kabel, radio).\n- Data Link: pengiriman antar perangkat yang terhubung langsung, memakai alamat MAC (contoh: Ethernet).\n- Network: pengalamatan dan pemilihan jalur antarjaringan (contoh: IP, router).\n- Transport: pengiriman antar aplikasi, ada yang andal (TCP) dan ada yang cepat (UDP).\n- Session, Presentation, Application: pengelolaan sesi, format dan enkripsi data, serta layanan untuk aplikasi (contoh: HTTP, DNS).\n\nSaat data dikirim, tiap lapisan menambahkan header (enkapsulasi). OSI adalah model acuan. Internet sendiri memakai model TCP/IP yang lebih ringkas, yaitu 4 lapis.",
    steps: "Coba satu per satu:\n\n1. Kalau kamu membuka sebuah website, lapisan mana yang paling dekat dengan aplikasi browser?\n2. Router bekerja dengan alamat apa, dan di lapisan mana?\n3. Switch bekerja dengan alamat MAC. Itu lapisan nomor berapa?\n4. Urutkan ketujuh lapisan dari bawah ke atas. Ada trik singkatan yang kamu tahu?\n\nBalas dengan jawabanmu.",
  },
];

export const DEMO_TOPIC_TITLES = DEMO_TOPICS.map((t) => t.title);

export function demoReply(text, mode) {
  const q = String(text).toLowerCase();
  const topic = DEMO_TOPICS.find((t) => t.match.test(q));
  if (!topic) {
    return `Mode demo hanya punya jawaban contoh untuk beberapa topik: ${DEMO_TOPIC_TITLES.join(", ")}.\n\nPertanyaanmu belum ada di daftar itu. Untuk menjawab pertanyaan bebas, aplikasi perlu dijalankan dengan server AI (lihat README), atau coba salah satu topik di atas.\n\n${DEMO_NOTE}`;
  }
  return `**${topic.title}**\n\n${topic[mode] ?? topic.simple}\n\n${DEMO_NOTE}`;
}

/* ---------- Format teks aman (escape dulu, baru ubah jadi HTML) ---------- */
function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
}

function blocks(text) {
  let html = "";
  let list = null; // "ul" | "ol"
  let para = [];
  const flushPara = () => { if (para.length) { html += `<p>${para.join("<br>")}</p>`; para = []; } };
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };

  for (const line of text.split("\n")) {
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      if (list !== kind) { closeList(); html += `<${kind}>`; list = kind; }
      html += `<li>${inline((ul || ol)[1])}</li>`;
    } else if (!line.trim()) {
      flushPara();
      closeList();
    } else {
      closeList();
      para.push(inline(line));
    }
  }
  flushPara();
  closeList();
  return html;
}

export function formatText(raw) {
  return String(raw ?? "")
    .split("```")
    .map((part, i) => (i % 2 === 1 ? `<pre><code>${escapeHtml(part.replace(/^[a-zA-Z0-9+#-]*\n/, "").replace(/\n$/, ""))}</code></pre>` : blocks(part)))
    .join("");
}
