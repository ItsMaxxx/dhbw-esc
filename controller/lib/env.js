"use strict";

import { styleText } from "node:util";

// Überprüft, ob alle benötigten ENV-Variablen gesetzt sind
export function checkAllEnv() {
  const requiredEnvVars = [
    "APP_PORT",
    "DB_PATH",
    "BASE_URL",
    "SESSION_SECRET",
    "GMAIL_EMAIL",
    "GMAIL_APP_PASSWORD",
    "CLOUDFLARED_TUNNEL_TOKEN"
  ];

  const missingEnvVars = requiredEnvVars.filter((envName) => {
    const value = process.env[envName];
    return value === undefined || value === null || value.trim() === "";
  });

  if (missingEnvVars.length > 0) {
    console.error(
      styleText("red", `Fehlende ENV-Variablen: ${missingEnvVars.join(", ")}`),
    );
    return true;
  }

  return false;
}
