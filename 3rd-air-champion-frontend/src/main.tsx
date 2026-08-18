import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter, Route, Routes } from "react-router";
import Private from "./routes/Private.tsx";
import Authorization from "./components/destkop/Authorization.tsx";
import TiWork from "./routes/TiWork";
import TiBook from "./routes/TiBook.tsx";
import { installAuthInterceptors } from "./util/authSession.ts";

// Before any component can fire a request: an expired access token is renewed
// and the request retried, rather than failing into empty data.
installAuthInterceptors();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Private>
              <App />
            </Private>
          }
        />
        <Route path="/login" element={<Authorization />} />
        <Route path="/book" element={<TiBook />} />
        <Route path="/work" element={<TiWork />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
