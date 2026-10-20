import { ChevronLeft, ChevronRight, Eraser } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { openPdf, renderPage } from "./pdf.js";
import { Group } from "./ui.jsx";

const clamp = (v) => Math.min(Math.max(v, 0), 1);

// Drag rectangles on a page preview. Rects are fractions of the displayed page: {p, r: [x0, y0, x1, y1]}.
export default function AreaPicker({ file, multi, onChange }) {
  const [doc, setDoc] = useState(null);
  const [failed, setFailed] = useState(false);
  const [pageNo, setPageNo] = useState(0);
  const [rects, setRects] = useState([]);
  const [drag, setDrag] = useState(null);
  const canvas = useRef(null);
  const overlay = useRef(null);
  const stage = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setRects([]);
    setPageNo(0);
    setFailed(false);
    openPdf(file).then((d) => !cancelled && setDoc(d), () => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (!doc) return;
    const width = Math.min(stage.current.clientWidth, 900) * devicePixelRatio;
    renderPage(doc, pageNo, width, canvas.current).then(() => {
      overlay.current.width = canvas.current.width;
      overlay.current.height = canvas.current.height;
      paint();
    });
  }, [doc, pageNo]);

  useEffect(() => {
    onChange(multi ? (rects.length ? JSON.stringify(rects) : "") : rects[0] ? JSON.stringify(rects[0]) : "");
    paint();
  }, [rects]);
  useEffect(paint, [drag]);

  function paint() {
    const c = overlay.current;
    if (!c) return;
    const g = c.getContext("2d");
    const { width: w, height: h } = c;
    g.clearRect(0, 0, w, h);
    const shapes = rects.filter((x) => x.p === pageNo).map((x) => x.r);
    if (drag) shapes.push([...drag.a, ...drag.b]);
    for (const [x0, y0, x1, y1] of shapes) {
      const [x, y, rw, rh] = [Math.min(x0, x1) * w, Math.min(y0, y1) * h, Math.abs(x1 - x0) * w, Math.abs(y1 - y0) * h];
      g.fillStyle = multi ? "rgba(0,0,0,.6)" : "rgba(200,16,46,.15)";
      g.fillRect(x, y, rw, rh);
      g.strokeStyle = "#c8102e";
      g.lineWidth = 2 * devicePixelRatio;
      g.setLineDash(multi ? [] : [8 * devicePixelRatio, 6 * devicePixelRatio]);
      g.strokeRect(x, y, rw, rh);
    }
  }

  const point = (e) => {
    const b = overlay.current.getBoundingClientRect();
    return [clamp((e.clientX - b.left) / b.width), clamp((e.clientY - b.top) / b.height)];
  };

  function end() {
    if (!drag) return;
    const [ax, ay] = drag.a;
    const [bx, by] = drag.b;
    const r = [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
    setDrag(null);
    if (r[2] - r[0] < 0.01 || r[3] - r[1] < 0.01) return;
    setRects((prev) => (multi ? [...prev, { p: pageNo, r }] : [{ p: pageNo, r }]));
  }

  const onPage = rects.filter((x) => x.p === pageNo).length;
  const footer = failed ? "Pratinjau gagal dimuat. Pastikan PDF tidak rusak atau terkunci."
    : multi ? `Seret pada halaman untuk menandai area yang disensor. ${rects.length} area ditandai.`
      : rects.length ? `Area dipilih pada halaman ${rects[0].p + 1}. Seret lagi untuk mengganti.`
        : "Seret pada halaman untuk memilih area.";

  return (
    <Group header="Pilih area" id="area-h" footer={footer}>
      <div className="pager">
        <button type="button" className="icon-btn" aria-label="Halaman sebelumnya" disabled={!doc || pageNo === 0}
                onClick={() => setPageNo(pageNo - 1)}>
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <span aria-live="polite">{doc ? `Halaman ${pageNo + 1} dari ${doc.numPages}` : "Memuat..."}</span>
        <button type="button" className="icon-btn" aria-label="Halaman berikutnya" disabled={!doc || pageNo >= doc.numPages - 1}
                onClick={() => setPageNo(pageNo + 1)}>
          <ChevronRight size={24} aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn danger" aria-label="Hapus area di halaman ini" disabled={!onPage}
                onClick={() => setRects((prev) => prev.filter((x) => x.p !== pageNo))}>
          <Eraser size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="stage" ref={stage} hidden={failed}>
        <canvas ref={canvas} aria-hidden="true" />
        <canvas
          ref={overlay} className="overlay" role="img" aria-label="Pratinjau halaman. Seret untuk memilih area."
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag({ a: point(e), b: point(e) });
          }}
          onPointerMove={(e) => drag && setDrag({ ...drag, b: point(e) })}
          onPointerUp={end}
          onPointerCancel={() => setDrag(null)}
        />
      </div>
    </Group>
  );
}
