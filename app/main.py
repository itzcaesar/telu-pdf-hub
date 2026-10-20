import asyncio
import os
import re
import secrets
import shutil
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

import pikepdf
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image

from . import jobs
from .tools import CATEGORIES, TOOLS

WEB = Path(__file__).parent.parent / "web" / "dist"
MAX_FILE = 50 * 1024 * 1024
MAX_FILES = 20
MAX_PAGES = 500
UI_FIELD = {"organize": "spec", "area": "area", "area-multi": "areas", "form": "fields"}
STATS_TOKEN = os.environ.get("STATS_TOKEN", "")


@asynccontextmanager
async def lifespan(app):
    jobs.init()

    async def sweep():
        while True:
            await asyncio.to_thread(jobs.cleanup)
            await asyncio.sleep(600)

    task = asyncio.create_task(sweep())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def owner_cookie(request: Request, call_next):
    uid = request.cookies.get("uid", "")
    fresh = not re.fullmatch(r"[0-9a-f]{32}", uid)
    request.state.uid = secrets.token_hex(16) if fresh else uid
    response = await call_next(request)
    if fresh:
        response.set_cookie("uid", request.state.uid, max_age=365 * 86400, httponly=True, samesite="lax",
                            secure=request.url.scheme == "https")
    return response


@app.get("/api/tools")
def list_tools():
    return {"categories": CATEGORIES,
            "tools": [{k: v for k, v in t.items() if k != "fn"} | {"uiField": UI_FIELD.get(t["ui"])}
                      for t in TOOLS.values()],
            "ttlHours": jobs.TTL // 3600}


@app.get("/api/history")
def history(request: Request):
    return [{"id": r["id"], "tool": r["tool"], "name": r["in_name"], "status": r["status"], "error": r["error"],
             "created": r["created"], "download": f"/download/{r['id']}" if r["status"] == "done" else None}
            for r in jobs.history(request.state.uid)]


@app.get("/api/stats")
def stats(token: str = "", days: int = 30):
    # Aggregate counts only, no files or user ids. Set STATS_TOKEN to keep the numbers private.
    if STATS_TOKEN and not secrets.compare_digest(token, STATS_TOKEN):
        raise HTTPException(403)
    return jobs.stats(min(max(days, 1), 365))


# ponytail: in-memory per-IP limit, resets on restart and is per-process; fine for one uvicorn worker.
_hits = defaultdict(deque)


def _rate_limited(ip, limit=30, window=600):
    q, now = _hits[ip], time.time()
    while q and q[0] < now - window:
        q.popleft()
    if len(q) >= limit:
        return True
    q.append(now)
    return False


class Bad(Exception):
    pass


@app.post("/api/{tool_id}")
async def submit(request: Request, tool_id: str):
    tool = TOOLS.get(tool_id) or _404()
    if _rate_limited(request.client.host):
        return JSONResponse({"error": "Terlalu banyak permintaan. Coba lagi beberapa menit lagi."}, 429)
    job_id, d = jobs.new_dir()
    try:
        form = await request.form(max_files=MAX_FILES + 2, max_part_size=MAX_FILE)
        uploads = [f for f in form.getlist("files") if getattr(f, "filename", None)]
        files = [await _save(f, d / f"in{i}", tool["accept"], tool_id) for i, f in enumerate(uploads)]
        _check_count(tool, len(files))
        opts = {}
        for o in tool["options"]:
            v = form.get(o["name"])
            if o["type"] == "file":
                if getattr(v, "filename", None):
                    opts[o["name"]] = await _save(v, d / f"opt-{o['name']}", o["accept"].split(","), tool_id)
            else:
                opts[o["name"]] = _clean(o, v if isinstance(v, str) else None)
        if tool["ui"]:
            field = UI_FIELD[tool["ui"]]
            opts[field] = str(form.get(field) or "")[:200_000]
    except Bad as e:
        shutil.rmtree(d, ignore_errors=True)
        return JSONResponse({"error": str(e)}, 400)
    names = [Path(u.filename).name[:200] for u in uploads]
    batch = tool["batch"] and len(files) > 1
    jobs.submit(job_id, request.state.uid, tool_id, names[0], files, opts, names if batch else None)
    return {"job": job_id}


def _check_count(tool, n):
    lo, hi = 1, 1
    if tool["slots"]:
        lo = hi = len(tool["slots"])
    elif tool["multi"] or tool["batch"]:
        hi = MAX_FILES
    elif tool["ui"] == "organize":
        hi = 2  # Main file + optional file to insert pages from.
    if not lo <= n <= hi:
        raise Bad("Pilih berkas terlebih dahulu." if n == 0 else f"Jumlah berkas harus {lo}" +
                  (f"-{hi}." if hi != lo else "."))


def _clean(opt, v):
    if opt["type"] == "select":
        return v if v in {c[0] for c in opt["choices"]} else opt["default"]
    if opt["type"] == "number":
        try:
            x = float(v)
        except (TypeError, ValueError):
            x = opt["default"]
        return str(min(max(x, opt["min"]), opt["max"]))
    return (v or "")[:500]


async def _save(upload, stem, accept, tool_id):
    ext = Path(upload.filename).suffix.lower()
    if ext not in accept:
        raise Bad(f"Jenis berkas '{upload.filename}' tidak didukung. Gunakan: {', '.join(accept)}")
    path = stem.with_suffix(ext)
    size = 0
    with path.open("wb") as f:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_FILE:
                raise Bad(f"'{upload.filename}' melebihi batas {MAX_FILE // 1024 // 1024} MB.")
            f.write(chunk)
    if not _content_matches(path, ext):
        raise Bad(f"Isi berkas '{upload.filename}' tidak sesuai dengan ekstensinya atau berkas rusak.")
    if ext == ".pdf" and tool_id != "perbaiki":  # The repair tool exists for files that fail this check.
        _check_pdf(path, upload.filename, allow_locked=tool_id == "buka-kunci")
    return path


def _content_matches(path, ext):
    head = path.read_bytes()[:1024]
    if ext == ".pdf":
        return b"%PDF" in head
    if ext in (".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp"):
        return head.startswith(b"PK")
    if ext in (".doc", ".xls", ".ppt"):
        return head.startswith(b"\xd0\xcf\x11\xe0") or head.startswith(b"{\\rtf")
    if ext == ".rtf":
        return head.startswith(b"{\\rtf")
    if ext in (".csv", ".html", ".htm"):
        return b"\0" not in head
    try:
        with Image.open(path) as im:
            im.verify()
        return True
    except Exception:
        return False


def _check_pdf(path, name, allow_locked):
    try:
        with pikepdf.open(path) as pdf:
            n = len(pdf.pages)
    except pikepdf.PasswordError:
        if allow_locked:
            return
        raise Bad(f"'{name}' terkunci kata sandi. Gunakan alat Buka Kunci PDF terlebih dahulu.")
    except pikepdf.PdfError:
        raise Bad(f"'{name}' rusak atau bukan PDF yang valid.")
    if n > MAX_PAGES:
        raise Bad(f"'{name}' memiliki {n} halaman. Batas maksimal {MAX_PAGES} halaman.")


@app.get("/jobs/{job_id}")
def job_status(request: Request, job_id: str):
    job = jobs.get(job_id, request.state.uid) or _404()
    done = job["status"] == "done"
    return {"status": job["status"], "error": job["error"],
            "download": f"/download/{job_id}" if done else None, "name": _download_name(job) if done else None}


@app.get("/download/{job_id}")
def download(request: Request, job_id: str):
    job = jobs.get(job_id, request.state.uid) or _404()
    if job["status"] != "done" or not jobs.output_path(job).exists():
        _404()
    return FileResponse(jobs.output_path(job), filename=_download_name(job))


def _download_name(job):
    return f"{Path(job['in_name']).stem}-{job['tool']}{Path(job['out_file']).suffix}"


def _404():
    raise HTTPException(404)


# Single-page app: client-side routes all serve index.html; built assets come from web/dist.
@app.get("/t/{tool_id}")
@app.get("/riwayat")
@app.get("/statistik")
def spa(tool_id: str = ""):
    index = WEB / "index.html"
    if not index.exists():
        raise HTTPException(503, "Frontend belum dibangun. Jalankan: cd web && npm run build")
    return FileResponse(index)


if WEB.exists():
    app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
