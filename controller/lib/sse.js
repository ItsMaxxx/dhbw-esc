"use strict";

import express from "express";

// In-Memory Voting-Status (bleibt bis Server-Neustart erhalten)
export const votingState = { votingOpen: false, resultsVisible: false };

// SSE-Clients: alle verbundenen Browser-Verbindungen
const sseClients = new Set();

// Sendet ein Event an alle verbundenen Clients
export function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(msg);
  }
}

const router = express.Router();

// API-Endpunkt: Voting-Status abfragen (öffentlich)
router.get("/api/admin/state", (req, res) => {
  res.status(200).json({
    votingOpen: votingState.votingOpen,
    resultsVisible: votingState.resultsVisible,
  });
});

// SSE-Endpunkt: Echtzeit-Updates für alle verbundenen Clients
router.get("/api/events", (req, res) => {
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

export default router;
