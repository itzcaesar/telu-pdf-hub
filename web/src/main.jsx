import "./styles.css";

import { useRef } from "react";
import { createRoot } from "react-dom/client";

import History from "./History.jsx";
import Home from "./Home.jsx";
import Stats from "./Stats.jsx";
import Tool from "./Tool.jsx";
import { Dock, TopNav, useRoute } from "./ui.jsx";

const depth = (path) => (path.startsWith("/t/") || path === "/statistik" ? 1 : 0);

function App() {
  const path = useRoute();
  // Slide in from the right when going deeper, from the left when going back, fade between tabs.
  const prev = useRef(path);
  const anim = depth(path) > depth(prev.current) ? "anim-push" : depth(path) < depth(prev.current) ? "anim-pop" : "anim-fade";
  prev.current = path;

  const toolId = path.startsWith("/t/") ? decodeURIComponent(path.slice(3)) : null;
  const screen = toolId ? <Tool id={toolId} />
    : path === "/riwayat" ? <History />
      : path === "/statistik" ? <Stats />
        : <Home />;
  return (
    <>
      <TopNav />
      <div key={path} className={anim}>{screen}</div>
      <Dock />
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
