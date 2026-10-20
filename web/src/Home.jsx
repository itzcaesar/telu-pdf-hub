import { FileText, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Group, Link, NavBar, ThemeButton, ToolIcon, ToolRow, useTools } from "./ui.jsx";

function useWide() {
  const mq = matchMedia("(min-width: 1024px)");
  const [wide, setWide] = useState(mq.matches);
  useEffect(() => {
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export default function Home() {
  const { data, error } = useTools();
  const wide = useWide();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const match = (t) => `${t.name} ${t.desc}`.toLowerCase().includes(query);

  const search = (
    <div className="search" role="search">
      <Search size={18} aria-hidden="true" />
      <input id="tool-search" type="search" placeholder="Cari alat" aria-label="Cari alat" value={q}
             onChange={(e) => setQ(e.target.value)} />
      {q && (
        <button className="clear" onClick={() => setQ("")} aria-label="Hapus pencarian">
          <X size={12} strokeWidth={3} aria-hidden="true" />
        </button>
      )}
    </div>
  );

  const loading = !data && !error && <Group><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></Group>;
  const failed = error && <p className="empty">Gagal memuat daftar alat. Periksa koneksi lalu muat ulang halaman.</p>;
  const note = data && (
    <p className="note">
      <ShieldCheck size={16} aria-hidden="true" />
      Berkas diproses di server ini dan dihapus otomatis setelah {data.ttlHours} jam. Proyek mahasiswa, tidak resmi
      dan tidak berafiliasi dengan Telkom University.
    </p>
  );

  if (wide) {
    // Desktop follows the IPB PDF Hub layout: title, privacy notice, search, then categories as two-column cards.
    const list = data?.tools.filter(match) || [];
    return (
      <main className="screen">
        <NavBar title="Pilih alat">
          <div className="content">
            <h1 className="page-title">Pilih alat</h1>
            {note}
            {search}
            {failed}
            {loading}
            {data && !list.length && <p className="empty">Tidak ada alat yang cocok.</p>}
            {data && data.categories.map((c, i) => {
              const tools = list.filter((t) => t.category === c);
              return tools.length > 0 && (
                <section key={c} className="cat-section" aria-labelledby={`cat-${i}`}>
                  <h2 id={`cat-${i}`}>{c}</h2>
                  <div className="tool-grid">{tools.map((t) => <ToolCard key={t.id} tool={t} />)}</div>
                </section>
              );
            })}
          </div>
        </NavBar>
      </main>
    );
  }

  return (
    <main className="screen">
      <NavBar title="TelU PDF Hub" trailing={<ThemeButton />}>
        <div className="content">
          <h1 className="large-title brand-title">
            <span className="brand-mark" aria-hidden="true"><FileText size={20} strokeWidth={2.4} /></span>
            TelU PDF Hub
          </h1>
          {search}
          {failed}
          {loading}
          {data && (query ? <Results tools={data.tools.filter(match)} /> : (
            data.categories.map((c, i) => (
              <Group key={c} header={c} id={`cat-${i}`}>
                {data.tools.filter((t) => t.category === c).map((t) => <ToolRow key={t.id} tool={t} />)}
              </Group>
            ))
          ))}
          {note}
        </div>
      </NavBar>
    </main>
  );
}

function ToolCard({ tool }) {
  return (
    <Link to={`/t/${tool.id}`} className="tool-card">
      <ToolIcon tool={tool} />
      <span className="tool-card-text">
        <strong>{tool.name}</strong>
        <small>{tool.desc}</small>
      </span>
    </Link>
  );
}

function Results({ tools }) {
  if (!tools.length) return <p className="empty">Tidak ada alat yang cocok.</p>;
  return (
    <Group header={`${tools.length} hasil`} id="results">
      {tools.map((t) => <ToolRow key={t.id} tool={t} />)}
    </Group>
  );
}
