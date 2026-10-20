from .ops import analyze, convert, pages, secure

PDF = [".pdf"]
IMAGES = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]

PAGES_OPT = dict(name="pages", label="Halaman (kosongkan untuk semua)", type="text", placeholder="contoh: 1-3,5")


def select(name, label, choices, default=None):
    return dict(name=name, label=label, type="select", choices=choices, default=default or choices[0][0])


def number(name, label, default, min, max, step=1):
    return dict(name=name, label=label, type="number", default=default, min=min, max=max, step=step)


def tool(id, name, desc, category, icon, fn, accept=PDF, multi=False, options=(), ui=None, slots=None):
    # Single-file tools without a page picker can also run on many files at once (results come back as a ZIP).
    batch = not multi and not slots and not ui
    return dict(id=id, name=name, desc=desc, short=SHORT[id], category=category, icon=icon, fn=fn, accept=accept,
                multi=multi, batch=batch, options=list(options), ui=ui, slots=slots)


# One-line summaries for tool cards and lists; `desc` is the full text on the tool page.
SHORT = {
    "bandingkan": "Temukan perbedaan dua versi PDF",
    "word-ke-pdf": "DOC atau DOCX ke PDF, tata letak tetap",
    "excel-ke-pdf": "XLS atau XLSX ke PDF tanpa kolom terpotong",
    "gambar-ke-pdf": "JPG, PNG, atau HEIC jadi satu PDF",
    "ppt-ke-pdf": "Slide PPT atau PPTX ke PDF",
    "scan-ke-pdf": "Foto dokumen jadi hasil scan rapi",
    "pdf-ke-word": "PDF jadi DOCX yang bisa diedit",
    "pdf-ke-ppt": "Setiap halaman jadi slide PPTX",
    "pdf-ke-excel": "Ambil tabel ke XLSX",
    "pdf-ke-gambar": "Halaman PDF jadi JPG atau PNG",
    "pdf-ke-markdown": "PDF jadi teks Markdown",
    "pdf-ke-pdfa": "Format arsip untuk repositori",
    "gabung": "Satukan beberapa PDF",
    "pisah": "Pecah per rentang atau per halaman",
    "putar": "Putar 90°, 180°, atau 270°",
    "atur": "Susun ulang, hapus, atau sisipkan halaman",
    "crop": "Potong area halaman",
    "nomor-halaman": "Tambah nomor di tiap halaman",
    "watermark": "Stempel teks atau gambar",
    "kompres": "Perkecil ukuran berkas",
    "ocr": "Jadikan teks hasil scan bisa dicari",
    "proteksi": "Kunci dengan kata sandi",
    "buka-kunci": "Hapus kata sandi PDF",
    "tanda-tangan": "Tempel gambar tanda tangan",
    "sensor": "Hitamkan data pribadi secara permanen",
    "metadata": "Ubah judul, penulis, dan kata kunci",
    "flatten": "Kunci isian formulir dan anotasi",
    "html-ke-pdf": "Halaman HTML ke PDF",
    "ekstrak-gambar": "Ambil semua gambar dalam PDF",
    "pdf-ke-teks": "Ambil teks polos (.txt)",
    "hapus-halaman": "Buang halaman tertentu",
    "cetak-hemat": "2 atau 4 halaman per lembar",
    "ukuran-kertas": "Ubah ke A4, F4, Letter, dan lainnya",
    "hitam-putih": "Jadikan abu-abu, hemat tinta",
    "perbaiki": "Pulihkan PDF yang rusak",
    "cek-format": "Periksa margin, kertas, dan huruf",
    "isi-formulir": "Isi formulir PDF lalu unduh",
}


CATEGORIES = ["Konversi ke PDF", "Konversi dari PDF", "Halaman", "Optimasi & Analisis", "Keamanan & Formulir"]
SIZES = [("a4", "A4"), ("f4", "F4 / Folio"), ("letter", "Letter"), ("a3", "A3"), ("a5", "A5")]

TOOLS = {t["id"]: t for t in [
    tool("bandingkan", "Bandingkan PDF", "Membandingkan dua versi PDF dan menandai teks yang ditambah, "
         "dihapus, atau diubah. Mode visual menandai perbedaan tampilan, cocok untuk hasil scan dan gambar.",
         "Optimasi & Analisis", "git-compare", analyze.compare, slots=["PDF versi lama", "PDF versi baru"],
         options=[select("mode", "Bandingkan", [("text", "Teks"), ("visual", "Tampilan (visual)")])]),

    tool("word-ke-pdf", "Word ke PDF", "Ubah dokumen Word (.doc atau .docx) menjadi PDF dengan tata letak "
         "yang sama.", "Konversi ke PDF", "file-text", convert.office_to_pdf, accept=[".doc", ".docx", ".odt", ".rtf"]),
    tool("excel-ke-pdf", "Excel ke PDF", "Ubah berkas Excel (.xls atau .xlsx) menjadi PDF tanpa kolom "
         "terpotong.", "Konversi ke PDF", "file-spreadsheet", convert.excel_to_pdf,
         accept=[".xls", ".xlsx", ".ods", ".csv"], options=[
             select("layout", "Tata letak", [("fit", "Satu halaman per lembar kerja (kolom tidak terpotong)"),
                                             ("original", "Ikuti pengaturan cetak berkas")]),
             dict(name="sheets", label="Lembar kerja (kosongkan untuk semua)", type="text",
                  placeholder="contoh: 1,3", show_if="layout=fit")]),
    tool("gambar-ke-pdf", "Gambar ke PDF", "Gabungkan foto atau hasil scan (JPG, PNG, WebP, HEIC) menjadi "
         "satu PDF. Atur urutan, ukuran halaman, orientasi, dan margin.", "Konversi ke PDF", "image",
         convert.images_to_pdf, accept=IMAGES, multi=True, options=[
             select("size", "Ukuran halaman", [("a4", "A4"), ("f4", "F4 / Folio"), ("letter", "Letter"),
                                               ("fit", "Sesuai gambar")]),
             select("orientation", "Orientasi", [("auto", "Otomatis"), ("portrait", "Potret"),
                                                 ("landscape", "Lanskap")]),
             number("margin", "Margin (mm)", 10, 0, 50)]),
    tool("ppt-ke-pdf", "PowerPoint ke PDF", "Ubah presentasi PowerPoint (.ppt atau .pptx) menjadi PDF, satu "
         "halaman per slide.", "Konversi ke PDF", "presentation", convert.office_to_pdf,
         accept=[".ppt", ".pptx", ".odp"]),
    tool("scan-ke-pdf", "Scan ke PDF", "Mengubah foto halaman kertas menjadi PDF yang rapi seperti hasil "
         "scanner.", "Konversi ke PDF", "scan", convert.scan_to_pdf, accept=IMAGES, multi=True, options=[
             select("mode", "Warna", [("color", "Berwarna"), ("gray", "Abu-abu"), ("bw", "Hitam putih (teks)")])]),
    tool("html-ke-pdf", "HTML ke PDF", "Ubah berkas halaman web (.html) menjadi PDF. Gambar dari internet tidak "
         "ikut dimuat.", "Konversi ke PDF", "code", convert.html_to_pdf, accept=[".html", ".htm"], options=[
             select("size", "Ukuran halaman", SIZES[:3]),
             number("margin", "Margin (mm)", 15, 0, 50)]),

    tool("pdf-ke-word", "PDF ke Word", "Mengubah PDF menjadi dokumen Word (.docx) yang dapat diedit.",
         "Konversi dari PDF", "file-text", convert.pdf_to_word),
    tool("pdf-ke-ppt", "PDF ke PowerPoint", "Mengubah setiap halaman PDF menjadi slide PowerPoint (.pptx).",
         "Konversi dari PDF", "presentation", convert.pdf_to_pptx, options=[
             select("dpi", "Kualitas", [("150", "Standar"), ("220", "Tinggi")])]),
    tool("pdf-ke-excel", "PDF ke Excel", "Mengubah tabel yang terdeteksi pada PDF menjadi worksheet Excel "
         "(.xlsx).", "Konversi dari PDF", "file-spreadsheet", convert.pdf_to_excel),
    tool("pdf-ke-gambar", "PDF ke JPG", "Mengubah setiap halaman PDF menjadi gambar JPG atau PNG.",
         "Konversi dari PDF", "image", convert.pdf_to_images, options=[
             select("fmt", "Format", [("jpg", "JPG"), ("png", "PNG")]),
             select("dpi", "Resolusi", [("150", "150 dpi (standar)"), ("72", "72 dpi (kecil)"),
                                        ("300", "300 dpi (cetak)")]),
             PAGES_OPT]),
    tool("pdf-ke-markdown", "PDF ke Markdown", "Mengubah PDF menjadi berkas Markdown (.md) dengan struktur "
         "yang mirip.", "Konversi dari PDF", "file-code", convert.pdf_to_markdown),
    tool("pdf-ke-pdfa", "PDF ke PDF/A", "Mengubah PDF ke format arsip PDF/A untuk penyimpanan jangka panjang "
         "dan unggahan repositori.", "Konversi dari PDF", "archive", convert.pdf_to_pdfa),
    tool("ekstrak-gambar", "Ekstrak Gambar", "Ambil semua gambar yang ada di dalam PDF dalam ukuran aslinya, "
         "diunduh sebagai ZIP.", "Konversi dari PDF", "images", convert.extract_images),
    tool("pdf-ke-teks", "PDF ke Teks", "Ambil seluruh teks PDF sebagai berkas teks polos (.txt), mudah ditempel "
         "ke catatan atau pengelola referensi.", "Konversi dari PDF", "file-type", convert.pdf_to_text),

    tool("gabung", "Gabung PDF", "Gabungkan beberapa berkas PDF menjadi satu dokumen sesuai urutan yang Anda "
         "tentukan.", "Halaman", "merge", pages.merge, multi=True),
    tool("pisah", "Pisah PDF", "Pisahkan PDF berdasarkan rentang halaman, setiap N halaman, atau ekstrak "
         "halaman terpilih menjadi satu berkas.", "Halaman", "scissors", pages.split, options=[
             select("mode", "Cara memisah", [("range", "Per rentang halaman"), ("every", "Setiap N halaman"),
                                             ("extract", "Ekstrak halaman terpilih ke satu berkas")]),
             dict(name="ranges", label="Rentang halaman", type="text", placeholder="contoh: 1-3,4-6,7",
                  show_if="mode!=every"),
             dict(number("every", "Jumlah halaman per berkas", 1, 1, 500), show_if="mode=every")]),
    tool("putar", "Putar PDF", "Putar semua halaman atau halaman tertentu sebesar 90°, 180°, atau 270° tanpa "
         "mengubah isi halaman.", "Halaman", "rotate-cw", pages.rotate, options=[
             select("angle", "Putar", [("90", "90° searah jarum jam"), ("180", "180°"),
                                       ("270", "90° berlawanan arah jarum jam")]),
             PAGES_OPT]),
    tool("hapus-halaman", "Hapus Halaman", "Buang halaman tertentu dari PDF berdasarkan nomornya.", "Halaman",
         "file-minus", pages.delete_pages, options=[
             dict(name="pages", label="Halaman yang dihapus", type="text", placeholder="contoh: 2,5-7")]),
    tool("cetak-hemat", "Cetak Hemat", "Susun 2 atau 4 halaman dalam satu lembar, cocok untuk mencetak slide "
         "kuliah sebagai handout.", "Halaman", "columns-2", pages.nup, options=[
             select("per", "Halaman per lembar", [("2", "2 (berdampingan)"), ("4", "4 (2 × 2)")]),
             select("size", "Ukuran kertas", SIZES[:3])]),
    tool("ukuran-kertas", "Ukuran Kertas", "Ubah ukuran semua halaman ke A4, F4, Letter, A3, atau A5. Isi "
         "diperbesar atau diperkecil agar pas.", "Halaman", "expand", pages.resize, options=[
             select("size", "Ukuran kertas", SIZES)]),
    tool("atur", "Atur Halaman PDF", "Susun ulang, hapus, gandakan, putar, sisipkan halaman kosong atau "
         "halaman dari berkas lain.", "Halaman", "layout-grid", pages.organize, ui="organize"),
    tool("crop", "Crop PDF", "Pilih area pada halaman lalu crop satu halaman atau semua halaman. Area di luar "
         "crop hanya disembunyikan.", "Halaman", "crop", pages.crop, ui="area", options=[
             select("scope", "Terapkan ke", [("all", "Semua halaman"), ("page", "Halaman ini saja")])]),
    tool("nomor-halaman", "Nomor Halaman", "Tambahkan nomor halaman dengan format, posisi, dan ukuran pilihan "
         "ke semua halaman atau sebagian halaman.", "Halaman", "hash", pages.page_numbers, options=[
             select("fmt", "Format", [("{n}", "1"), ("{n} / {total}", "1 / 10"), ("Halaman {n}", "Halaman 1"),
                                      ("- {n} -", "- 1 -")]),
             select("position", "Posisi", [("bottom-center", "Bawah tengah"), ("bottom-right", "Bawah kanan"),
                                           ("bottom-left", "Bawah kiri"), ("top-center", "Atas tengah"),
                                           ("top-right", "Atas kanan"), ("top-left", "Atas kiri")]),
             number("size", "Ukuran huruf", 11, 6, 36),
             number("start", "Mulai dari nomor", 1, 0, 9999),
             PAGES_OPT]),
    tool("watermark", "Watermark PDF", "Tambahkan watermark teks atau gambar dengan ukuran, rotasi, dan "
         "transparansi pilihan.", "Halaman", "stamp", pages.watermark, options=[
             dict(name="text", label="Teks watermark", type="text", placeholder="contoh: RAHASIA"),
             dict(name="image", label="Atau gambar watermark", type="file", accept=".png,.jpg,.jpeg"),
             number("size", "Ukuran", 48, 8, 200),
             number("opacity", "Transparansi", 0.3, 0.05, 1, 0.05),
             number("angle", "Rotasi teks (°)", 45, -180, 180),
             PAGES_OPT]),

    tool("kompres", "Kompres PDF", "Perkecil ukuran berkas PDF agar mudah diunggah atau dikirim.",
         "Optimasi & Analisis", "file-down", secure.compress, options=[
             select("level", "Tingkat kompresi", [("medium", "Sedang (disarankan)"),
                                                  ("low", "Rendah (kualitas tinggi)"), ("high", "Tinggi (berkas terkecil)")])]),
    tool("ocr", "OCR PDF", "Kenali teks pada PDF hasil scan agar bisa dicari dan disalin.",
         "Optimasi & Analisis", "scan-text", secure.ocr, options=[
             select("lang", "Bahasa dokumen", [("ind+eng", "Indonesia + Inggris"), ("ind", "Indonesia"),
                                               ("eng", "Inggris")])]),
    tool("hitam-putih", "PDF Hitam Putih", "Ubah semua warna menjadi abu-abu agar hemat tinta saat dicetak.",
         "Optimasi & Analisis", "contrast", secure.grayscale),
    tool("perbaiki", "Perbaiki PDF", "Pulihkan PDF yang rusak atau tidak bisa dibuka.", "Optimasi & Analisis",
         "wrench", secure.repair),
    tool("cek-format", "Cek Format Skripsi", "Periksa ukuran kertas, margin, dan huruf. Hasilnya PDF dengan "
         "garis margin dan tanda merah pada isi yang keluar batas. Sesuaikan margin dengan pedoman fakultas.",
         "Optimasi & Analisis", "graduation-cap", analyze.thesis_check, options=[
             number("top", "Margin atas (cm)", 4, 0, 10, 0.5), number("left", "Margin kiri (cm)", 4, 0, 10, 0.5),
             number("right", "Margin kanan (cm)", 3, 0, 10, 0.5),
             number("bottom", "Margin bawah (cm)", 3, 0, 10, 0.5)]),
    tool("proteksi", "Proteksi PDF", "Kunci PDF dengan kata sandi.", "Keamanan & Formulir","lock",
         secure.protect, options=[dict(name="password", label="Kata sandi", type="password")]),
    tool("buka-kunci", "Buka Kunci PDF", "Hapus kata sandi dari PDF yang kata sandinya Anda ketahui.",
         "Keamanan & Formulir","lock-open", secure.unlock,
         options=[dict(name="password", label="Kata sandi saat ini", type="password")]),
    tool("tanda-tangan", "Tanda Tangan PDF", "Tempelkan gambar tanda tangan pada posisi yang Anda pilih.",
         "Keamanan & Formulir","signature", secure.sign, ui="area",
         options=[dict(name="image", label="Gambar tanda tangan (PNG transparan disarankan)", type="file",
                       accept=".png,.jpg,.jpeg")]),
    tool("sensor", "Sensor PDF", "Hitamkan area berisi data pribadi. Teks di bawahnya dihapus permanen.",
         "Keamanan & Formulir","eye-off", secure.redact, ui="area-multi"),
    tool("metadata", "Edit Metadata", "Ubah judul, penulis, subjek, dan kata kunci dokumen PDF.",
         "Optimasi & Analisis", "tag", secure.metadata, options=[
             dict(name="title", label="Judul", type="text"), dict(name="author", label="Penulis", type="text"),
             dict(name="subject", label="Subjek", type="text"),
             dict(name="keywords", label="Kata kunci", type="text")]),
    tool("isi-formulir", "Isi Formulir", "Isi kolom formulir PDF langsung dari peramban, lalu unduh hasilnya.",
         "Keamanan & Formulir","text-cursor-input", secure.fill_form, ui="form", options=[
             select("flatten", "Setelah diisi", [("0", "Tetap bisa diedit"), ("1", "Kunci isian (flatten)")])]),
    tool("flatten", "Flatten PDF", "Ratakan isian formulir dan anotasi agar tidak dapat diubah lagi.",
         "Keamanan & Formulir","layers", secure.flatten),
]}
