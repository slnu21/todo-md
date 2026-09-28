import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { viewKind } from "./view/bridge";
import { DetailApp } from "./view/DetailApp";
import { ReportApp } from "./view/ReportApp";
import "./view/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {viewKind() === "report" ? <ReportApp /> : viewKind() === "detail" ? <DetailApp /> : <App />}
  </StrictMode>,
);
