import json
import shutil

import pikepdf
import pymupdf

from . import UserError, page_rect, run

GS_LEVELS = {"low": "/printer", "medium": "/ebook", "high": "/screen"}


def compress(files, out, level="medium"):
    path = out / "kompres.pdf"
    run(["gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5", f"-dPDFSETTINGS={GS_LEVELS[level]}",
         "-dNOPAUSE", "-dBATCH", "-dQUIET", "-dSAFER", f"-sOutputFile={path}", str(files[0])])
    if path.stat().st_size >= files[0].stat().st_size:
        shutil.copy(files[0], path)  # Already optimal; never hand back a bigger file.
    return path


def ocr(files, out, lang="ind+eng"):
    path = out / "ocr.pdf"
    run(["ocrmypdf", "-l", lang, "--skip-text", "--rotate-pages", "--deskew", "--quiet",
         str(files[0]), str(path)], timeout=600)
    return path


def protect(files, out, password=""):
    if len(password) < 4:
        raise UserError("Kata sandi minimal 4 karakter.")
    path = out / "terkunci.pdf"
    pikepdf.open(files[0]).save(path, encryption=pikepdf.Encryption(user=password, owner=password, R=6))
    return path


def unlock(files, out, password=""):
    try:
        pdf = pikepdf.open(files[0], password=password)
    except pikepdf.PasswordError:
        raise UserError("Kata sandi salah.")
    path = out / "terbuka.pdf"
    pdf.save(path)
    return path


def sign(files, out, area="", image=None):
    if not image:
        raise UserError("Pilih gambar tanda tangan.")
    try:
        a = json.loads(area)
        p, r = int(a["p"]), a["r"]
    except (ValueError, TypeError, KeyError):
        raise UserError("Tentukan posisi tanda tangan pada pratinjau.")
    doc = pymupdf.open(files[0])
    page = doc[p]
    page.insert_image(page_rect(page, r), filename=str(image), rotate=page.rotation, overlay=True)
    path = out / "ttd.pdf"
    doc.save(path, garbage=3, deflate=True)
    return path


def redact(files, out, areas="[]"):
    try:
        items = [(int(a["p"]), a["r"]) for a in json.loads(areas)]
    except (ValueError, TypeError, KeyError):
        items = []
    if not items:
        raise UserError("Tandai minimal satu area yang akan disensor.")
    doc = pymupdf.open(files[0])
    for p, r in items:
        doc[p].add_redact_annot(page_rect(doc[p], r), fill=(0, 0, 0))
    for page in doc:
        page.apply_redactions()  # Removes the underlying text/images, not just covers them.
    path = out / "sensor.pdf"
    doc.save(path, garbage=4, deflate=True)
    return path


def metadata(files, out, title="", author="", subject="", keywords=""):
    doc = pymupdf.open(files[0])
    meta = doc.metadata
    for k, v in {"title": title, "author": author, "subject": subject, "keywords": keywords}.items():
        if v.strip():
            meta[k] = v.strip()
    doc.set_metadata(meta)
    path = out / "metadata.pdf"
    doc.save(path, garbage=3, deflate=True)
    return path


def flatten(files, out):
    doc = pymupdf.open(files[0])
    doc.bake()
    path = out / "flatten.pdf"
    doc.save(path, garbage=3, deflate=True)
    return path


def grayscale(files, out):
    path = out / "hitam-putih.pdf"
    run(["gs", "-sDEVICE=pdfwrite", "-sColorConversionStrategy=Gray", "-dProcessColorModel=/DeviceGray",
         "-dCompatibilityLevel=1.5", "-dNOPAUSE", "-dBATCH", "-dQUIET", "-dSAFER", f"-sOutputFile={path}",
         str(files[0])])
    return path


def repair(files, out):
    path = out / "diperbaiki.pdf"
    try:
        # qpdf reconstructs broken xref tables and streams while opening.
        with pikepdf.open(files[0]) as pdf:
            pdf.save(path)
        return path
    except pikepdf.PasswordError:
        raise UserError("PDF terkunci. Gunakan Buka Kunci PDF terlebih dahulu.")
    except pikepdf.PdfError:
        pass
    try:  # MuPDF has a different, sometimes more forgiving, repair strategy.
        doc = pymupdf.open(files[0])
        if not len(doc):
            raise ValueError
        doc.save(path, garbage=4, deflate=True, clean=True)
    except Exception:
        raise UserError("PDF terlalu rusak dan tidak dapat diperbaiki.")
    return path


def fill_form(files, out, fields="{}", flatten="0"):
    """fields: {field name: value}. Checkboxes take true/false, radio groups take the chosen export value."""
    try:
        values = json.loads(fields)
        assert isinstance(values, dict)
    except (ValueError, AssertionError):
        raise UserError("Isian formulir tidak valid.")
    doc = pymupdf.open(files[0])
    if not doc.is_form_pdf:
        raise UserError("PDF ini tidak memiliki formulir yang dapat diisi.")
    for page in doc:
        for w in page.widgets():
            if w.field_name not in values:
                continue
            v = values[w.field_name]
            if w.field_type == pymupdf.PDF_WIDGET_TYPE_CHECKBOX:
                w.field_value = w.on_state() if v in (True, "true", "1", "on") else "Off"
            elif w.field_type == pymupdf.PDF_WIDGET_TYPE_RADIOBUTTON:
                w.field_value = w.on_state() == v
            elif w.field_type in (pymupdf.PDF_WIDGET_TYPE_TEXT, pymupdf.PDF_WIDGET_TYPE_COMBOBOX,
                                  pymupdf.PDF_WIDGET_TYPE_LISTBOX):
                w.field_value = str(v)[:5000]
            else:
                continue
            w.update()
    if flatten == "1":
        doc.bake()
    path = out / "formulir.pdf"
    doc.save(path, garbage=3, deflate=True)
    return path
