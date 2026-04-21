"use strict";

import express from "express";
import { styleText } from "node:util";

import { clearAllVotes } from "../../model/voteModel.js";
import { votingState, broadcast } from "../lib/sse.js";
import { requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// API-Endpunkt: User-Voting starten
router.post("/api/admin/start-user-voting", requireAdmin, (req, res) => {
  votingState.userVotingOpen = true;
  console.log(styleText("green", "Admin: User-Voting wurde gestartet."));
  broadcast("state", votingState);
  res.status(200).json({ success: true });
});

// API-Endpunkt: User-Voting stoppen
router.post("/api/admin/stop-user-voting", requireAdmin, (req, res) => {
  votingState.userVotingOpen = false;
  console.log(styleText("green", "Admin: User-Voting wurde gestoppt."));
  broadcast("state", votingState);
  res.status(200).json({ success: true });
});

// API-Endpunkt: Jury-Voting starten
router.post("/api/admin/start-jury-voting", requireAdmin, (req, res) => {
  votingState.juryVotingOpen = true;
  console.log(styleText("green", "Admin: Jury-Voting wurde gestartet."));
  broadcast("state", votingState);
  res.status(200).json({ success: true });
});

// API-Endpunkt: Jury-Voting stoppen
router.post("/api/admin/stop-jury-voting", requireAdmin, (req, res) => {
  votingState.juryVotingOpen = false;
  console.log(styleText("green", "Admin: Jury-Voting wurde gestoppt."));
  broadcast("state", votingState);
  res.status(200).json({ success: true });
});

// API-Endpunkt: Ergebnisse freigeben
router.post("/api/admin/show-results", requireAdmin, (req, res) => {
  votingState.resultsVisible = true;
  console.log(styleText("green", "Admin: Ergebnisse wurden freigegeben."));
  broadcast("state", votingState);
  res.status(200).json({ success: true });
});

// API-Endpunkt: Ergebnisse verbergen (resultsVisible → false)
router.post("/api/admin/hide-results", requireAdmin, (req, res) => {
  votingState.resultsVisible = false;
  console.log(styleText("green", "Admin: Ergebnisse wurden verborgen."));
  broadcast("state", votingState);
  res.status(200).json({ success: true });
});

// API-Endpunkt: Alle Votes löschen
router.post("/api/admin/clear-votes", requireAdmin, async (req, res) => {
  const result = await clearAllVotes();
  if (result.success) {
    console.log(styleText("green", "Admin: Alle Votes wurden gelöscht."));
    // State mit broadcasten, damit Clients ihren my-status neu laden (Formular freischalten)
    broadcast("state", votingState);
    res.status(200).json({ success: true });
  } else {
    res.status(500).json(result);
  }
});

export default router;
