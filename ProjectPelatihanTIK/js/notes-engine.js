import * as store from "./store.js";
import { postJson } from "./api.js";

export const MAX_TEXT = 8000;
export const MIN_TEXT = 60;
const MAX_NOTES = 50;

// Kata umum yang diabaikan saat mencari kata penting
const STOP = new Set((
  "yang dan di ke dari untuk pada dengan ini itu adalah atau dalam juga akan oleh sebagai karena agar dapat bisa tidak ada para saat " +
  "jika maka serta antara lebih sangat sudah telah masih hanya setiap suatu sebuah tersebut yaitu yakni ialah bahwa kita kami mereka dia " +
  "saya anda kamu seperti hingga sampai setelah sebelum ketika sehingga namun tetapi tapi apa bagaimana mengapa siapa dimana kapan nya " +
  "lah pun per bagi tentang terhadap secara atas bawah lain lainnya banyak beberapa semua saja pula kembali dll dsb melalui menjadi " +
  "merupakan memiliki mempunyai disebut digunakan dilakukan terdapat sering biasanya contoh misalnya yaitu bukan belum bila " +
  "terjadi berlangsung menghasilkan mengubah menggunakan membuat berupa terdiri sedangkan berfungsi berada bagian sendiri proses membantu " +
  "the and of to a in is are for on with as by that this it be or from at an"
).split(" "));

const WORD = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;

/* ---------- Pemisah kalimat ---------- */
export function splitSentences(text) {
  return String(text ?? "")
    .replace(/\r/g, "")
    .split(/\n+/)
    .flatMap((para) => para.trim().replace(/([.!?])\s+/g, "$1\u0001").split("\u0001"))
    .map((s) => s.replace(/^(?:[-*•]|\d+[.)])\s+/, "").replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 2);
}

const isContent = (w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w);
const tokens = (s) => s.match(WORD) ?? [];
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function defaultTitle(text) {
  const first = splitSentences(text)[0] ?? "Catatan";
  return clip(first.replace(/[.!?]+$/, ""), 50);
}

export function validateInput(text) {
  const t = String(text ?? "").trim();
  if (!t) return "Tempel materinya dulu.";
  if (t.length < MIN_TEXT) return `Materi terlalu pendek. Tulis minimal ${MIN_TEXT} karakter (sekitar 2 kalimat).`;
  if (t.length > MAX_TEXT) return `Materi terlalu panjang. Maksimal ${MAX_TEXT} karakter.`;
  return null;
}

/* ---------- Istilah penting (berdasarkan seberapa sering muncul) ---------- */
export function keyTerms(text, limit = 8) {
  const sentences = splitSentences(text);
  const info = new Map();  // kata -> { cap, orig }
  const counts = new Map(); // frasa huruf kecil -> { n, words:[...] }
  let totalWords = 0;

  const bump = (key, words) => {
    const item = counts.get(key) ?? { n: 0, words };
    item.n += 1;
    counts.set(key, item);
  };

  for (const s of sentences) {
    const raw = tokens(s);
    totalWords += raw.length;
    raw.forEach((w, i) => {
      const lw = w.toLowerCase();
      if (!isContent(lw)) return;
      const rec = info.get(lw) ?? { cap: false, orig: w };
      if ((i > 0 && /^\p{Lu}/u.test(w)) || /\p{Lu}.*\p{Lu}/u.test(w)) { rec.cap = true; rec.orig = w; }
      info.set(lw, rec);
      bump(lw, [lw]);
      const next = raw[i + 1]?.toLowerCase();
      if (next && isContent(next)) bump(`${lw} ${next}`, [lw, next]);
    });
  }

  const minCount = totalWords > 120 ? 2 : 1;
  const ranked = [...counts.entries()]
    .filter(([, v]) => v.n >= (v.words.length > 1 ? Math.max(2, minCount) : minCount))
    .map(([key, v]) => ({ key, ...v, score: v.n * (v.words.length > 1 ? 1.5 : 1) + key.length / 100 }))
    .sort((a, b) => b.score - a.score);

  const chosen = [];
  for (const c of ranked) {
    if (chosen.length >= limit) break;
    const covered = chosen.some((x) => x.words.length > 1 && c.words.length === 1 && x.words.includes(c.key));
    if (!covered) chosen.push(c);
  }

  const display = (lw) => { const r = info.get(lw); return r?.cap ? r.orig : lw; };
  return chosen.map((c) => {
    const term = c.words.map(display).join(" ");
    const note = sentences.find((s) => s.toLowerCase().includes(c.key)) ?? "";
    return { term, note: clip(note, 200), count: c.n };
  });
}

/* ---------- Rangkuman tanpa AI (memilih kalimat penting) ---------- */
export function summarizeLocal(text, maxPoints = 7) {
  const sents = splitSentences(text);
  const cand = sents
    .map((s, i) => ({ s, i, toks: tokens(s).map((w) => w.toLowerCase()).filter(isContent) }))
    .filter((x) => x.s.length >= 25 && x.toks.length >= 3);

  const freq = new Map();
  for (const c of cand) for (const t of c.toks) freq.set(t, (freq.get(t) ?? 0) + 1);

  const scored = cand.map((c) => {
    const uniq = [...new Set(c.toks)];
    const base = uniq.reduce((sum, t) => sum + freq.get(t), 0) / Math.sqrt(c.toks.length);
    return { ...c, score: c.i === 0 ? base * 1.25 : base };
  });

  const n = Math.min(scored.length, Math.max(3, Math.min(maxPoints, Math.round(scored.length / 3))));
  const points = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => clip(x.s, 280));

  return { points, terms: keyTerms(text, 8), ai: false };
}

/* ---------- Rangkuman dengan AI (lewat server) ---------- */
export async function askNotesAI(text, level) {
  const data = await postJson("api/notes", { text, level });
  const points = Array.isArray(data.points) ? data.points.filter((p) => typeof p === "string" && p.trim()).slice(0, 10) : [];
  const terms = (Array.isArray(data.concepts) ? data.concepts : [])
    .filter((c) => c && typeof c.term === "string" && typeof c.meaning === "string")
    .slice(0, 10)
    .map((c) => ({ term: c.term, note: c.meaning }));
  if (!points.length) throw new Error("AI memberi hasil yang kosong. Coba ulangi.");
  return { points, terms, ai: true };
}

/* ---------- Catatan tersimpan ---------- */
function newId() {
  return `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function loadNotes() {
  const raw = store.get(store.KEYS.NOTES, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((n) => n && typeof n.id === "string" && typeof n.title === "string" && Array.isArray(n.points));
}

export function addNote({ title, points, terms, source, ai }) {
  const list = loadNotes();
  const note = {
    id: newId(),
    title: clip(String(title || "").trim() || "Catatan tanpa judul", 80),
    points,
    terms,
    source: String(source ?? "").slice(0, MAX_TEXT),
    ai: Boolean(ai),
    ts: new Date().toISOString(),
  };
  list.unshift(note);
  const ok = store.set(store.KEYS.NOTES, list.slice(0, MAX_NOTES));
  return ok ? note : null;
}

export function deleteNote(id) {
  const list = loadNotes();
  const next = list.filter((n) => n.id !== id);
  if (next.length === list.length) return false;
  return store.set(store.KEYS.NOTES, next);
}

export function getNote(id) {
  return loadNotes().find((n) => n.id === id) ?? null;
}

// Teks siap salin / tempel
export function toPlainText({ title, points, terms, ai }) {
  const lines = [`${title}`, ai ? "(dirangkum oleh AI)" : "(dirangkum otomatis tanpa AI)", "", "Poin penting:"];
  points.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  if (terms.length) {
    lines.push("", "Istilah penting:");
    terms.forEach((t) => lines.push(`- ${t.term}${t.note ? `: ${t.note}` : ""}`));
  }
  return lines.join("\n");
}
