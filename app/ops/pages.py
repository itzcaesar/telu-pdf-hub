import io
import json
import zipfile

import pikepdf
import pymupdf
from PIL import Image

from . import UserError, page_rect, parse_pages


def merge(files, out):
    dst = pikepdf.new()
    srcs = [pikepdf.open(f) for f in files]
    for src in srcs:
        dst.pages.extend(src.pages)
    path = out / "gabung.pdf"
    dst.save(path)
    return path


def split(files, out, mode="range", ranges="", every="1"):
    src = pikepdf.open(files[0])
    n = len(src.pages)
    if mode == "every":
        k = max(1, int(float(every)))
        groups = [list(range(i, min(i + k, n))) for i in range(0, n, k)]
    elif mode == "extract":
        groups = [parse_pages(ranges, n)]
    else:
        groups = [parse_pages(part, n) for part in ranges.split(",") if part.strip()]
    if not groups or not all(groups):
        raise UserError("Isi rentang halaman, contoh: 1-3,4-6")
    if len(groups) == 1:
        return _subset(src, groups[0], out / "pisah.pdf")
    path = out / "pisah.zip"
    with zipfile.ZipFile(path, "w") as z:
        for i, g in enumerate(groups, 1):
            part = _subset(src, g, out / f"bagian-{i}.pdf")
            z.write(part, part.name)
            part.unlink()
    return path


def _subset(src, idx, path):
    dst = pikepdf.new()
    for i in idx:
        dst.pages.append(src.pages[i])
    dst.save(path)
    return path


def rotate(files, out, angle="90", pages=""):
    pdf = pikepdf.open(files[0])
    for i in parse_pages(pages, len(pdf.pages)):
        pdf.pages[i].rotate(int(angle), relative=True)
    path = out / "putar.pdf"
    pdf.save(path)
    return path


def organize(files, out, spec="[]"):
    """spec: [{"f": file index or null for blank page, "p": page index, "r": extra rotation}, ...]"""
    try:
        items = json.loads(spec)
    except ValueError:
        raise UserError("Susunan halaman tidak valid.")
    if not items:
        raise UserError("Dokumen hasil tidak boleh kosong.")
    srcs = [pymupdf.open(f) for f in files]
    dst = pymupdf.open()
    for it in items:
        f, rot = it.get("f"), int(it.get("r", 0))
        if rot % 90:
            raise UserError("Rotasi harus kelipatan 90°.")
        if f is None:
            ref = dst[-1].rect if len(dst) else srcs[0][0].rect
            dst.new_page(width=ref.width, height=ref.height)
            page = dst[-1]
        else:
            src, p = srcs[int(f)], int(it["p"])
            if not 0 <= p < len(src):
                raise UserError("Nomor halaman tidak valid.")
            dst.insert_pdf(src, from_page=p, to_page=p)
            page = dst[-1]
        page.set_rotation((page.rotation + rot) % 360)
    path = out / "atur.pdf"
    dst.save(path, garbage=3, deflate=True)
    return path


def crop(files, out, area="", scope="all"):
    a = _area(area)
    doc = pymupdf.open(files[0])
    pages = range(len(doc)) if scope == "all" else [a["p"]]
    for i in pages:
        page = doc[i]
        rect = page_rect(page, a["r"])
        # Cropbox is expressed in mediabox coordinates; page coordinates start at the old cropbox.
        page.set_cropbox((rect + (page.cropbox.x0, page.cropbox.y0) * 2) & page.mediabox)
    path = out / "crop.pdf"
    doc.save(path, garbage=3, deflate=True)
    return path


def _area(area):
    try:
        a = json.loads(area)
        a["p"] = int(a["p"])
        return a
    except (ValueError, TypeError, KeyError):
        raise UserError("Pilih area pada pratinjau halaman terlebih dahulu.")


POSITIONS = {
    "bottom-center": (0.5, 1), "bottom-right": (1, 1), "bottom-left": (0, 1),
    "top-center": (0.5, 0), "top-right": (1, 0), "top-left": (0, 0),
}


def page_numbers(files, out, fmt="{n}", position="bottom-center", size="11", start="1", pages=""):
    doc = pymupdf.open(files[0])
    size, n0 = float(size), int(float(start))
    targets = parse_pages(pages, len(doc))
    fx, fy = POSITIONS[position]
    margin = 24
    for k, i in enumerate(targets):
        page = doc[i]
        text = fmt.format(n=n0 + k, total=n0 + len(targets) - 1)
        tw = pymupdf.get_text_length(text, "helv", size)
        w, h = page.rect.width, page.rect.height
        x = margin + fx * (w - 2 * margin - tw)
        y = margin + size if fy == 0 else h - margin
        _text(page, (x, y), text, size)
    path = out / "nomor.pdf"
    doc.save(path, garbage=3, deflate=True)
    return path


def _text(page, point, text, size, color=(0, 0, 0), opacity=1, angle=0):
    # Point is in displayed coordinates; map into unrotated space and counter-rotate the text.
    p = pymupdf.Point(point) * page.derotation_matrix
    page.insert_text(p, text, fontsize=size, fontname="helv", color=color, fill_opacity=opacity,
                     rotate=page.rotation, morph=(p, pymupdf.Matrix(angle)) if angle else None)


def watermark(files, out, text="", image=None, size="48", opacity="0.3", angle="45", pages=""):
    if not text and not image:
        raise UserError("Isi teks atau pilih gambar watermark.")
    doc = pymupdf.open(files[0])
    size, opacity, angle = float(size), float(opacity), float(angle)
    stamp = _faded_png(image, opacity) if image else None
    for i in parse_pages(pages, len(doc)):
        page = doc[i]
        w, h = page.rect.width, page.rect.height
        if stamp:
            # Image width = size% of page width, centred. Image rotation limited to 90° steps by PyMuPDF.
            iw = w * min(size, 100) / 100
            ih = iw * stamp[1]
            r = pymupdf.Rect((w - iw) / 2, (h - ih) / 2, (w + iw) / 2, (h + ih) / 2)
            page.insert_image(r * page.derotation_matrix, stream=stamp[0], rotate=page.rotation,
                              overlay=True)
        else:
            tw = pymupdf.get_text_length(text, "helv", size)
            c = pymupdf.Point(w / 2, h / 2)
            m = pymupdf.Matrix(-angle)
            # Offset start so the text's midpoint sits at the page centre after rotation.
            start = c - pymupdf.Point(tw / 2, -size / 3) * m
            _text(page, start, text, size, color=(0.5, 0.5, 0.5), opacity=opacity, angle=angle)
    path = out / "watermark.pdf"
    doc.save(path, garbage=3, deflate=True)
    return path


def _faded_png(path, opacity):
    im = Image.open(path).convert("RGBA")
    im.putalpha(im.getchannel("A").point(lambda a: int(a * opacity)))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue(), im.height / im.width


def delete_pages(files, out, pages=""):
    pdf = pikepdf.open(files[0])
    drop = set(parse_pages(pages, len(pdf.pages))) if pages.strip() else set()
    if not drop:
        raise UserError("Isi nomor halaman yang akan dihapus, contoh: 2,5-7")
    if len(drop) == len(pdf.pages):
        raise UserError("Tidak bisa menghapus semua halaman.")
    for i in sorted(drop, reverse=True):
        del pdf.pages[i]
    path = out / "hapus-halaman.pdf"
    pdf.save(path)
    return path


SHEETS = {"a4": pymupdf.paper_size("a4"), "f4": (595, 936), "letter": pymupdf.paper_size("letter"),
          "a3": pymupdf.paper_size("a3"), "a5": pymupdf.paper_size("a5")}


def nup(files, out, per="2", size="a4"):
    """Print-saving layout: 2 pages side by side on a landscape sheet, or 4 in a 2x2 grid."""
    src = pymupdf.open(files[0])
    w, h = SHEETS[size]
    cols, rows = (2, 1) if per == "2" else (2, 2)
    if per == "2":
        w, h = h, w
    gap = 12
    cell_w, cell_h = (w - gap * (cols + 1)) / cols, (h - gap * (rows + 1)) / rows
    dst = pymupdf.open()
    for i in range(len(src)):
        k = i % (cols * rows)
        if k == 0:
            sheet = dst.new_page(width=w, height=h)
        x, y = gap + (k % cols) * (cell_w + gap), gap + (k // cols) * (cell_h + gap)
        sheet.show_pdf_page(pymupdf.Rect(x, y, x + cell_w, y + cell_h), src, i)
    path = out / "cetak-hemat.pdf"
    dst.save(path, garbage=3, deflate=True)
    return path


def resize(files, out, size="a4"):
    """Scale every page to fit the chosen paper size, keeping each page's orientation."""
    src = pymupdf.open(files[0])
    dst = pymupdf.open()
    for i, page in enumerate(src):
        w, h = SHEETS[size]
        if page.rect.width > page.rect.height:
            w, h = h, w
        dst.new_page(width=w, height=h).show_pdf_page(pymupdf.Rect(0, 0, w, h), src, i)
    path = out / "ukuran-kertas.pdf"
    dst.save(path, garbage=3, deflate=True)
    return path
