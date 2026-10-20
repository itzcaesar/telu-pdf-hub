import io
from difflib import SequenceMatcher

import pymupdf

from . import UserError

RED, GREEN, YELLOW = (1, 0.3, 0.3), (0.3, 0.85, 0.4), (1, 0.85, 0.2)


def _words(doc):
    # (page index, rect, text) for every word, in reading order.
    return [(i, pymupdf.Rect(w[:4]), w[4]) for i, page in enumerate(doc)
            for w in page.get_text("words", sort=True)]


def _mark(doc, words, color):
    for p, rect, _ in words:
        page = doc[p]
        page.draw_rect(rect * page.rotation_matrix, color=None, fill=color, fill_opacity=0.35, overlay=True)


def compare(files, out, mode="text"):
    if len(files) != 2:
        raise UserError("Pilih tepat dua berkas PDF: versi lama dan versi baru.")
    old, new = pymupdf.open(files[0]), pymupdf.open(files[1])
    if mode == "visual":
        old, new, changed = _visual_diff(old, new)
        return _side_by_side(old, new, f"{changed} halaman berbeda  (merah: area yang berubah)", out)
    wo, wn = _words(old), _words(new)
    if not wo and not wn:
        raise UserError("Tidak ada teks yang dapat dibandingkan. Jalankan OCR terlebih dahulu.")
    # ponytail: word-level difflib; fine up to a few hundred pages, swap for a diff lib if slow.
    sm = SequenceMatcher(None, [w[2] for w in wo], [w[2] for w in wn], autojunk=False)
    changes = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        changes += 1
        color = YELLOW if tag == "replace" else None
        _mark(old, wo[i1:i2], color or RED)
        _mark(new, wn[j1:j2], color or GREEN)
    return _side_by_side(old, new, f"{changes} perbedaan  (merah: dihapus, hijau: ditambah, kuning: diubah)", out)


def _visual_diff(old, new, dpi=100):
    """Rasterise both versions and tint the pixels that differ. For scans and drawings without text."""
    from PIL import Image, ImageChops, ImageFilter

    def render(doc, i):
        if i >= len(doc):
            return None
        pix = doc[i].get_pixmap(dpi=dpi)
        return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

    def as_page(dst, img, rect):
        buf = io.BytesIO()
        img.save(buf, "PNG")
        dst.new_page(width=rect.width, height=rect.height).insert_image(pymupdf.Rect(0, 0, rect.width, rect.height), stream=buf.getvalue())

    o_doc, n_doc, changed = pymupdf.open(), pymupdf.open(), 0
    for i in range(max(len(old), len(new))):
        a, b = render(old, i), render(new, i)
        ref = (old[i] if a else new[i]).rect
        a = a or Image.new("RGB", b.size, "white")
        b = (b or Image.new("RGB", a.size, "white")).resize(a.size)
        mask = ImageChops.difference(a.convert("L"), b.convert("L")).point(lambda v: 255 if v > 40 else 0)
        mask = mask.filter(ImageFilter.MaxFilter(9))  # Grow specks into visible regions.
        if mask.getbbox():
            changed += 1
            red = Image.new("RGB", a.size, (255, 50, 50))
            a = Image.composite(Image.blend(a, red, 0.45), a, mask)
            b = Image.composite(Image.blend(b, red, 0.45), b, mask)
        as_page(o_doc, a, ref)
        as_page(n_doc, b, ref)
    return o_doc, n_doc, changed


def _side_by_side(old, new, legend, out):
    # Old on the left, new on the right, one sheet per page pair.
    dst = pymupdf.open()
    for i in range(max(len(old), len(new))):
        lw = old[i].rect if i < len(old) else new[i].rect
        rw = new[i].rect if i < len(new) else old[i].rect
        sheet = dst.new_page(width=lw.width + rw.width + 20, height=max(lw.height, rw.height) + 30)
        sheet.insert_text((10, 20), f"Lama - hal. {i + 1}", fontsize=10, color=RED)
        sheet.insert_text((lw.width + 30, 20), f"Baru - hal. {i + 1}", fontsize=10, color=(0, 0.5, 0))
        if i < len(old):
            sheet.show_pdf_page(pymupdf.Rect(0, 30, lw.width, 30 + lw.height), old, i)
        if i < len(new):
            sheet.show_pdf_page(pymupdf.Rect(lw.width + 20, 30, lw.width + 20 + rw.width, 30 + rw.height), new, i)
    dst[0].insert_text((dst[0].rect.width / 4, 20), legend, fontsize=8, color=(0.3, 0.3, 0.3))
    path = out / "perbandingan.pdf"
    dst.save(path, garbage=3, deflate=True)
    return path


CM = 72 / 2.54
A4 = pymupdf.paper_size("a4")
ORANGE = (1, 0.55, 0)


def _page_number_like(text):
    t = text.strip().strip("-").strip()
    return len(t) <= 8 and (t.isdigit() or set(t.lower()) <= set("ivxlc"))


def thesis_check(files, out, top="4", left="4", right="3", bottom="3"):
    """Check paper size and margins (default 4-4-3-3 cm, A4) and report fonts.
    Output: the document with margin guides drawn, red boxes on content outside them, and a summary page."""
    doc = pymupdf.open(files[0])
    t, l, r, b = (float(v) * CM for v in (top, left, right, bottom))
    sizes, fonts, bad_paper, bad_pages = {}, {}, [], []
    tol = 2  # points
    for i, page in enumerate(doc):
        pr = page.rect
        if not (abs(pr.width - A4[0]) < 3 and abs(pr.height - A4[1]) < 3):
            bad_paper.append(i + 1)
        box = pymupdf.Rect(l - tol, t - tol, pr.width - r + tol, pr.height - b + tol)
        outside = [pymupdf.Rect(blk[:4]) for blk in page.get_text("blocks")
                   if blk[6] == 0 and not pymupdf.Rect(blk[:4]) in box and not _page_number_like(blk[4])]
        outside += [pymupdf.Rect(img["bbox"]) for img in page.get_image_info() if not pymupdf.Rect(img["bbox"]) in box]
        for blk in page.get_text("dict")["blocks"]:
            for line in blk.get("lines", []):
                for span in line["spans"]:
                    n = len(span["text"].strip())
                    sizes[round(span["size"])] = sizes.get(round(span["size"]), 0) + n
                    fonts[span["font"]] = fonts.get(span["font"], 0) + n
        shape = page.new_shape()
        shape.draw_rect(pymupdf.Rect(l, t, pr.width - r, pr.height - b) * page.derotation_matrix)
        shape.finish(color=ORANGE, dashes="[4 4] 0", width=0.7)
        for rect in outside:
            shape.draw_rect(rect)
            shape.finish(color=RED, fill=RED, fill_opacity=0.18, width=1)
        shape.commit()
        if outside:
            bad_pages.append(i + 1)

    body = max(sizes, key=sizes.get) if sizes else None
    total = sum(fonts.values()) or 1
    top_fonts = sorted(fonts.items(), key=lambda kv: -kv[1])[:4]
    lines = [
        ("Laporan Cek Format", 18),
        (f"Margin yang diperiksa: atas {top} cm, kiri {left} cm, kanan {right} cm, bawah {bottom} cm; kertas A4.", 10),
        ("", 10),
        ("Ukuran kertas: " + ("semua halaman A4" if not bad_paper else f"bukan A4 di halaman {_ranges(bad_paper)}"), 11),
        ("Margin: " + ("semua isi berada di dalam margin" if not bad_pages
                       else f"ada isi di luar margin pada halaman {_ranges(bad_pages)} (kotak merah)"), 11),
        (f"Ukuran huruf utama: {body} pt" if body else "Tidak ada teks (PDF hasil scan?)", 11),
        ("Huruf yang dipakai: " + ", ".join(f"{name} ({n * 100 // total}%)" for name, n in top_fonts), 11),
        ("", 10),
        ("Garis putus-putus oranye menunjukkan batas margin pada setiap halaman.", 9),
        ("Nomor halaman di area margin diabaikan. Periksa kembali pedoman fakultas Anda.", 9),
    ]
    summary = doc.new_page(0, width=A4[0], height=A4[1])
    y = 72
    for text, size in lines:
        warn = text.startswith(("Ukuran kertas: bukan", "Margin: ada"))
        unused = summary.insert_textbox(pymupdf.Rect(72, y, A4[0] - 72, y + 200), text or " ", fontsize=size,
                                        color=(0.8, 0.1, 0.1) if warn else (0, 0, 0))
        y += 200 - unused + size * 0.6
    path = out / "cek-format.pdf"
    doc.save(path, garbage=3, deflate=True)
    return path


def _ranges(nums):
    out, start = [], nums[0]
    for a, b in zip(nums, nums[1:] + [None]):
        if b != a + 1:
            out.append(str(start) if start == a else f"{start}-{a}")
            start = b
    return ", ".join(out)
