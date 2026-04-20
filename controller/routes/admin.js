"use strict";

import express from "express";
import { styleText } from "node:util";

import { clearAllVotes } from "../../model/voteModel.js";
import { votingState, broadcast } from "../lib/sse.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// API-Endpunkt: Voting starten
router.post("/api/admin/start-voting", requireAdmin, (req, res) => {
  votingState.votingOpen = true;
  console.log(styleText("green", "Admin: Voting wurde gestartet."));
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

// API-Endpunkt: Voting-Status zurücksetzen (votingOpen + resultsVisible → false)
router.post("/api/admin/reset-state", requireAdmin, (req, res) => {
  votingState.votingOpen = false;
  votingState.resultsVisible = false;
  console.log(styleText("green", "Admin: Voting-Status wurde zurückgesetzt."));
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
