"use strict";

import express from "express";
import { styleText } from "node:util";

import {
  fetchAllSingers,
  submitViewerVotes,
  submitJuryVotes,
  calculateResults,
  getViewerStatus,
  getJuryStatus,
} from "../../model/voteModel.js";

import { votingState, broadcast } from "../lib/sse.js";

const router = express.Router();

// API-Endpunkt: Alle Sänger für Voting-/Results-Liste
router.get("/api/singers", async (req, res) => {
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

// API-Endpunkt: Eigener Vote-Status (Viewer: bereits vergebene Punkte, Jury: hasVoted)
router.get("/api/vote/my-status", async (req, res) => {
  const user = req.session && req.session.user;
  if (!user) {
    return res.status(401).json({ success: false, message: "Bitte einloggen." });
  }
  try {
    if (user.role === "viewer") {
      if (!user.id) return res.status(400).json({ success: false, message: "Session ohne User-ID." });
      const status = await getViewerStatus(user.id);
      return res.status(200).json({ success: true, role: "viewer", ...status });
    }
    if (user.role === "jury") {
      const status = await getJuryStatus(user.country);
      return res.status(200).json({ success: true, role: "jury", ...status });
    }
    return res.status(200).json({ success: true, role: user.role });
  } catch (err) {
    console.error(styleText("red", "Fehler bei /api/vote/my-status: " + err.message));
    return res.status(500).json({ success: false, message: "Status konnte nicht geladen werden." });
  }
});

// API-Endpunkt: Viewer-Stimmen speichern
router.post("/api/vote/viewer", async (req, res) => {
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
router.post("/api/vote/jury", async (req, res) => {
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
router.get("/api/results", async (req, res) => {
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

export default router;
