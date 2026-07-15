// Polyfill cedo: pdf.js 5.4+ usa Uint8Array.toHex no fingerprint do PDF.
import "@/lib/uint8ArrayCompat";
import { createRoot } from "react-dom/client";
import React from "react";
import App from "./app/App.tsx";
import { ErrorBoundary } from "./app/components/ErrorBoundary";
import "./styles/index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Elemento #root não encontrado.");
}
createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
  