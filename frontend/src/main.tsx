import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Landing from "./pages/landing";
import "./index.css";

const Workspace = lazy(() => import("./pages/workspace"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<div className="h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<Workspace />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
