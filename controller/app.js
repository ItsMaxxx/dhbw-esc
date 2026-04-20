"use strict";

// Daten aus der .env laden und überprüfen
import dotenv from "dotenv";
dotenv.config({ override: true, debug: false, quiet: true, encoding: "utf8" });
// override -> Die bestehenden Systemvariablen (falls vorhanden) werden immer mit den .env-Werten überschrieben
// debug -> Gibt bei Fehlern mehr Informationen über die geladenen .env-Variablen aus

import express from "express";
import { execFileSync } from "child_process";
// execFileSync wird genutzt, um in app.listen() Fehlerinformationen auszugeben, wenn der Port nicht frei ist
import { styleText } from "node:util";

import { checkAllEnv } from "./lib/env.js";
import sessionMiddleware from "./middleware/session.js";
import sseRouter from "./lib/sse.js";
import staticRouter from "./routes/static.js";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/user.js";
import votingRouter from "./routes/voting.js";
import adminRouter from "./routes/admin.js";

if (checkAllEnv()) {
  throw new Error("Fehlende oder ungültige ENV-Variablen in der .env-Datei.");
}

const app = express();
const port = process.env.APP_PORT;

// Middleware, um JSON-Daten aus dem Frontend (POST-Requests) lesen zu können
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session-Konfiguration - Weil DSGVO
app.use(sessionMiddleware);

// Router einhängen
app.use(staticRouter);   // Statische Seiten + Assets + Frontend-JS
app.use(authRouter);     // Signup, Login, Logout, Verify, Passwort-Reset, Session-Check
app.use(userRouter);     // Viewer-Profil, Länder-Dropdown
app.use(votingRouter);   // Sänger, Vote-Abgabe, Vote-Status, Ergebnisse
app.use(adminRouter);    // Admin-Steuerung (Voting öffnen, Ergebnisse, Reset, Clear)
app.use(sseRouter);      // SSE-Echtzeit-Events + öffentlicher State-Endpoint

// Ist der Port verfügbar?
const server = app.listen(port, () => {
  console.log(styleText("green", `Server ist bereit auf Port ${port}`));
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(styleText("red", `Port ${port} ist bereits belegt.`));
    try {
      // Windows → netstat, sonst (macOS/Linux) → lsof
      const info =
        process.platform === "win32"
          ? execFileSync("netstat", ["-ano"])
              .toString()
              .split("\n")
              .filter((l) => l.includes(`:${port}`))
              .join("\n")
              .trim()
          : execFileSync("lsof", ["-i", `:${port}`])
              .toString()
              .trim();
      console.error(styleText("yellow", `Belegender Prozess:\n${info}`));
    } catch {
      console.error(
        styleText("yellow", "Prozess-Info konnte nicht ermittelt werden."),
      );
    }
    process.exit(1);
  } else {
    throw err;
  }
});
