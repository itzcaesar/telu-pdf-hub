import { ArrowDownToLine, Clock, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Group, Link, NavBar, ThemeButton, ToolIcon, useTools } from "./ui.jsx";

const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });

function ago(ts) {
  const s = Math.round(ts - Date.now() / 1000);
  if (s > -60) return "baru saja";
  if (s > -3600) return rtf.format(Math.round(s / 60), "minute");
  return rtf.format(Math.round(s / 3600), "hour");
}

export default function History() {
  const { data: registry } = useTools();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let timer;
    const load = async () => {
      try {
        const r = await (await fetch("/api/history")).json();
        setRows(r);
        // Keep refreshing while something is still processing.
        if (r.some((x) => x.status === "running")) timer = setTimeout(load, 2000);
      } catch {
        setRows((prev) => prev || []);
      }
    };
    load();
    return () => clearTimeout(timer);
  }, []);

  const tools = Object.fromEntries((registry?.tools || []).map((t) => [t.id, t]));

  return (
    <main className="screen">
      <NavBar title="Riwayat" trailing={<ThemeButton />}>
        <div className="content narrow">
          <h1 className="large-title">Riwayat</h1>
          {!rows && <Group><div className="skeleton" /><div className="skeleton" /></Group>}
          {rows?.length === 0 && (
            <div className="empty">
              <div className="dropzone-icon"><Clock size={28} aria-hidden="true" /></div>
              <h2>Belum ada riwayat</h2>
              <p>Berkas yang Anda proses akan muncul di sini.</p>
              <Link to="/" className="btn small">Pilih alat</Link>
            </div>
          )}
          {rows?.length > 0 && (
            <Group footer={`Hanya terlihat di peramban ini. Berkas dihapus ${registry?.ttlHours ?? 2} jam setelah diproses.`}>
              {rows.map((r) => {
                const tool = tools[r.tool] || { name: r.tool, icon: "file-text", category: "" };
                return (
                  <div className="row with-icon" key={r.id}>
                    <ToolIcon tool={tool} />
                    <span className="row-text">
                      <span className="row-title">{tool.name}</span>
                      <span className="row-sub">{r.name} · {ago(r.created)}</span>
                      {r.status === "error" && <span className="row-sub" style={{ color: "var(--danger)" }}>Gagal: {r.error}</span>}
                    </span>
                    {r.status === "done" && (
                      <a className="icon-btn" href={r.download} aria-label={`Unduh hasil ${tool.name} untuk ${r.name}`}>
                        <ArrowDownToLine size={22} aria-hidden="true" />
                      </a>
                    )}
                    {r.status === "running" && (
                      <span className="status-text"><LoaderCircle className="spin" size={18} aria-label="Diproses" /></span>
                    )}
                  </div>
                );
              })}
            </Group>
          )}
          <p className="group-footer"><Link to="/statistik">Statistik penggunaan</Link></p>
        </div>
      </NavBar>
    </main>
  );
}
