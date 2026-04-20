"use strict";

// Auth-Middleware: nur eingeloggt, Rolle egal
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: "Bitte einloggen." });
  }
  next();
}

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

// Jury-Middleware
export function requireJury(req, res, next) {
  const user = req.session && req.session.user;
  if (!user || user.role !== "jury") {
    return res.status(403).json({ success: false, message: "Kein Zugriff." });
  }
  next();
}
