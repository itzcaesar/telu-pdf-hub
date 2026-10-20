import {
  ArrowDown, ArrowDownToLine, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, CircleAlert, CircleCheck, CircleMinus,
  File, LoaderCircle, Plus, Upload,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import {
  BackButton, formatSize, goBack, Group, navigate, NavBar, setPendingFile, takePendingFile, ToolIcon, useTools,
} from "./ui.jsx";

// pdf.js is heavy; only load it for tools with a page preview.
const Organize = lazy(() => import("./Organize.jsx"));
const AreaPicker = lazy(() => import("./AreaPicker.jsx"));
const FormFill = lazy(() => import("./FormFill.jsx"));

// Tools offered after a PDF result, in this order ("Lanjutkan dengan alat lain").
const NEXT_TOOLS = ["kompres", "proteksi", "nomor-halaman", "watermark", "tanda-tangan", "gabung", "putar", "cek-format"];

const MAX_FILES = 20;
const MAX_SIZE = 50 * 1024 * 1024;

export default function Tool({ id }) {
  const { data, error } = useTools();
  const tool = data?.tools.find((t) => t.id === id);
  if (data && !tool) {
    return (
      <main className="screen">
        <NavBar title="Tidak ditemukan" leading={<BackButton />}>
          <div className="content narrow empty"><h2>Alat tidak ditemukan</h2></div>
        </NavBar>
      </main>
    );
  }
  if (!tool) {
    return (
      <main className="screen">
        <NavBar title="" leading={<BackButton />}>
          <div className="content narrow">
            {error ? <p className="empty">Gagal memuat. Periksa koneksi lalu muat ulang.</p>
              : <Group><div className="skeleton" /><div className="skeleton" /></Group>}
          </div>
        </NavBar>
      </main>
    );
  }
  return <ToolForm tool={tool} />;
}

const defaults = (tool) =>
  Object.fromEntries(tool.options.filter((o) => o.type !== "file").map((o) => [o.name, String(o.default ?? "")]));

function visible(o, opts) {
  if (!o.show_if) return true;
  const [, key, op, val] = o.show_if.match(/^(\w+)(!?=)(.*)$/);
  return op === "=" ? opts[key] === val : opts[key] !== val;
}

function ToolForm({ tool }) {
  const okExt = (f) => tool.accept.some((ext) => f.name.toLowerCase().endsWith(ext));
  // Slot tools: files[i] belongs to slot i. A result handed over from the previous tool starts the list.
  const [files, setFiles] = useState(() => {
    const handed = takePendingFile();
    return handed && okExt(handed) && !tool.slots ? [handed] : [];
  });
  const [opts, setOpts] = useState(() => defaults(tool));
  const [optFiles, setOptFiles] = useState({});
  const [ui, setUi] = useState({ value: "", extra: null, count: 0 });
  const [notice, setNotice] = useState("");
  const [run, setRun] = useState(null); // {phase: upload|process|done|error, progress, download, name, error}

  const accept = tool.accept.join(",");
  const many = tool.multi || tool.batch;

  function addFiles(list, slot) {
    const picked = [...list];
    const bad = picked.filter((f) => !okExt(f) || f.size > MAX_SIZE);
    const good = picked.filter((f) => !bad.includes(f));
    setNotice(bad.length ? `${bad.map((f) => f.name).join(", ")} dilewati: format tidak didukung atau lebih dari 50 MB.` : "");
    if (!good.length) return;
    if (slot !== undefined) setFiles((prev) => Object.assign([...prev], { [slot]: good[0] }));
    else setFiles((prev) => (many ? [...prev, ...good].slice(0, MAX_FILES) : [good[0]]));
  }

  const missing =
    tool.slots ? (tool.slots.findIndex((_, i) => !files[i]) >= 0 ? "Pilih kedua berkas PDF." : "")
      : !files.length ? "Pilih berkas terlebih dahulu."
        : tool.ui === "form" && !ui.count ? "PDF ini tidak memiliki kolom formulir."
        : tool.ui === "organize" && !ui.count ? "Dokumen hasil tidak boleh kosong."
          : (tool.ui === "area" || tool.ui === "area-multi") && !ui.value ? "Tandai area pada pratinjau."
            : tool.ui === "area" && tool.options.some((o) => o.type === "file") && !optFiles.image
              ? "Pilih gambar tanda tangan." : "";

  function submit() {
    const fd = new FormData();
    for (const f of files) if (f) fd.append("files", f);
    if (ui.extra) fd.append("files", ui.extra);
    for (const o of tool.options) {
      if (!visible(o, opts)) continue;
      if (o.type === "file") optFiles[o.name] && fd.append(o.name, optFiles[o.name]);
      else fd.append(o.name, opts[o.name]);
    }
    if (tool.uiField) fd.append(tool.uiField, ui.value);

    setRun({ phase: "upload", progress: 0 });
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/${tool.id}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && setRun({ phase: "upload", progress: e.loaded / e.total });
    xhr.onload = () => {
      let res = {};
      try {
        res = JSON.parse(xhr.responseText);
      } catch { /* non-JSON error page from the proxy */ }
      if (xhr.status === 413) res.error = "Berkas terlalu besar.";
      if (xhr.status !== 200 || !res.job) return setRun({ phase: "error", error: res.error || "Gagal mengunggah berkas." });
      poll(res.job);
    };
    xhr.onerror = () => setRun({ phase: "error", error: "Koneksi terputus. Periksa internet Anda lalu coba lagi." });
    xhr.send(fd);
  }

  async function poll(job) {
    setRun({ phase: "process" });
    for (;;) {
      await new Promise((r) => setTimeout(r, 900));
      let s;
      try {
        s = await (await fetch(`/jobs/${job}`)).json();
      } catch {
        continue;
      }
      if (s.status === "running") continue;
      return setRun(s.status === "done" ? { phase: "done", download: s.download, name: s.name }
        : { phase: "error", error: s.error || "Gagal memproses berkas." });
    }
  }

  function reset() {
    setFiles([]);
    setUi({ value: "", extra: null, count: 0 });
    setRun(null);
  }

  const preview = tool.ui && files[0];

  return (
    <main className="screen has-action">
      <NavBar title={tool.name} leading={<BackButton />}>
        <div className="content">
          <div className="tool-layout">
            <div className="tool-main">
              <button className="crumb" onClick={() => goBack()}>
                <ChevronLeft size={18} aria-hidden="true" />Semua alat
              </button>
              <div className="tool-head">
                <ToolIcon tool={tool} large />
                <div>
                  <h1 className="large-title">{tool.name}</h1>
                  <p>{tool.desc}</p>
                </div>
              </div>

              {tool.slots ? (
                <Group header="Berkas" id="files-h" footer={notice}>
                  {tool.slots.map((label, i) => (
                    <label className="row" key={label}>
                      <File className="file-ic" size={22} aria-hidden="true" />
                      <span className="row-text">
                        <span className="row-title">{label}</span>
                        <span className="row-sub">{files[i] ? `${files[i].name} · ${formatSize(files[i].size)}` : "Belum dipilih"}</span>
                      </span>
                      <span className="btn small">{files[i] ? "Ganti" : "Pilih"}</span>
                      <input type="file" className="sr-only" accept={accept}
                             onChange={(e) => (addFiles(e.target.files, i), (e.target.value = ""))} />
                    </label>
                  ))}
                </Group>
              ) : (
                <FileSection tool={tool} files={files} setFiles={setFiles} addFiles={addFiles} accept={accept} notice={notice} />
              )}

              {preview && (
                <Suspense fallback={<Group><div className="skeleton" /></Group>}>
                  {tool.ui === "organize" ? (
                    <Organize file={files[0]} onChange={(value, extra, count) => setUi({ value, extra, count })} />
                  ) : tool.ui === "form" ? (
                    <FormFill file={files[0]} onChange={(value, count) => setUi({ value, count })} />
                  ) : (
                    <AreaPicker file={files[0]} multi={tool.ui === "area-multi"} onChange={(value) => setUi({ value })} />
                  )}
                </Suspense>
              )}
            </div>

            <aside className="tool-side" aria-label="Pengaturan dan proses">
              {tool.options.length > 0 && (
                <Group header="Pengaturan" id="opts-h">
                  {tool.options.filter((o) => visible(o, opts)).map((o) => (
                    <Option key={o.name} o={o} value={opts[o.name]} file={optFiles[o.name]}
                            set={(v) => setOpts({ ...opts, [o.name]: v })}
                            setFile={(f) => setOptFiles({ ...optFiles, [o.name]: f })} />
                  ))}
                </Group>
              )}
              <div className="action">
                {missing && <p className="action-hint glass" id="missing">{missing}</p>}
                <button className="btn filled block" disabled={!!missing} onClick={submit}
                        aria-describedby={missing ? "missing" : undefined}>
                  Proses
                </button>
              </div>
            </aside>
          </div>
        </div>
      </NavBar>

      <ResultSheet tool={tool} run={run} onClose={() => setRun(null)} onReset={reset} />
    </main>
  );
}

function FileSection({ tool, files, setFiles, addFiles, accept, notice }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const move = (i, d) => setFiles((prev) => {
    const n = [...prev];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    return n;
  });
  const many = tool.multi || tool.batch;
  const picker = (
    <input ref={input} type="file" accept={accept} multiple={many} className="sr-only"
           onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
  );
  const footer = notice || (tool.multi && files.length > 1 ? "Berkas diproses sesuai urutan di atas."
    : tool.batch && files.length > 1 ? `${files.length} berkas diproses satu per satu. Hasilnya diunduh sebagai ZIP.` : "");

  if (!files.length) {
    return (
      <Group header="Berkas" id="files-h" footer={notice}>
        <label
          className={`dropzone${over ? " over" : ""}`}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => (e.preventDefault(), setOver(false), addFiles(e.dataTransfer.files))}
        >
          <span className="dropzone-icon"><Upload size={26} aria-hidden="true" /></span>
          <strong>Pilih berkas</strong>
          <small>
            {many ? "Bisa lebih dari satu. " : ""}Atau seret ke sini.<br />
            {tool.accept.join(", ")} · maks. 50 MB
          </small>
          {picker}
        </label>
      </Group>
    );
  }

  return (
    <Group header={`Berkas${many ? ` (${files.length})` : ""}`} id="files-h" footer={footer}>
      {files.map((f, i) => (
        <div className="row" key={`${f.name}-${f.size}-${f.lastModified}-${i}`}>
          <button type="button" className="icon-btn danger" aria-label={`Hapus ${f.name}`} style={{ marginLeft: -12 }}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
            <CircleMinus size={22} aria-hidden="true" />
          </button>
          <span className="row-text">
            <span className="row-title" style={{ overflowWrap: "anywhere" }}>{f.name}</span>
            <span className="row-sub">{formatSize(f.size)}</span>
          </span>
          {tool.multi && (
            <>
              <button type="button" className="icon-btn" aria-label={`Naikkan ${f.name}`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={20} aria-hidden="true" />
              </button>
              <button type="button" className="icon-btn" aria-label={`Turunkan ${f.name}`} disabled={i === files.length - 1}
                      onClick={() => move(i, 1)}>
                <ArrowDown size={20} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      ))}
      {(many ? files.length < MAX_FILES : true) && (
        <button type="button" className="row" onClick={() => input.current.click()} style={{ color: "var(--tint-text)" }}>
          <Plus size={22} aria-hidden="true" />
          <span className="row-text">{many ? "Tambah berkas" : "Ganti berkas"}</span>
        </button>
      )}
      {picker}
    </Group>
  );
}

function Option({ o, value, set, file, setFile }) {
  const id = `opt-${o.name}`;
  if (o.type === "select") {
    const label = o.choices.find(([v]) => v === value)?.[1];
    return (
      <div className="field row-wrap">
        <label htmlFor={id}>{o.label}</label>
        <span className="menu">
          <span>{label}</span>
          <ChevronsUpDown size={16} aria-hidden="true" />
          <select id={id} value={value} onChange={(e) => set(e.target.value)}>
            {o.choices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </span>
      </div>
    );
  }
  if (o.type === "file") {
    return (
      <label className="field row-wrap">
        <span style={{ flex: "1 1 140px" }}>
          {o.label}
          {file && <span className="row-sub">{file.name}</span>}
        </span>
        <span className="btn small">{file ? "Ganti" : "Pilih"}</span>
        <input type="file" className="sr-only" accept={o.accept} onChange={(e) => setFile(e.target.files[0] || null)} />
      </label>
    );
  }
  return (
    <div className="field row-wrap">
      <label htmlFor={id}>{o.label}</label>
      <input
        id={id} type={o.type} value={value} placeholder={o.placeholder || (o.type === "password" ? "Wajib" : "Opsional")}
        min={o.min} max={o.max} step={o.step} inputMode={o.type === "number" ? "decimal" : undefined}
        autoComplete={o.type === "password" ? "off" : undefined}
        onChange={(e) => set(e.target.value)}
      />
    </div>
  );
}

function ResultSheet({ tool, run, onClose, onReset }) {
  const ref = useRef(null);
  const { data } = useTools();
  const [handing, setHanding] = useState(null);
  const busy = run?.phase === "upload" || run?.phase === "process";
  const next = run?.name?.endsWith(".pdf")
    ? NEXT_TOOLS.filter((id) => id !== tool.id).map((id) => data?.tools.find((t) => t.id === id)).filter(Boolean).slice(0, 6)
    : [];

  // Fetch the result and open it in the next tool, so the user doesn't download and re-upload it.
  async function continueWith(t) {
    setHanding(t.id);
    try {
      const blob = await (await fetch(run.download)).blob();
      setPendingFile(new File([blob], run.name, { type: "application/pdf" }));
      ref.current.close();
      navigate(`/t/${t.id}`);
    } catch {
      setHanding(null);
    }
  }
  useEffect(() => {
    const d = ref.current;
    if (run && !d.open) d.showModal();
    if (!run && d.open) d.close();
  }, [run]);

  return (
    <dialog
      ref={ref} className="sheet" aria-labelledby="sheet-title"
      onCancel={(e) => (e.preventDefault(), !busy && onClose())}
      onClick={(e) => e.target === ref.current && !busy && onClose()}
    >
      <div className="grabber" aria-hidden="true" />
      {run && (
        <div className="sheet-body" aria-live="polite">
          {busy && (
            <>
              <h2 id="sheet-title">{run.phase === "upload" ? "Mengunggah" : "Memproses"}</h2>
              <p>{run.phase === "upload" ? `${Math.round(run.progress * 100)}%` : "Tunggu sebentar, jangan tutup halaman ini."}</p>
              <div className={`progress${run.phase === "process" ? " indeterminate" : ""}`} role="progressbar"
                   aria-valuenow={run.phase === "upload" ? Math.round(run.progress * 100) : undefined} aria-valuemin="0" aria-valuemax="100">
                <div style={run.phase === "upload" ? { width: `${run.progress * 100}%` } : undefined} />
              </div>
            </>
          )}
          {run.phase === "done" && (
            <>
              <span className="status-ic ok"><CircleCheck size={36} aria-hidden="true" /></span>
              <h2 id="sheet-title">Selesai</h2>
              <p>Berkas siap diunduh dan tersimpan di Riwayat selama 2 jam.</p>
              <div className="sheet-actions">
                <a className="btn filled block" href={run.download} autoFocus>
                  <ArrowDownToLine size={20} aria-hidden="true" />Unduh
                </a>
                <button className="btn block" onClick={onReset}>Proses berkas lain</button>
              </div>
              {next.length > 0 && (
                <div className="chain">
                  <h3>Lanjutkan dengan</h3>
                  <div className="chain-list">
                    {next.map((t) => (
                      <button key={t.id} className="chain-item" onClick={() => continueWith(t)} disabled={!!handing}>
                        <ToolIcon tool={t} />
                        <span>{t.name}</span>
                        {handing === t.id ? <LoaderCircle className="spin" size={16} aria-label="Membuka" />
                          : <ChevronRight size={16} aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {run.phase === "error" && (
            <>
              <span className="status-ic err"><CircleAlert size={36} aria-hidden="true" /></span>
              <h2 id="sheet-title">Tidak berhasil</h2>
              <p>{run.error}</p>
              <div className="sheet-actions">
                <button className="btn filled block" onClick={onClose} autoFocus>Kembali</button>
              </div>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
