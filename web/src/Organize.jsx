import { ArrowLeft, ArrowRight, Copy, FilePlus, LoaderCircle, Plus, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { openPdf, renderPage } from "./pdf.js";
import { Group } from "./ui.jsx";

let nextKey = 0;

// Page grid for "Atur Halaman". Items: {f: 0 main | 1 inserted | null blank, p, r, img}.
export default function Organize({ file, onChange }) {
  const [pages, setPages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState("");
  const [failed, setFailed] = useState(false);
  const [extra, setExtra] = useState(null);
  const extraInput = useRef(null);

  async function thumbs(f, src) {
    const doc = await openPdf(f);
    const out = [];
    for (let p = 0; p < doc.numPages; p++) {
      setLoading(`Memuat halaman ${p + 1} dari ${doc.numPages}`);
      const img = (await renderPage(doc, p, 200)).toDataURL("image/jpeg", 0.75);
      out.push({ key: nextKey++, f: src, p, r: 0, img });
    }
    setLoading("");
    return out;
  }

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setSelected(null);
    setExtra(null);
    setFailed(false);
    thumbs(file, 0).then((p) => !cancelled && setPages(p), () => !cancelled && (setFailed(true), setLoading("")));
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const usesExtra = pages.some((it) => it.f === 1);
    onChange(JSON.stringify(pages.map(({ f, p, r }) => ({ f, p, r }))), usesExtra ? extra : null, pages.length);
  }, [pages, extra]);

  const sel = pages.findIndex((it) => it.key === selected);
  const update = (fn) => setPages((prev) => {
    const next = [...prev];
    fn(next);
    return next;
  });
  const move = (d) => update((n) => ([n[sel], n[sel + d]] = [n[sel + d], n[sel]]));

  async function insertFrom(f) {
    try {
      const added = await thumbs(f, 1);
      setExtra(f);
      setPages((prev) => [...prev.filter((it) => it.f !== 1), ...added]);
    } catch {
      setLoading("");
      setFailed(true);
    }
  }

  if (failed) return <Group header="Halaman" footer="Pratinjau gagal dimuat. Pastikan PDF tidak rusak atau terkunci."><div className="skeleton" /></Group>;

  return (
    <Group
      header={`Halaman${pages.length ? ` (${pages.length})` : ""}`}
      id="pages-h"
      footer={loading || (sel < 0 ? "Ketuk halaman untuk memilih, lalu gunakan tombol di bawah." : `Halaman ${sel + 1} dipilih.`)}
    >
      {loading && !pages.length ? (
        <div className="row"><LoaderCircle className="spin" size={20} aria-hidden="true" /> {loading}</div>
      ) : (
        <div className="pages" role="list">
          {pages.map((it, i) => (
            <button
              type="button" key={it.key} className="page" role="listitem" aria-pressed={it.key === selected}
              aria-label={`Halaman ${i + 1}${it.f === 1 ? ", dari berkas sisipan" : it.f === null ? ", kosong" : ""}`}
              onClick={() => setSelected(it.key === selected ? null : it.key)}
            >
              <span className="page-thumb">
                {it.img ? <img src={it.img} alt="" style={{ transform: `rotate(${it.r}deg)` }} />
                  : <span className="page-blank">Kosong</span>}
              </span>
              {i + 1}{it.f === 1 ? " · sisipan" : ""}
            </button>
          ))}
        </div>
      )}
      <div className="toolbar" role="toolbar" aria-label="Aksi halaman">
        <button type="button" className="icon-btn" disabled={sel <= 0} onClick={() => move(-1)}>
          <ArrowLeft size={22} aria-hidden="true" />Geser
        </button>
        <button type="button" className="icon-btn" disabled={sel < 0 || sel >= pages.length - 1} onClick={() => move(1)}>
          <ArrowRight size={22} aria-hidden="true" />Geser
        </button>
        <button type="button" className="icon-btn" disabled={sel < 0} onClick={() => update((n) => (n[sel] = { ...n[sel], r: (n[sel].r + 90) % 360 }))}>
          <RotateCw size={22} aria-hidden="true" />Putar
        </button>
        <button type="button" className="icon-btn" disabled={sel < 0} onClick={() => update((n) => n.splice(sel + 1, 0, { ...n[sel], key: nextKey++ }))}>
          <Copy size={22} aria-hidden="true" />Gandakan
        </button>
        <button type="button" className="icon-btn danger" disabled={sel < 0} onClick={() => (update((n) => n.splice(sel, 1)), setSelected(null))}>
          <Trash2 size={22} aria-hidden="true" />Hapus
        </button>
        <button type="button" className="icon-btn" disabled={!pages.length}
                onClick={() => update((n) => n.splice(sel < 0 ? n.length : sel + 1, 0, { key: nextKey++, f: null, p: 0, r: 0 }))}>
          <Plus size={22} aria-hidden="true" />Kosong
        </button>
        <button type="button" className="icon-btn" disabled={!pages.length} onClick={() => extraInput.current.click()}>
          <FilePlus size={22} aria-hidden="true" />Sisipkan
        </button>
        <input ref={extraInput} type="file" accept=".pdf" hidden
               onChange={(e) => (e.target.files[0] && insertFrom(e.target.files[0]), (e.target.value = ""))} />
      </div>
    </Group>
  );
}
