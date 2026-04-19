"use strict";

// Daten aus der .env laden und überprüfen
import dotenv from "dotenv";
dotenv.config({ override: true, debug: false, quiet: true, encoding: "utf8" });
// override -> Die bestehenden Systemvariablen (falls vorhanden) werden immer mit den .env-Werten überschrieben
// debug -> Gibt bei Fehlern mehr Informationen über die geladenen .env-Variablen aus

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { execFileSync } from "child_process";
// execFileSync wird genutzt, um in app.listen() Fehlerinformationen auszugeben, wenn der Port nicht frei ist
import { styleText } from "node:util";

// Importiere die Authentifizierungslogik aus dem Model
import {
  authenticateUser,
  registerViewerUser,
  verifyUserToken,
  getViewerProfile,
  updateViewerProfile,
  deleteViewerAccount,
  getAllCountries,
  validateUserDataDB,
} from "../model/authModel.js";

// Importiere die Voting-Logik aus dem Model
import {
  fetchAllSingers,
  submitViewerVotes,
  submitJuryVotes,
  calculateResults,
  clearAllVotes,
} from "../model/voteModel.js";

// In-Memory Voting-Status (bleibt bis Server-Neustart erhalten)
const votingState = { votingOpen: false, resultsVisible: false };

// SSE-Clients: alle verbundenen Browser-Verbindungen
const sseClients = new Set();

// Sendet ein Event an alle verbundenen Clients
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(msg);
  }
}

if (checkAll_ENV()) {
  throw new Error("Fehlende oder ungültige ENV-Variablen in der .env-Datei.");
}

const app = express();
const port = process.env.APP_PORT;

// Middleware, um JSON-Daten aus dem Frontend (POST-Requests) lesen zu können
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session-Konfiguration - Weil DSGVO
app.use(
  session({
    secret: process.env.SESSION_SECRET, // In der Praxis ein langes, zufälliges Passwort
    resave: false, // Session wird nur neu gespeichert, wenn sich die Daten geändert haben
    saveUninitialized: false, // WICHTIG: Erstellt erst ein Cookie, wenn man explizit Daten (Login) speichert
    cookie: {
      sameSite: 'strict', // Das blockiert Cookie-Mitschicken bei Cross-Site-Requests
      httpOnly: true, // Verhindert XSS-Angriffe via JavaScript
      secure: false, // Bei localhost auf false. Bei echtem HTTPS auf true!
      // maxAge fehlt absichtlich: Dadurch ist es ein Session-Cookie (löscht sich beim Schließen)
    },
  }),
);

//Ist der Port verfügbar?
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

//
// 1. Zugriff auf statische Dateien (CSS, Bilder, Frontend-JS)
//

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/assets/css", express.static(path.join(__dirname, "../assets/css")));
app.use(
  "/assets/images",
  express.static(path.join(__dirname, "../assets/images")),
);

// Frontend-JS wird nicht statisch ausgeliefert, sondern über explizite Routen
const jsFiles = [
  "auth.js",
  "cookie.js",
  "header.js",
  "footer.js",
  "news-cards.js",
  "login.js",
  "validate_userdata.js",
  "signup.js",
  "voting.js",
  "user.js",
];
for (const file of jsFiles) {
  app.get(`/js/${file}`, (req, res) => {
    res.sendFile(path.join(__dirname, file));
  });
}

//
// 2. GET-Routen
//

const staticPages = [
  ["/",                 "dhbw-esc.html"],
  ["/login",            "login.html"],
  ["/signup",           "signup.html"],
  ["/voting",           "voting.html"],
  ["/user",             "user.html"],
  ["/impressum",        "rechtliches/impressum.html"],
  ["/datenschutz",      "rechtliches/datenschutz.html"],
  ["/cookie-richtlinie","rechtliches/cookie-richtlinie.html"],
  ["/agb",              "rechtliches/agb.html"],
];
for (const [route, file] of staticPages) {
  app.get(route, (req, res) => {
    logClientInfo(req);
    res.status(200).sendFile(path.join(__dirname, `../view/${file}`));
  });
}

// News-Artikel als statische HTML-Dateien ausliefern
const newsSlugs = [
  "vienna-watch-alongs-2026",
  "non-stop-hits-2026",
  "vienna-guide-2026",
  "fan-favorites-2026",
  "community-picks-2026",
  "behind-the-votes-2026",
];
newsSlugs.forEach((slug) => {
  const handler = (req, res) => {
    logClientInfo(req);
    res
      .status(200)
      .sendFile(path.join(__dirname, `../view/news/${slug}.html`));
  };
  app.get(`/news/${slug}`, handler);
  app.get(`/news/${slug}.html`, (req, res) => res.redirect(301, `/news/${slug}`));
});

//
// 3. API-Endpunkte für Backend-Logik (POST)
//

// API-Endpunkt, um zu prüfen, ob der User laut Cookie eingeloggt ist
app.get("/api/check-session", (req, res) => {
  if (req.session && req.session.user) {
    res.status(200).json({ loggedIn: true, user: req.session.user });
  } else {
    res.status(200).json({ loggedIn: false });
  }
});

// API-Endpunkt: Alle Länder mit Landcode und Vorwahl (für Dropdowns)
app.get("/api/countries", async (req, res) => {
  try {
    const countries = await getAllCountries();
    res.status(200).json(countries);
  } catch (err) {
    console.error(styleText("red", "Fehler beim Laden der Länder: " + err.message));
    res.status(500).json({ success: false, message: "Länder konnten nicht geladen werden." });
  }
});

// Max. 60 Signup-Versuche pro IP in 5 Minuten (Klassensetting: ~20 Leute, je ~3 Versuche)
const signupLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Zu viele Registrierungsversuche. Bitte warte 5 Minuten." },
});

// Max. 100 Login-Versuche pro IP in 5 Minuten (Klassensetting: ~20 Leute, je ~5 Versuche)
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Zu viele Login-Versuche. Bitte warte 5 Minuten." },
});

// API-Endpunkt für Signup
app.post("/api/signup", signupLimiter, async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phonePrefix,
    phoneNumber,
    birthDate,
    gender,
    countryCode,
    password,
    confirmPassword,
    isOver18,
    acceptedTerms,
  } = req.body;

  console.log(
    styleText("blue", `\nSign-up-Versuch empfangen: E-Mail=${email}`),
  );

  // Serverseitige Validierung (immer nötig, auch wenn Frontend prüft)
  const signupValidation = await validateUserDataDB(
    { firstName, lastName, email, phonePrefix, phoneNumber, birthDate, gender, countryCode, password, confirmPassword },
    true
  );
  if (!signupValidation.valid) {
    console.log(styleText("red", `Registrierung abgelehnt: ${signupValidation.message}`));
    return res.status(400).json({ success: false, message: signupValidation.message });
  }

  if (!isOver18 || !acceptedTerms) {
    console.log(styleText("red", "Registrierung abgelehnt: 18+ und Nutzungsbedingungen nicht bestätigt."));
    return res.status(400).json({
      success: false,
      message: "Du musst mindestens 18 Jahre alt sein und die Nutzungsbedingungen akzeptieren.",
    });
  }

  const userData = {
    firstName,
    lastName,
    email,
    phonePrefix,
    phoneNumber,
    birthDate,
    gender,
    countryCode,
    password,
    isOver18: isOver18 === "true" || isOver18 === true,
    acceptedTerms: acceptedTerms === "true" || acceptedTerms === true,
  };

  const result = await registerViewerUser(userData);

  if (result.success) {
    console.log(
      styleText("green", `Registrierung erfolgreich für E-Mail=${email}`),
    );
    // Kein automatischer Login -> User soll sich bewusst einloggen
    return res.status(201).json({ success: true });
  } else {
    console.log(
      styleText("red", `Registrierung fehlgeschlagen: ${result.message}`),
    );
    return res.status(400).json(result);
  }
});

// API-Endpunkt für die Verifikation beim Signup
app.get("/api/verify", async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(404).send("Kein Token gefunden.");
  }

  const result = await verifyUserToken(token);

  if (result.success) {
    // Leitet den User auf die Login-Seite weiter
    res.redirect("/login");
  } else {
    res
      .status(400)
      .send("Der Verifizierungslink ist ungültig oder bereits abgelaufen.");
  }
});

// API-Endpunkt für Login
app.post("/api/login", loginLimiter, async (req, res) => {
  const { role, email, password } = req.body;

  console.log(
    styleText(
      "blue",
      `\nLogin-Versuch empfangen: Rolle = ${role}, E-Mail = ${email}`,
    ),
  );

  const result = await authenticateUser(role, email, password);

  if (result.success) {
    // Sicheres Speichern der Nutzerdaten auf dem Server in der Session
    req.session.user = {
      role: result.role,
      id: result.id || null,
      country: result.country || null,
      firstName: result.firstName || null,
      lastName: result.lastName || null,
    };
    console.log(
      styleText("green", `Login erfolgreich für: ${req.session.user.country}`),
    );
    res.status(200).json({ success: true });
  } else {
    console.log(styleText("red", `Login fehlgeschlagen: ${result.message}`));
    res.status(401).json(result);
  }
});

// API-Endpunkt für Logout
app.post("/api/logout", (req, res) => {
  // Session-Infos VOR dem Destroy auslesen
  const sessionId = req.sessionID;
  const user = req.session && req.session.user;

  if (user) {
    console.log(
      styleText(
        "blue",
        `Logout angefordert für Session ${sessionId} (Role=${user.role}, Country=${user.country})`,
      ),
    );
  } else {
    console.log(
      styleText(
        "blue",
        `Logout ohne aktive User-Session angefordert (SessionID=${sessionId})`,
      ),
    );
  }

  req.session.destroy((err) => {
    if (err) {
      console.log(
        styleText(
          "red",
          `Fehler beim Zerstören der Session ${sessionId}: ${err.message}`,
        ),
      );
      return res.status(500).json({ success: false });
    }

    res.clearCookie("connect.sid"); // Session-Cookie beim Client löschen
    console.log(
      styleText(
        "green",
        `Session ${sessionId} wurde zerstört und User ausgeloggt.`,
      ),
    );
    res.status(200).json({ success: true });
  });
});

// API-Endpunkt: Viewer-Profil laden
app.get("/api/user/profile", requireViewer, async (req, res) => {
  const profile = await getViewerProfile(req.session.user.id);
  if (!profile) return res.status(404).json({ success: false });
  res.status(200).json({ success: true, profile });
});

// API-Endpunkt: Viewer-Profil aktualisieren
app.post("/api/user/update", requireViewer, async (req, res) => {
  const user = req.session.user;

  const {
    firstName,
    lastName,
    email,
    phonePrefix,
    phoneNumber,
    birthDate,
    gender,
    countryCode,
    password,
    confirmPassword,
  } = req.body;

  const updateValidation = await validateUserDataDB(
    { firstName, lastName, email, phonePrefix, phoneNumber, birthDate, gender, countryCode, password, confirmPassword },
    false
  );
  if (!updateValidation.valid) {
    return res.status(400).json({ success: false, message: updateValidation.message });
  }

  const result = await updateViewerProfile(user.id, {
    firstName,
    lastName,
    email,
    phonePrefix,
    phoneNumber,
    birthDate,
    gender,
    countryCode,
    password,
  });

  if (result.success) {
    req.session.user.firstName = firstName;
    req.session.user.lastName = lastName;
    req.session.user.country = countryCode;
    return res.status(200).json({ success: true });
  }
  return res.status(500).json(result);
});

// API-Endpunkt: Viewer-Account löschen
app.delete("/api/user/delete", requireViewer, async (req, res) => {
  const user = req.session.user;

  const result = await deleteViewerAccount(user.id);
  if (!result.success) return res.status(500).json(result);

  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    console.log(styleText("green", `Viewer-Account ID=${user.id} gelöscht.`));
    res.status(200).json({ success: true });
  });
});

// API-Endpunkt: Alle Sänger für Voting-/Results-Liste
app.get("/api/singers", async (req, res) => {
  try {
    const singers = await fetchAllSingers();
    res.status(200).json(singers);
  } catch (err) {
    console.error(
      styleText("red", "Fehler beim Laden der Sänger: " + err.message),
    );
    res.status(500).json({
      success: false,
      message: "Sänger konnten nicht geladen werden.",
    });
  }
});

// API-Endpunkt: Voting-Status abfragen (öffentlich)
app.get("/api/admin/state", (req, res) => {
  res.status(200).json({
    votingOpen: votingState.votingOpen,
    resultsVisible: votingState.resultsVisible,
  });
});

// SSE-Endpunkt: Echtzeit-Updates für alle verbundenen Clients
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Aktuellen State sofort beim Verbinden senden
  res.write(`event: state\ndata: ${JSON.stringify(votingState)}\n\n`);

  sseClients.add(res);

  // Heartbeat alle 25s, damit die Verbindung nicht abbricht
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Admin-Middleware
function requireAdmin(req, res, next) {
  const user = req.session && req.session.user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Kein Zugriff." });
  }
  next();
}

// Viewer-Middleware
function requireViewer(req, res, next) {
  const user = req.session && req.session.user;
  if (!user || user.role !== "viewer") {
    return res.status(401).json({ success: false, message: "Nicht eingeloggt." });
  }
  next();
}

// API-Endpunkt: Voting starten
app.post("/api/admin/start-voting", requireAdmin, (req, res) => {
  votingState.votingOpen = true;
  console.log(styleText("green", "Admin: Voting wurde gestartet."));
  broadcast("state", votingState);
  res.status(200).json({ success: true });
});

// API-Endpunkt: Ergebnisse freigeben
app.post("/api/admin/show-results", requireAdmin, (req, res) => {
  votingState.resultsVisible = true;
  console.log(styleText("green", "Admin: Ergebnisse wurden freigegeben."));
  broadcast("state", votingState);
  res.status(200).json({ success: true });
});

// API-Endpunkt: Voting-Status zurücksetzen (votingOpen + resultsVisible → false)
app.post("/api/admin/reset-state", requireAdmin, (req, res) => {
  votingState.votingOpen = false;
  votingState.resultsVisible = false;
  console.log(styleText("green", "Admin: Voting-Status wurde zurückgesetzt."));
  broadcast("state", votingState);
  res.status(200).json({ success: true });
});

// API-Endpunkt: Alle Votes löschen
app.post("/api/admin/clear-votes", requireAdmin, async (req, res) => {
  const result = await clearAllVotes();
  if (result.success) {
    console.log(styleText("green", "Admin: Alle Votes wurden gelöscht."));
    res.status(200).json({ success: true });
  } else {
    res.status(500).json(result);
  }
});

// API-Endpunkt: Viewer-Stimmen speichern
app.post("/api/vote/viewer", async (req, res) => {
  const user = req.session && req.session.user;
  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Bitte einloggen." });
  }
  if (user.role !== "viewer") {
    return res.status(403).json({
      success: false,
      message: "Nur Zuschauer dürfen hier abstimmen.",
    });
  }
  if (!votingState.votingOpen) {
    return res
      .status(403)
      .json({ success: false, message: "Das Voting hat noch nicht begonnen!" });
  }
  if (!user.id) {
    return res.status(400).json({
      success: false,
      message: "Session ohne User-ID, bitte neu einloggen.",
    });
  }

  const { votes } = req.body || {};
  const result = await submitViewerVotes(user.id, user.country, votes);
  if (result.success) {
    broadcast("votes", {});
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
});

// API-Endpunkt: Jury-Stimmen speichern
app.post("/api/vote/jury", async (req, res) => {
  const user = req.session && req.session.user;
  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Bitte einloggen." });
  }
  if (user.role !== "jury") {
    return res.status(403).json({
      success: false,
      message: "Nur Jury-Mitglieder dürfen hier abstimmen.",
    });
  }
  if (!votingState.votingOpen) {
    return res
      .status(403)
      .json({ success: false, message: "Das Voting hat noch nicht begonnen!" });
  }

  const { votes } = req.body || {};
  const result = await submitJuryVotes(user.country, votes);
  if (result.success) {
    broadcast("votes", {});
    res.status(200).json(result);
  } else {
    res.status(400).json(result);
  }
});

// API-Endpunkt: Ergebnisse (Jury + Viewer-Punkte pro Sänger)
app.get("/api/results", async (req, res) => {
  const user = req.session && req.session.user;
  const isAdmin = user && user.role === "admin";
  if (!votingState.resultsVisible && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: "Die Ergebnisse wurden noch nicht freigegeben.",
    });
  }
  try {
    const results = await calculateResults();
    res.status(200).json(results);
  } catch (err) {
    console.error(
      styleText("red", "Fehler beim Berechnen der Ergebnisse: " + err.message),
    );
    res.status(500).json({
      success: false,
      message: "Ergebnisse konnten nicht berechnet werden.",
    });
  }
});

//
// 4. Hilfsfunktionen
//

// Loggt die Client-Informationen (IP, OS, Browser) in der Konsole
function logClientInfo(req) {
  let clientIp = req.ip || req.socket.remoteAddress;
  clientIp = clientIp.replace("::ffff:", ""); // Liest die IP-Adresse des Clients
  const rawUserAgent = req.headers["user-agent"];
  const shortDevice = getShortDeviceInfo(rawUserAgent); //Liest den Gerätetyp ("OS: Windows mit Chrome")
  const route = req.originalUrl; // Liest die aufgerufene URL aus ("/voting")

  console.log(
    `${styleText("blue", "Aufruf")} ➔ IP: ${clientIp} ➔ OS: ${shortDevice}" ${styleText("blue", "für")} "${route}"`,
  );
}

// Liefert den Gerätetyp zurück ("OS: Windows mit Chrome")
function getShortDeviceInfo(uaString) {
  if (!uaString) return "Unbekannt";
  let browser = "Unbekannter Browser";
  let os = "Unbekanntes OS";

  if (uaString.includes("OPR/") || uaString.includes("Opera"))
    browser = "Opera";
  else if (uaString.includes("Edg/")) browser = "Edge";
  else if (uaString.includes("Chrome/")) browser = "Chrome";
  else if (uaString.includes("Firefox/")) browser = "Firefox";
  else if (uaString.includes("Safari/")) browser = "Safari";

  if (uaString.includes("Windows")) os = "Windows";
  else if (uaString.includes("Mac OS")) os = "macOS";
  else if (uaString.includes("Android")) os = "Android";
  else if (uaString.includes("iPhone") || uaString.includes("iPad")) os = "iOS";
  else if (uaString.includes("Linux")) os = "Linux";

  return `${os} mit ${browser}`;
}

// Überprüft, ob alle benötigten ENV-Variablen gesetzt sind
function checkAll_ENV() {
  const requiredEnvVars = [
    "APP_PORT",
    "SESSION_SECRET",
    "GMAIL_EMAIL",
    "GMAIL_APP_PASSWORD",
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
