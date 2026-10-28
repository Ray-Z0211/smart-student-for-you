# AI Smart Student Assistant

Aplikasi web (HTML, CSS, JavaScript murni) untuk jadwal, progres belajar, dan nantinya asisten AI.

## Cara menjalankan di VS Code

### A. Mode biasa (tanpa AI sungguhan), paling mudah
Aplikasi memakai ES Modules, jadi TIDAK bisa dibuka dengan klik dua kali `index.html` (file://).
1. Buka folder proyek ini di VS Code.
2. Pasang ekstensi **Live Server** (Ritwick Dey).
3. Klik kanan `index.html` lalu pilih **Open with Live Server**.
Halaman Belajar AI otomatis memakai **mode demo** (jawaban contoh, diberi label, bukan AI).

### B. Dengan AI sungguhan (butuh Python 3.8 ke atas dan API key)
Tidak perlu `pip install` apa pun, server memakai pustaka bawaan Python.
1. Cek Python di Terminal VS Code: `python --version` (di Windows bisa juga `py --version`).
   Kalau belum ada, pasang dari python.org dan centang "Add Python to PATH".
2. Salin `.env.example` menjadi `.env`, lalu isi `ANTHROPIC_API_KEY=` dengan kuncimu.
   JANGAN upload `.env` ke GitHub (sudah dicegah oleh `.gitignore`).
3. Di Terminal VS Code jalankan: `python server.py` (atau `py server.py`)
4. Buka `http://localhost:3000`. Badge di halaman Belajar AI berubah menjadi "AI aktif".
5. Berhenti dengan **Ctrl+C** di Terminal.
Kunci API hanya dibaca oleh `server.py` di server, tidak pernah dikirim ke browser.

Untuk membuka dari HP di Wi-Fi yang sama: jalankan `set HOST=0.0.0.0` (Windows CMD) lalu `python server.py`, dan buka `http://IP-PC:3000` di HP.

### Catatan hosting
- GitHub Pages hanya menyajikan file statis, jadi di sana halaman Belajar AI tetap mode demo.
- AI sungguhan butuh hosting yang bisa menjalankan Python (misalnya PythonAnywhere atau Render), dengan `ANTHROPIC_API_KEY` diisi di pengaturan environment variable hosting (bukan di kode).

## Status langkah
- Langkah 1: Kerangka, navigasi (sidebar, bottom nav, drawer), penyimpanan LocalStorage. Selesai.
- Langkah 2: Jadwal (tugas, kalender, pengingat, XP saat tugas selesai). Selesai.
- Langkah 3: Progres (XP, level, streak, grafik, target, pencapaian) dan Beranda berisi data nyata. Selesai, belum diuji di perangkat.
- Langkah 4: Karier (tes minat remaja 24 soal, 21 karier, jurusan, skill, roadmap). Selesai, belum diuji di perangkat.
- Langkah 5: Belajar AI (chat, 4 tingkat, 3 mode belajar, mode demo berlabel, backend Python opsional). Selesai, belum diuji di perangkat.
- Langkah 6: Catatan (rangkuman + istilah penting + simpan/salin) dan Kuis (soal dari materi, kuis contoh, nilai, pembahasan, XP). Selesai, belum diuji di perangkat.

## Struktur
- `index.html`
- `server.py`, `.env.example` (server AI opsional, Python)
- `css/` variables, base, layout, components, pages
- `js/` app, router, nav, store, ui, icons, dates, tasks, activity, reminders, stats, career-engine, chat-engine, notes-engine, quiz-engine, api
- `js/data/` career-data (pertanyaan dan daftar karier)
- `js/pages/` satu file per halaman

## Mode AI dan tanpa AI
| Halaman | Tanpa AI (Live Server) | Dengan AI (`python server.py` + kunci) |
|---|---|---|
| Belajar AI | Jawaban contoh untuk 5 topik, diberi label | Jawaban bebas lewat `/api/chat` |
| Catatan | Rangkuman otomatis: memilih kalimat penting dari frekuensi kata (bukan AI) | Rangkuman AI lewat `/api/notes` |
| Kuis | Soal isian rumpang otomatis dari materimu, atau kuis contoh | Soal pilihan ganda dari AI lewat `/api/quiz` |
Semua halaman memberi label jelas mana yang AI dan mana yang bukan.


## Publikasikan versi ZIP ini ke GitHub Pages

Penting: ekstrak ZIP sampai `index.html` berada langsung di folder utama repositori GitHub (root), bukan di dalam folder `smart-student/`.

Struktur yang benar:
- `index.html`
- `css/`
- `js/`
- `server.py`
- `README.md`

Jangan unggah folder pembungkus `smart-student/` sebagai satu tingkat tambahan, kecuali kamu memang mengatur GitHub Pages untuk menerbitkan folder tersebut.

1. Cadangkan versi lama repositori.
2. Ekstrak ZIP versi perbaikan di komputer.
3. Unggah/ganti isi repositori dengan isi folder proyek (file `index.html` harus sejajar dengan folder `css` dan `js`).
4. Pastikan GitHub Pages menerbitkan branch dan folder yang benar di Settings → Pages.
5. Tunggu proses deployment selesai, lalu buka `https://USERNAME.github.io/NAMA-REPOSITORI/`.
6. Muat ulang paksa dengan `Ctrl+Shift+R`.

GitHub Pages hanya menjalankan frontend statis. Halaman Belajar AI, Catatan, dan Kuis akan memakai mode demo/lokal di GitHub Pages; AI sungguhan memerlukan backend Python yang di-host terpisah.
