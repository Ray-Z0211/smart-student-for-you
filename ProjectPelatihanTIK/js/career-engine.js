import * as store from "./store.js";
import { CATEGORIES, QUESTIONS, CAREERS, TEST_VERSION } from "./data/career-data.js";

// ---------- Penyimpanan (jawaban disimpan setiap kali dijawab) ----------

export function loadState() {
  const raw = store.get(store.KEYS.CAREER, null);
  const answers = {};
  // Jawaban dari versi tes yang berbeda diabaikan, karena pertanyaannya sudah berubah
  if (raw && typeof raw === "object" && raw.version === TEST_VERSION && raw.answers && typeof raw.answers === "object") {
    for (const q of QUESTIONS) {
      const v = raw.answers[q.id];
      if (Number.isInteger(v) && v >= 0 && v <= 3) answers[q.id] = v;
    }
  }
  const complete = QUESTIONS.every((q) => q.id in answers);
  const completedAt = complete && typeof raw?.completedAt === "string" ? raw.completedAt : null;
  return { answers, completedAt };
}

function write(state) {
  return store.set(store.KEYS.CAREER, { version: TEST_VERSION, answers: state.answers, completedAt: state.completedAt });
}

export function saveAnswer(questionId, value) {
  if (!QUESTIONS.some((q) => q.id === questionId)) return false;
  if (!Number.isInteger(value) || value < 0 || value > 3) return false;
  const state = loadState();
  state.answers[questionId] = value;
  state.completedAt = null; // mengubah jawaban berarti hasil perlu dihitung ulang
  return write(state);
}

export function finishTest() {
  const state = loadState();
  if (!QUESTIONS.every((q) => q.id in state.answers)) return { ok: false };
  state.completedAt = new Date().toISOString();
  return { ok: write(state) };
}

export function resetTest() {
  store.remove(store.KEYS.CAREER);
}

export function firstUnanswered(answers) {
  const i = QUESTIONS.findIndex((q) => !(q.id in answers));
  return i === -1 ? QUESTIONS.length - 1 : i;
}

// ---------- Perhitungan ----------

// Skor tiap tipe minat 0-100 (rata-rata jawaban dibanding nilai maksimal).
export function categoryScores(answers) {
  const scores = {};
  for (const code of Object.keys(CATEGORIES)) {
    const qs = QUESTIONS.filter((q) => q.cat === code);
    const sum = qs.reduce((total, q) => total + (answers[q.id] ?? 0), 0);
    scores[code] = Math.round((sum / (qs.length * 3)) * 100);
  }
  return scores;
}

export function profileRanking(scores) {
  return Object.keys(CATEGORIES)
    .map((code) => ({ code, ...CATEGORIES[code], score: scores[code] }))
    .sort((a, b) => b.score - a.score);
}

function reasonFor(career, scores) {
  const keys = Object.entries(career.weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([code]) => ({ name: CATEGORIES[code].name, score: scores[code] }));
  const label = (k) => `${k.name} (${k.score}%)`;
  const strong = keys.filter((k) => k.score >= 60);
  const weak = keys.filter((k) => k.score < 60);

  if (!weak.length) {
    return `Profesi ini banyak memakai minat ${keys.map(label).join(" dan ")}, dan keduanya tinggi di jawabanmu.`;
  }
  if (strong.length) {
    return `Kamu kuat di ${strong.map(label).join(", ")}, tetapi ${weak.map(label).join(", ")} belum tinggi. Coba dulu lewat kegiatan kecil sebelum memutuskan.`;
  }
  return `Skormu di ${keys.map(label).join(" dan ")} belum tinggi, jadi kecocokan minatnya sedang. Coba lewat ekstrakurikuler atau proyek kecil sebelum memutuskan.`;
}

// Kecocokan = rata-rata skor minatmu, dibobot sesuai kebutuhan profesi.
// Ini kecocokan MINAT, bukan prediksi keberhasilan atau peluang diterima kerja.
export function careerMatches(scores) {
  return CAREERS.map((career) => {
    const entries = Object.entries(career.weights);
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    const weighted = entries.reduce((sum, [code, w]) => sum + w * scores[code], 0);
    return { career, match: Math.round(weighted / totalWeight), reason: reasonFor(career, scores) };
  }).sort((a, b) => b.match - a.match || a.career.title.localeCompare(b.career.title));
}

// Jurusan dari beberapa karier teratas, diurutkan dari kecocokan tertinggi.
export function recommendMajors(matches, careerCount = 6, limit = 5) {
  const map = new Map();
  for (const m of matches.slice(0, careerCount)) {
    for (const major of m.career.majors) {
      const item = map.get(major) ?? { major, score: m.match, careers: [] };
      item.score = Math.max(item.score, m.match);
      item.careers.push(m.career.title);
      map.set(major, item);
    }
  }
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
