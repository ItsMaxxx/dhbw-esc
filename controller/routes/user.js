"use strict";

import express from "express";
import { styleText } from "node:util";

import {
  getViewerProfile,
  updateViewerProfile,
  deleteViewerAccount,
  getAllCountries,
  validateUserDataDB,
} from "../../model/authModel.js";

import { requireViewer } from "../middleware/auth.js";

const router = express.Router();

// API-Endpunkt: Alle Länder mit Landcode und Vorwahl (für Dropdowns)
router.get("/api/countries", async (req, res) => {
  try {
    const countries = await getAllCountries();
    res.status(200).json(countries);
  } catch (err) {
    console.error(styleText("red", "Fehler beim Laden der Länder: " + err.message));
    res.status(500).json({ success: false, message: "Länder konnten nicht geladen werden." });
  }
});

// API-Endpunkt: Viewer-Profil laden
router.get("/api/user/profile", requireViewer, async (req, res) => {
  const profile = await getViewerProfile(req.session.user.id);
  if (!profile) return res.status(404).json({ success: false });
  res.status(200).json({ success: true, profile });
});

// API-Endpunkt: Viewer-Profil aktualisieren
router.post("/api/user/update", requireViewer, async (req, res) => {
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
  // Kollisions-/Validierungsfehler → 400, interner Fehler → 500
  const status = result.message === "Diese E-Mail ist bereits registriert." ? 400 : 500;
  return res.status(status).json(result);
});

// API-Endpunkt: Viewer-Account löschen
router.delete("/api/user/delete", requireViewer, async (req, res) => {
  const user = req.session.user;

  const result = await deleteViewerAccount(user.id);
  if (!result.success) return res.status(500).json(result);

  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    console.log(styleText("green", `Viewer-Account ID=${user.id} gelöscht.`));
    res.status(200).json({ success: true });
  });
});

export default router;
