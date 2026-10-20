import { useEffect, useState } from "react";

import { BackButton, Group, NavBar, ThemeButton, useTools } from "./ui.jsx";

// Aggregate usage: KPI tiles, tools ranked by use (bars), and jobs per day (columns).
// Single series everywhere, so one hue (the tint), no legend; values are always printed as text.
export default function Stats() {
  const { data: registry } = useTools();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const token = new URLSearchParams(location.search).get("token") || "";
    fetch(`/api/stats?days=30&token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setStats, (s) => setError(s === 403 ? "Statistik bersifat privat. Tambahkan ?token=… pada alamat." : "Gagal memuat statistik."));
  }, []);

  const names = Object.fromEntries((registry?.tools || []).map((t) => [t.id, t.name]));
  const rows = stats?.rows || [];
  const byTool = {};
  const byDay = {};
  let ok = 0;
  let err = 0;
  for (const r of rows) {
    byTool[r.tool] = (byTool[r.tool] || 0) + r.ok + r.err;
    byDay[r.day] = (byDay[r.day] || 0) + r.ok + r.err;
    ok += r.ok;
    err += r.err;
  }
  const ranked = Object.entries(byTool).sort((a, b) => b[1] - a[1]);
  const maxTool = ranked[0]?.[1] || 1;
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
    return [d, byDay[d] || 0];
  });
  const maxDay = Math.max(1, ...days.map(([, n]) => n));
  const total = ok + err;
  const fmtDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("id", { day: "numeric", month: "short" });

  return (
    <main className="screen">
      <NavBar title="Statistik" leading={<BackButton />} trailing={<ThemeButton />}>
        <div className="content narrow">
          <h1 className="large-title">Statistik</h1>
          <p className="note" style={{ margin: "0 0 20px" }}>30 hari terakhir. Hanya jumlah pemakaian, tanpa nama berkas atau data pengguna.</p>
          {error && <p className="empty">{error}</p>}
          {!stats && !error && <Group><div className="skeleton" /></Group>}
          {stats && (
            <>
              <div className="kpis">
                <div className="kpi"><span>Total proses</span><strong>{total.toLocaleString("id")}</strong></div>
                <div className="kpi"><span>Berhasil</span><strong>{total ? `${Math.round((ok / total) * 100)}%` : "–"}</strong></div>
                <div className="kpi"><span>Alat terpopuler</span><strong className="kpi-text">{ranked[0] ? names[ranked[0][0]] || ranked[0][0] : "–"}</strong></div>
              </div>

              <Group header="Proses per hari">
                <div className="cols" role="img" aria-label={`Jumlah proses per hari, tertinggi ${maxDay}`}
                     onMouseLeave={() => setHover(null)}>
                  {days.map(([d, n]) => (
                    <div key={d} className="col" onMouseEnter={() => setHover([d, n])} onFocus={() => setHover([d, n])}
                         tabIndex={0} aria-label={`${fmtDay(d)}: ${n} proses`}>
                      <div className="col-bar" style={{ height: `${(n / maxDay) * 100}%` }} />
                    </div>
                  ))}
                  {hover && <div className="tip">{fmtDay(hover[0])} · <b>{hover[1]}</b> proses</div>}
                </div>
                <div className="cols-axis"><span>{fmtDay(days[0][0])}</span><span>Hari ini</span></div>
              </Group>

              <Group header="Pemakaian per alat" footer={err ? `${err} proses gagal termasuk dalam hitungan.` : undefined}>
                {!ranked.length && <div className="row">Belum ada data.</div>}
                {ranked.map(([id, n]) => (
                  <div className="row bar-row" key={id}>
                    <span className="bar-label">{names[id] || id}</span>
                    <span className="bar-track"><span className="bar" style={{ width: `${(n / maxTool) * 100}%` }} /></span>
                    <span className="bar-value">{n.toLocaleString("id")}</span>
                  </div>
                ))}
              </Group>
            </>
          )}
        </div>
      </NavBar>
    </main>
  );
}
