import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App";
import "../../node_modules/@vscode/codicons/dist/codicon.css";

// This file is a simple wrapper around the main App component
// for the VSCode sidebar view
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
); 