import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import meta from "./data/meta.json";

// Placeholder until the UI stage; proves the generated data loads in the browser.
function App() {
  return (
    <main>
      <h1>Planejador de Build — Lorde</h1>
      <p>Dados do rAthena (pré-renovação), commit {meta.rathenaCommit.slice(0, 7)}.</p>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
