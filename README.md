# TelU PDF Hub

A free set of PDF tools for Telkom University students, modelled on IPB's `pdf.ipb.ac.id`. This is a student project. It is unofficial and not affiliated with Telkom University.

## Tools
- **Konversi ke PDF:** Word, Excel, PowerPoint, Gambar, Scan, HTML
- **Konversi dari PDF:** Word, PowerPoint, Excel, JPG/PNG, Markdown, PDF/A, Ekstrak Gambar, Teks
- **Halaman:** Gabung, Pisah, Putar, Hapus Halaman, Cetak Hemat (2/4 per lembar), Ukuran Kertas, Atur Halaman, Crop, Nomor Halaman, Watermark
- **Optimasi & Analisis:** Bandingkan (teks atau visual), Kompres, OCR, Hitam Putih, Perbaiki PDF, Cek Format Skripsi, Edit Metadata
- **Keamanan & Formulir:** Proteksi, Buka Kunci, Tanda Tangan, Sensor, Isi Formulir, Flatten

Every tool is one entry in `app/tools.py`. To add a tool, write `fn(files, out_dir, **options) -> Path` in `app/ops/` and register it there.

Other features:
- **Batch:** single-file tools accept up to 20 files and return a ZIP.
- **Chaining:** after a PDF result, "Lanjutkan dengan" opens it in another tool without downloading it first.
- **Theme:** light, dark, or follow the system.
- **Usage stats** at `/statistik`. These are anonymous daily counts per tool. Set `STATS_TOKEN` to make them private; the page is then opened as `/statistik?token=…`.

## Run (production)
```sh
DOMAIN=pdf.example.com docker compose up -d --build
```
Caddy fetches the HTTPS certificate automatically. Point the domain's DNS at the server first. Uploaded files and history are deleted after `JOB_TTL_SECONDS` (default 2 hours).

## Development
```sh
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt pytest httpx
.venv/Scripts/uvicorn app.main:app --reload    # API on :8000
cd web && npm install && npm run dev           # React UI on :5173 with hot reload, proxies the API
.venv/Scripts/pytest -q
```
`npm run build` writes `web/dist`, which the backend serves at :8000. The Docker image builds it automatically.

The frontend is React + Vite. It follows Apple's design conventions: grouped lists, a large title that collapses on scroll, a tab bar, bottom sheets, light/dark mode, and safe areas. It installs to the home screen as an app (PWA).
Office conversion, compression, grayscale, OCR and PDF/A need `soffice`, `gs`, `ocrmypdf` and `tesseract` on PATH. The Docker image includes them. Without them, their tests are skipped.

## Limits
- 50 MB per file, 20 files, 500 pages
- 30 jobs per 10 minutes per IP

## License note
PyMuPDF is AGPL-3.0. If you run this as a public service, publish the source code.
