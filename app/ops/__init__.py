import os
import subprocess
import tempfile
from pathlib import Path

import pymupdf


class UserError(Exception):
    """Error whose message is safe to show to the user (Bahasa Indonesia)."""


def run(cmd, timeout=300):
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise UserError("Proses terlalu lama dan dihentikan. Coba berkas yang lebih kecil.")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"{cmd[0]} gagal: {e.stderr.decode(errors='replace')[-500:]}")


def parse_pages(spec, n):
    """'1-3,5' -> [0, 1, 2, 4]. Empty spec means all pages."""
    spec = (spec or "").replace(" ", "")
    if not spec:
        return list(range(n))
    out = []
    for part in spec.split(","):
        if not part:
            continue
        try:
            a, _, b = part.partition("-")
            a = int(a)
            b = int(b) if b else a
        except ValueError:
            raise UserError(f"Format halaman tidak valid: '{part}'. Contoh: 1-3,5")
        if not (1 <= a <= b <= n):
            raise UserError(f"Halaman '{part}' di luar jangkauan (1-{n}).")
        out.extend(range(a - 1, b))
    return out


def soffice_profile():
    # Separate LibreOffice profile per worker process so parallel conversions don't collide.
    return "-env:UserInstallation=" + Path(tempfile.gettempdir(), f"lo-{os.getpid()}").as_uri()


def page_rect(page, r):
    """Fractions [x0, y0, x1, y1] of the page as displayed -> Rect in unrotated page space."""
    try:
        x0, y0, x1, y1 = (min(max(float(v), 0.0), 1.0) for v in r)
    except (TypeError, ValueError):
        raise UserError("Area pilihan tidak valid.")
    w, h = page.rect.width, page.rect.height
    rect = pymupdf.Rect(x0 * w, y0 * h, x1 * w, y1 * h).normalize() * page.derotation_matrix
    if rect.is_empty:
        raise UserError("Area pilihan terlalu kecil.")
    return rect
