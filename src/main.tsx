import "./index.css";

import { NewApp } from "./NewApp";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NewApp />
  </StrictMode>,
);
