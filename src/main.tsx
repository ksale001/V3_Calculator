import React from "react";
import { createRoot } from "react-dom/client";
import VaultEconomicsApp from "./VaultEconomicsApp";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
const root = createRoot(rootEl);
root.render(
  <React.StrictMode>
    <VaultEconomicsApp />
  </React.StrictMode>
);
