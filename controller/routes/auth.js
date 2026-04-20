"use strict";

import express from "express";
import rateLimit from "express-rate-limit";
import { styleText } from "node:util";

import {
  authenticateUser,
  registerViewerUser,
  verifyUserToken,
  validateUserDataDB,
  requestPasswordReset,
  resetPasswordWithToken,
} from "../../model/authModel.js";

const router = express.Router();

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

// Max. 10 Reset-Requests pro IP in 15 Minuten. Strenger als Login, weil jeder Request eine Mail auslöst (Gmail-Quota + Spam-Schutz).
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Zu viele Anfragen. Bitte warte 15 Minuten." },
});

// API-Endpunkt, um zu prüfen, ob der User laut Cookie eingeloggt ist
router.get("/api/check-session", (req, res) => {
  if (req.session && req.session.user) {
    res.status(200).json({ loggedIn: true, user: req.session.user });
  } else {
    res.status(200).json({ loggedIn: false });
  }
});

// API-Endpunkt für Signup
router.post("/api/signup", signupLimiter, async (req, res) => {
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
router.get("/api/verify", async (req, res) => {
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
router.post("/api/login", loginLimiter, async (req, res) => {
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

// API-Endpunkt: Passwort-Reset anfordern
router.post("/api/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body || {};

  if (!email || typeof email !== "string") {
    return res.status(400).json({ success: false, message: "E-Mail fehlt." });
  }

  console.log(styleText("blue", `\nPasswort-Reset angefordert für: ${email}`));
  const result = await requestPasswordReset(email);
  // Immer 200 + generische Antwort (Enumeration-Schutz)
  res.status(200).json(result);
});

// API-Endpunkt: Passwort-Reset durchführen
router.post("/api/reset-password", forgotPasswordLimiter, async (req, res) => {
  const { token, password, confirmPassword } = req.body || {};
  const result = await resetPasswordWithToken(token, password, confirmPassword);
  if (result.success) {
    return res.status(200).json(result);
  }
  return res.status(400).json(result);
});

// API-Endpunkt für Logout
router.post("/api/logout", (req, res) => {
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

export default router;
