"use strict";

// Admin-Middleware
export function requireAdmin(req, res, next) {
  const user = req.session && req.session.user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Kein Zugriff." });
  }
  next();
}

// Viewer-Middleware
export function requireViewer(req, res, next) {
  const user = req.session && req.session.user;
  if (!user || user.role !== "viewer") {
    return res.status(401).json({ success: false, message: "Nicht eingeloggt." });
  }
  next();
}
