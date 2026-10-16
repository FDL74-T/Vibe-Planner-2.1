# 📅 VibePlanner - Python Web Calendar & Activity Planner

**VibePlanner** adalah aplikasi perencana kegiatan dan kalender bulanan interaktif berbasis web. Backend memakai pustaka bawaan Python (*Python Standard Library*), frontend bernuansa *Clean Teal Dashboard* dengan animasi hidup, dan siap dideploy ke **Vercel** maupun dijalankan lokal.

---

## ✨ Fitur Utama

**Perencanaan**
- Statistik total / selesai (persentase progres) / tertunda dengan angka beranimasi; klik kartu untuk memfilter.
- Tambah kegiatan dengan preset tanggal (Hari Ini, Besok, Lusa, Akhir Pekan), pemilih prioritas, dan penghitung karakter.
- Ceklis kegiatan (efek konfeti), hapus dengan tombol **Urungkan**, dan **edit judul** lewat klik 2x.
- Tabel dengan pencarian (kata cocok disorot), filter prioritas, **sortir kolom**, dan label *Terlambat / Hari ini / Besok*.

**Kalender**
- Grid bulanan berbahasa Indonesia dengan transisi geser antarbulan, penanda hari ini berdenyut, dan aksen warna prioritas.
- Klik tanggal untuk membuka **panel agenda harian** (bisa dicentang langsung) sekaligus mengisi tanggal di formulir.

**Terasa hidup**
- Latar gradasi bergerak, animasi masuk bertahap, spotlight mengikuti kursor, kartu statistik miring 3D, ripple pada tombol.
- Sapaan dinamis sesuai jam dan agenda hari ini, jam digital langsung.
- **Mode gelap** (mengikuti sistem, tersimpan di browser).
- Pintasan: `N` kegiatan baru • `/` cari • `←` `→` ganti bulan • `T` hari ini • `D` ganti tema.
- Menghormati pengaturan *reduced motion*.

**Penyimpanan**: data disimpan ke `localStorage` seketika, lalu disinkronkan ke backend (indikator *Menyimpan… / Tersimpan Otomatis / Tersimpan di Browser*). Aplikasi tetap berfungsi saat backend tidak tersedia.

## 🚀 Menjalankan Lokal

```bash
python api/index.py      # buka http://localhost:8000
```

## 🔌 Endpoint API

| Metode | Rute | Fungsi |
|--------|------|--------|
| GET | `/api/data?year=&month=` | Metrik, matriks kalender, dan daftar kegiatan |
| POST | `/api/sync` | Simpan daftar kegiatan (divalidasi di server) |
| GET | `/api/health` | Cek status server |

## 📁 Struktur Proyek

```
public/        index.html, style.css, script.js  (file statis)
api/index.py   backend Python (API + server lokal)
vercel.json    outputDirectory=public, rewrite /api/* ke api/index.py
```

## ☁️ Deploy ke Vercel
Impor repositori di Vercel tanpa mengubah pengaturan build (Framework Preset: *Other*). Halaman statis disajikan dari folder `public/`, sedangkan rute `/api/*` ditangani `api/index.py`. Penyimpanan server di Vercel bersifat sementara (`/tmp`); data utama tetap aman di browser pengguna.
