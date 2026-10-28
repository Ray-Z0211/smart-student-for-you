import * as store from "./store.js";
import { postJson } from "./api.js";
import { keyTerms, splitSentences, validateInput } from "./notes-engine.js";

const MAX_RESULTS = 30;

/* ---------- Kuis contoh (tetap, BUKAN buatan AI). answer = indeks opsi yang benar ---------- */
export const SAMPLES = [
  {
    id: "fotosintesis",
    title: "Fotosintesis",
    questions: [
      { question: "Organel tempat fotosintesis berlangsung adalah…", options: ["Mitokondria", "Kloroplas", "Ribosom", "Nukleus"], answer: 1, explanation: "Kloroplas mengandung klorofil yang menyerap cahaya untuk fotosintesis.", topic: "Organel fotosintesis" },
      { question: "Gas yang dilepaskan sebagai hasil fotosintesis adalah…", options: ["Karbon dioksida", "Nitrogen", "Oksigen", "Hidrogen"], answer: 2, explanation: "Fotosintesis menghasilkan glukosa dan melepaskan oksigen.", topic: "Hasil fotosintesis" },
      { question: "Zat hijau daun yang menyerap cahaya matahari disebut…", options: ["Klorofil", "Stomata", "Xilem", "Amilum"], answer: 0, explanation: "Klorofil adalah pigmen hijau yang menyerap cahaya.", topic: "Klorofil" },
      { question: "Bahan yang diperlukan tumbuhan untuk fotosintesis adalah…", options: ["Air dan karbon dioksida", "Oksigen dan glukosa", "Air dan oksigen", "Glukosa dan karbon dioksida"], answer: 0, explanation: "Bahannya air, karbon dioksida, dan energi cahaya. Hasilnya glukosa dan oksigen.", topic: "Bahan fotosintesis" },
      { question: "Reaksi terang pada fotosintesis berlangsung di…", options: ["Stroma", "Tilakoid", "Sitoplasma", "Membran sel"], answer: 1, explanation: "Reaksi terang terjadi di tilakoid. Reaksi gelap (siklus Calvin) terjadi di stroma.", topic: "Tahapan fotosintesis" },
    ],
  },
  {
    id: "jaringan",
    title: "Alamat IP dan Jaringan Dasar",
    questions: [
      { question: "Alamat IPv4 terdiri dari berapa bit?", options: ["8 bit", "16 bit", "32 bit", "128 bit"], answer: 2, explanation: "IPv4 berukuran 32 bit, ditulis sebagai 4 oktet. IPv6 berukuran 128 bit.", topic: "Ukuran alamat IPv4" },
      { question: "Nilai terbesar pada satu oktet alamat IPv4 adalah…", options: ["100", "255", "256", "999"], answer: 1, explanation: "Satu oktet adalah 8 bit, jadi nilainya 0 sampai 255.", topic: "Oktet IPv4" },
      { question: "Perangkat yang meneruskan paket data antarjaringan yang berbeda adalah…", options: ["Router", "Hub", "Repeater", "Kabel UTP"], answer: 0, explanation: "Router bekerja di lapisan Network dan memilih jalur antarjaringan.", topic: "Fungsi router" },
      { question: "Protokol yang memberikan alamat IP otomatis kepada perangkat adalah…", options: ["DNS", "FTP", "DHCP", "SMTP"], answer: 2, explanation: "DHCP membagikan alamat IP, subnet mask, dan gateway secara otomatis.", topic: "DHCP" },
      { question: "Layanan yang menerjemahkan nama domain menjadi alamat IP adalah…", options: ["DHCP", "DNS", "HTTP", "NAT"], answer: 1, explanation: "DNS menerjemahkan nama seperti contoh.com menjadi alamat IP.", topic: "DNS" },
    ],
  },
  {
    id: "newton",
    title: "Hukum Newton",
    questions: [
      { question: "Hukum I Newton juga disebut hukum…", options: ["Aksi-reaksi", "Gravitasi", "Kelembaman (inersia)", "Percepatan"], answer: 2, explanation: "Benda cenderung mempertahankan keadaannya jika tidak ada gaya yang bekerja.", topic: "Hukum I Newton" },
      { question: "Rumus Hukum II Newton adalah…", options: ["F = m + a", "F = m × a", "F = m / a", "F = a / m"], answer: 1, explanation: "Gaya sama dengan massa dikali percepatan.", topic: "Hukum II Newton" },
      { question: "Benda 2 kg diberi gaya total 10 N. Percepatannya adalah…", options: ["20 m/s²", "0,2 m/s²", "5 m/s²", "12 m/s²"], answer: 2, explanation: "a = F / m = 10 / 2 = 5 m/s².", topic: "Menghitung percepatan" },
      { question: "Gaya aksi dan reaksi bekerja pada…", options: ["Satu benda yang sama", "Dua benda yang berbeda", "Benda yang diam saja", "Benda yang bergerak saja"], answer: 1, explanation: "Aksi dan reaksi bekerja pada dua benda berbeda, jadi tidak saling meniadakan.", topic: "Hukum III Newton" },
      { question: "Satuan gaya dalam SI adalah…", options: ["Joule", "Watt", "Pascal", "Newton"], answer: 3, explanation: "Satuan gaya adalah newton (N), yaitu kg·m/s².", topic: "Satuan gaya" },
    ],
  },
];

/* ---------- Pembantu ---------- */
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function containsWord(haystackLower, termLower) {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(termLower)}($|[^\\p{L}\\p{N}])`, "u").test(haystackLower);
}

// Mengacak urutan opsi (indeks jawaban ikut disesuaikan)
export function shuffleQuiz(quiz) {
  return {
    ...quiz,
    questions: quiz.questions.map((q) => {
      const order = shuffle(q.options.map((_, i) => i));
      return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
    }),
  };
}

export function sampleQuiz(id) {
  const s = SAMPLES.find((x) => x.id === id);
  return s ? shuffleQuiz({ title: s.title, source: "sample", questions: s.questions }) : null;
}

// Memeriksa bentuk kuis (dari AI atau sumber lain) agar aman dipakai
export function normalizeQuiz(raw, source) {
  if (!raw || !Array.isArray(raw.questions)) return null;
  const questions = [];
  for (const q of raw.questions) {
    if (!q || typeof q.question !== "string" || !Array.isArray(q.options) || q.options.length !== 4) continue;
    if (!q.options.every((o) => typeof o === "string" && o.trim())) continue;
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) continue;
    questions.push({
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()),
      answer: q.answer,
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
      topic: typeof q.topic === "string" && q.topic.trim() ? q.topic.trim() : q.question.trim().slice(0, 60),
    });
  }
  if (questions.length < 2) return null;
  return { title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Kuis", source, questions };
}

/* ---------- Soal otomatis tanpa AI: isian rumpang dari materimu ---------- */
export function generateLocal(text, count = 5) {
  const err = validateInput(text);
  if (err) return { ok: false, error: err };

  const terms = keyTerms(text, 16).map((t) => t.term);
  if (terms.length < 4) return { ok: false, error: "Materi belum cukup beragam untuk dibuat soal. Tambahkan lebih banyak kalimat." };

  const sentences = splitSentences(text).filter((s) => s.length >= 40 && s.length <= 240);
  const used = new Set();
  const questions = [];

  for (const s of shuffle(sentences)) {
    if (questions.length >= count) break;
    const lower = s.toLowerCase();
    const term = terms.find((t) => !used.has(t) && containsWord(lower, t.toLowerCase()));
    if (!term) continue;
    // pengecoh: istilah lain yang TIDAK muncul di kalimat itu, agar tidak ambigu
    const distractors = shuffle(terms.filter((t) => t !== term && !lower.includes(t.toLowerCase()))).slice(0, 3);
    if (distractors.length < 3) continue;

    used.add(term);
    const blanked = s.replace(new RegExp(escapeRegex(term), "i"), "_____");
    const options = shuffle([term, ...distractors]);
    questions.push({
      question: `Lengkapi kalimat berikut:\n“${blanked}”`,
      options,
      answer: options.indexOf(term),
      explanation: `Kalimat lengkap dari materimu: “${s}”`,
      topic: `Istilah: ${term}`,
    });
  }

  if (questions.length < 2) return { ok: false, error: "Soal yang bisa dibuat terlalu sedikit. Coba materi yang lebih panjang atau lebih beragam." };
  return { ok: true, quiz: { title: "Kuis dari materimu", source: "auto", questions }, requested: count };
}

/* ---------- Soal dengan AI (lewat server) ---------- */
export async function generateAI(text, level, count = 5) {
  const err = validateInput(text);
  if (err) throw new Error(err);
  const data = await postJson("api/quiz", { text, level, count });
  const quiz = normalizeQuiz(data, "ai");
  if (!quiz) throw new Error("AI memberi soal yang tidak sesuai format. Coba ulangi.");
  return quiz;
}

/* ---------- Penilaian ---------- */
export function grade(quiz, answers) {
  const items = quiz.questions.map((q, i) => ({ q, chosen: answers[i], ok: answers[i] === q.answer }));
  const correct = items.filter((x) => x.ok).length;
  const total = items.length;
  const weak = [...new Set(items.filter((x) => !x.ok).map((x) => x.q.topic))];
  return { correct, total, pct: total ? Math.round((correct / total) * 100) : 0, items, weak };
}

/* ---------- Riwayat hasil kuis ---------- */
export function newAttemptId() {
  return `qz_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function loadResults() {
  const raw = store.get(store.KEYS.QUIZZES, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((r) => r && typeof r.id === "string" && Number.isInteger(r.correct) && Number.isInteger(r.total));
}

export function saveResult({ id, title, source, correct, total, weak }) {
  const list = loadResults();
  list.unshift({ id, title, source, correct, total, weak: weak.slice(0, 10), ts: new Date().toISOString() });
  return store.set(store.KEYS.QUIZZES, list.slice(0, MAX_RESULTS));
}
