import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { isReportView } from "./view/bridge";
import { ReportApp } from "./view/ReportApp";
import "./view/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isReportView() ? <ReportApp /> : <App />}
  </StrictMode>,
);
