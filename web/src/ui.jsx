import {
  Archive, ChevronLeft, ChevronRight, Crop, EyeOff, FileCode, FileDown, FileSpreadsheet, FileText, GitCompare,
  Hash, Image, Layers, LayoutGrid, Lock, LockOpen, Merge, Presentation, RotateCw, Scan, ScanText, Scissors,
  Signature, Stamp, Tag, Clock, House, Search, Code, Images, FileType, FileMinus, Columns2, Expand, Contrast,
  Wrench, GraduationCap, TextCursorInput, Sun, Moon, Monitor,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const ICONS = {
  "git-compare": GitCompare, "file-text": FileText, "file-spreadsheet": FileSpreadsheet, image: Image,
  presentation: Presentation, scan: Scan, "file-code": FileCode, archive: Archive, merge: Merge,
  scissors: Scissors, "rotate-cw": RotateCw, "layout-grid": LayoutGrid, crop: Crop, hash: Hash, stamp: Stamp,
  "file-down": FileDown, "scan-text": ScanText, lock: Lock, "lock-open": LockOpen, signature: Signature,
  "eye-off": EyeOff, tag: Tag, layers: Layers, code: Code, images: Images, "file-type": FileType,
  "file-minus": FileMinus, "columns-2": Columns2, expand: Expand, contrast: Contrast, wrench: Wrench,
  "graduation-cap": GraduationCap, "text-cursor-input": TextCursorInput,
};

const CATEGORY_COLOR = {
  "Konversi ke PDF": "blue", "Konversi dari PDF": "green", Halaman: "orange", "Optimasi & Analisis": "indigo",
  "Keamanan & Formulir": "purple",
};

// ---- Theme: "system" follows the OS; "light"/"dark" override it. index.html applies it before first paint.
const THEMES = { system: ["Tema: sistem", Monitor], light: ["Tema: terang", Sun], dark: ["Tema: gelap", Moon] };
const darkQuery = matchMedia("(prefers-color-scheme: dark)");

function readTheme() {
  try {
    return THEMES[localStorage.getItem("theme")] ? localStorage.getItem("theme") : "system";
  } catch {
    return "system";
  }
}

function applyTheme(pref) {
  const dark = pref === "dark" || (pref === "system" && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

darkQuery.addEventListener("change", () => applyTheme(readTheme()));

export function ThemeButton({ className = "circle-btn glass" }) {
  const [pref, setPref] = useState(readTheme);
  const next = { system: "light", light: "dark", dark: "system" }[pref];
  const [label, Icon] = THEMES[pref];
  return (
    <button className={className} aria-label={`${label}. Ganti tema`} title={label}
            onClick={() => {
              try {
                localStorage.setItem("theme", next);
              } catch { /* private mode: still switch for this visit */ }
              applyTheme(next);
              setPref(next);
            }}>
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}

// ---- Hand a result file to the next tool ("Lanjutkan dengan alat lain").
let pendingFile = null;
export const setPendingFile = (file) => (pendingFile = file);
export function takePendingFile() {
  const f = pendingFile;
  pendingFile = null;
  return f;
}

export function ToolIcon({ tool, large }) {
  const Icon = ICONS[tool.icon] || FileText;
  return (
    <span className={`tile c-${CATEGORY_COLOR[tool.category] || "blue"}${large ? " lg" : ""}`} aria-hidden="true">
      <Icon size={large ? 32 : 18} strokeWidth={2.2} />
    </span>
  );
}

// ---- Tiny router: three routes don't need a library.
const listeners = new Set();
const scrollMemory = {};

export function navigate(to) {
  scrollMemory[location.pathname] = scrollY;
  delete scrollMemory[to];
  history.pushState({ inApp: true }, "", to);
  listeners.forEach((fn) => fn());
}

export function goBack(fallback = "/") {
  if (history.state?.inApp) history.back();
  else navigate(fallback);
}

export function useRoute() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    listeners.add(update);
    addEventListener("popstate", update);
    return () => {
      listeners.delete(update);
      removeEventListener("popstate", update);
    };
  }, []);
  useEffect(() => {
    scrollTo(0, scrollMemory[path] || 0);
  }, [path]);
  return path;
}

export function Link({ to, children, ...props }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...props}
    >
      {children}
    </a>
  );
}

// ---- Navigation bar: large title in content, compact title fades into a blurred bar on scroll.
export function NavBar({ title, leading, trailing, children }) {
  const sentinel = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { rootMargin: "-44px 0px 0px 0px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    document.title = title === "TelU PDF Hub" ? title : `${title} · TelU PDF Hub`;
  }, [title]);
  return (
    <>
      <header className={`navbar${scrolled ? " scrolled" : ""}`}>
        <div className="navbar-inner">
          <div>{leading}</div>
          <div className="navbar-title" aria-hidden={!scrolled}>{title}</div>
          <div className="navbar-trailing">{trailing}</div>
        </div>
      </header>
      <div ref={sentinel} />
      {children}
    </>
  );
}

export function BackButton() {
  return (
    <button className="circle-btn glass" onClick={() => goBack()} aria-label="Kembali ke daftar alat">
      <ChevronLeft size={26} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}

export function Group({ header, footer, children, id }) {
  return (
    <section className="group" aria-labelledby={header ? id : undefined}>
      {header && <h2 className="group-header" id={id}>{header}</h2>}
      <div className="group-body">{children}</div>
      {footer && <p className="group-footer">{footer}</p>}
    </section>
  );
}

export function ToolRow({ tool }) {
  return (
    <Link to={`/t/${tool.id}`} className="row with-icon">
      <ToolIcon tool={tool} />
      <span className="row-text">
        <span className="row-title">{tool.name}</span>
        <span className="row-sub">{tool.short}</span>
      </span>
      <ChevronRight className="chevron" size={18} aria-hidden="true" />
    </Link>
  );
}

// Tool registry, fetched once and shared.
let toolsPromise;
export function useTools() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    toolsPromise ||= fetch("/api/tools").then((r) => (r.ok ? r.json() : Promise.reject(r)));
    toolsPromise.then(setData, () => {
      toolsPromise = null;
      setError(true);
    });
  }, []);
  return { data, error };
}

export const formatSize = (b) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);

const TABS = [
  { to: "/", label: "Beranda", icon: House },
  { to: "/riwayat", label: "Riwayat", icon: Clock },
];

const currentTab = (path) => (path === "/riwayat" ? "/riwayat" : "/");

function afterNavigate(path, fn) {
  if (location.pathname !== path) navigate(path);
  setTimeout(fn, 60); // Let the screen render first.
}

// Phones/tablets: floating glass capsule tab bar with a separate search button (iOS 26).
export function Dock() {
  const path = useRoute();
  return (
    <div className="dock">
      <nav className="tabbar glass" aria-label="Navigasi utama">
        {TABS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="tab" aria-current={currentTab(path) === to ? "page" : undefined}>
            <Icon size={24} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <button className="circle-btn glass" aria-label="Cari alat"
              onClick={() => afterNavigate("/", () => document.getElementById("tool-search")?.focus())}>
        <Search size={24} aria-hidden="true" />
      </button>
    </div>
  );
}

// Desktop: floating glass bar, brand left and navigation right (IPB PDF Hub layout).
export function TopNav() {
  const path = useRoute();
  return (
    <div className="topnav-wrap">
      <header className="topnav glass">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true"><FileText size={16} strokeWidth={2.4} /></span>
          TelU PDF Hub
        </Link>
        <nav aria-label="Navigasi utama">
          {TABS.map(({ to, label }) => (
            <Link key={to} to={to} className="topnav-link" aria-current={currentTab(path) === to ? "page" : undefined}>
              {label}
            </Link>
          ))}
          <ThemeButton className="icon-btn theme-btn" />
        </nav>
      </header>
    </div>
  );
}
