# RITASI APP - Release Package

## Cara Menggunakan:

1. Double-click: backend/start.bat
2. Browser akan terbuka otomatis ke http://localhost:3000
3. Aplikasi siap digunakan!

## Konfigurasi Database:

Edit file: backend/.env
Isi password database Anda di baris:
DB_PASSWORD=YOUR_PASSWORD_HERE

## Persyaratan:

- Windows 7/8/10/11 (64-bit)
- Koneksi internet (untuk akses database TiDB Cloud)
- Port 3000 harus tersedia

## Troubleshooting:

### Port 3000 sudah dipakai:
Edit backend/.env, ubah PORT=3000 ke PORT=3001 (atau port lain)

### Database connection error:
1. Cek koneksi internet
2. Pastikan password di .env sudah benar
3. Cek apakah IP Anda di-whitelist di TiDB Cloud

### Browser tidak terbuka otomatis:
Buka manual: http://localhost:3000

## Menutup Aplikasi:

Tekan Ctrl+C di console window, atau tutup window-nya.

## Support:

Hubungi admin jika ada masalah.
