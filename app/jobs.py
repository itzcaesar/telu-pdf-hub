import os
import shutil
import sqlite3
import time
import traceback
import uuid
import zipfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

DATA = Path(os.environ.get("DATA_DIR", "data")).resolve()
TTL = int(os.environ.get("JOB_TTL_SECONDS", 7200))
DB = DATA / "jobs.db"

# ponytail: in-process pool on one box; move to RQ + Redis when more than one machine runs workers.
_pool = None


def db():
    con = sqlite3.connect(DB, timeout=10)
    con.row_factory = sqlite3.Row
    return con


def init():
    global _pool
    (DATA / "jobs").mkdir(parents=True, exist_ok=True)
    with db() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY, owner TEXT NOT NULL, tool TEXT NOT NULL, in_name TEXT NOT NULL,
            status TEXT NOT NULL, error TEXT, out_file TEXT, created REAL NOT NULL)""")
        con.execute("CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(owner, created)")
        # Anonymous usage counters, kept after jobs are deleted. No file names or owners.
        con.execute("""CREATE TABLE IF NOT EXISTS stats (
            day TEXT NOT NULL, tool TEXT NOT NULL, ok INTEGER NOT NULL DEFAULT 0, err INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (day, tool))""")
        # Jobs that were running when the server stopped will never finish.
        con.execute("UPDATE jobs SET status='error', error='Server dimulai ulang, silakan coba lagi.' "
                    "WHERE status='running'")
    _pool = ProcessPoolExecutor(max_workers=int(os.environ.get("WORKERS", 2)))


def new_dir():
    job_id = uuid.uuid4().hex
    d = DATA / "jobs" / job_id
    d.mkdir()
    return job_id, d


def submit(job_id, owner, tool_id, in_name, files, opts, batch_names=None):
    """batch_names: original names when a single-file tool runs on several files (result is a ZIP)."""
    with db() as con:
        con.execute("INSERT INTO jobs VALUES (?, ?, ?, ?, 'running', NULL, NULL, ?)",
                    (job_id, owner, tool_id, in_name, time.time()))
    fut = _pool.submit(_run, tool_id, [str(f) for f in files], str(DATA / "jobs" / job_id / "out"), opts, batch_names)
    fut.add_done_callback(lambda f: _finish(job_id, tool_id, f))


def _run(tool_id, files, out, opts, batch_names=None):
    # Runs in a worker process.
    from .ops import UserError
    from .tools import TOOLS

    fn = TOOLS[tool_id]["fn"]
    out = Path(out)
    out.mkdir()
    try:
        if not batch_names:
            return "ok", fn([Path(f) for f in files], out, **opts).name
        path = out / "hasil.zip"
        with zipfile.ZipFile(path, "w") as z:
            for i, (f, name) in enumerate(zip(files, batch_names)):
                sub = out / str(i)
                sub.mkdir()
                try:
                    result = fn([Path(f)], sub, **opts)
                except UserError as e:
                    raise UserError(f"{name}: {e}")
                arcname = f"{Path(name).stem}-{tool_id}{result.suffix}"
                z.write(result, arcname if arcname not in z.namelist() else f"{i + 1}-{arcname}")
                shutil.rmtree(sub)
        return "ok", path.name
    except UserError as e:
        return "error", str(e)
    except Exception:
        traceback.print_exc()
        return "error", "Terjadi kesalahan saat memproses berkas. Pastikan berkas tidak rusak."


def _finish(job_id, tool_id, fut):
    try:
        status, value = fut.result()
    except Exception:  # Worker crashed (e.g. out of memory).
        traceback.print_exc()
        status, value = "error", "Proses gagal. Berkas mungkin terlalu besar."
    ok = status == "ok"
    with db() as con:
        if ok:
            con.execute("UPDATE jobs SET status='done', out_file=? WHERE id=?", (value, job_id))
        else:
            con.execute("UPDATE jobs SET status='error', error=? WHERE id=?", (value, job_id))
        con.execute("INSERT INTO stats (day, tool, ok, err) VALUES (date('now'), ?, ?, ?) "
                    "ON CONFLICT(day, tool) DO UPDATE SET ok = ok + excluded.ok, err = err + excluded.err",
                    (tool_id, int(ok), int(not ok)))


def stats(days):
    with db() as con:
        rows = con.execute("SELECT day, tool, ok, err FROM stats WHERE day >= date('now', ?) ORDER BY day",
                           (f"-{days - 1} days",)).fetchall()
    return {"days": days, "rows": [dict(r) for r in rows]}


def get(job_id, owner):
    with db() as con:
        return con.execute("SELECT * FROM jobs WHERE id=? AND owner=?", (job_id, owner)).fetchone()


def history(owner):
    with db() as con:
        return con.execute("SELECT * FROM jobs WHERE owner=? ORDER BY created DESC LIMIT 50", (owner,)).fetchall()


def output_path(job):
    return DATA / "jobs" / job["id"] / "out" / job["out_file"]


def cleanup():
    cutoff = time.time() - TTL
    with db() as con:
        old = [r["id"] for r in con.execute("SELECT id FROM jobs WHERE created < ?", (cutoff,))]
        con.execute("DELETE FROM jobs WHERE created < ?", (cutoff,))
    for job_id in old:
        shutil.rmtree(DATA / "jobs" / job_id, ignore_errors=True)
    # Directories orphaned by a crash between mkdir and insert.
    for d in (DATA / "jobs").iterdir():
        if d.stat().st_mtime < cutoff:
            shutil.rmtree(d, ignore_errors=True)
