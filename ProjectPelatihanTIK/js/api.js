// Pembantu untuk endpoint backend opsional.
// URL dibuat relatif terhadap root aplikasi, sehingga bekerja di root lokal
// maupun GitHub Pages yang berada di /nama-repositori/.
const APP_BASE_URL = new URL("../", import.meta.url);

export function apiUrl(path) {
  return new URL(String(path).replace(/^\\/+/, ""), APP_BASE_URL).toString();
}

export async function postJson(path, body, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "AI tidak dapat memproses permintaan saat ini.");
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("AI terlalu lama menjawab. Coba lagi.");
    if (error instanceof TypeError) throw new Error("Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
