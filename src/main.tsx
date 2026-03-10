import "./index.css";

// import App from './App.tsx'
import { NewApp } from "./NewApp";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NewApp />
  </StrictMode>,
);
