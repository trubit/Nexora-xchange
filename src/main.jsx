import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProvider } from "./Components/common/AppContext";
import QueryProvider from "./providers/QueryProvider";
// Import themeStore FIRST — its module-level IIFE applies the theme class
// immediately, before any CSS or React renders, eliminating flash-of-wrong-theme.
import "./store/themeStore";
import "./styles/theme.css";
import "./styles/globals.css";
import App from "./App.jsx";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryProvider>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </QueryProvider>
  </StrictMode>,
);
