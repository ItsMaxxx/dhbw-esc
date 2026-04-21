"use strict";

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Statische Dateien (CSS, Bilder)
router.use("/assets/css", express.static(path.join(__dirname, "../../assets/css")));
router.use("/assets/images", express.static(path.join(__dirname, "../../assets/images")));

// Frontend-JS wird nicht statisch ausgeliefert, sondern über explizite Routen
const jsFiles = [
  "headerSession.js",
  "cookie.js",
  "header.js",
  "footer.js",
  "news-cards.js",
  "login.js",
  "country-dropdowns.js",
  "signup.js",
  "voting.js",
  "user.js",
  "reset-password.js",
];
for (const file of jsFiles) {
  router.get(`/js/${file}`, (req, res) => {
    // Kein Caching: sonst sehen Clients nach Deploys noch die alte JS-Version
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.sendFile(path.join(__dirname, "../frontend", file));
  });
}

// Statische Seiten
const staticPages = [
  ["/",                 "dhbw-esc.html"],
  ["/login",            "login.html"],
  ["/signup",           "signup.html"],
  ["/reset-password",   "reset-password.html"],
  ["/voting",           "voting.html"],
  ["/user",             "user.html"],
  ["/impressum",        "rechtliches/impressum.html"],
  ["/datenschutz",      "rechtliches/datenschutz.html"],
  ["/cookie-richtlinie","rechtliches/cookie-richtlinie.html"],
  ["/agb",              "rechtliches/agb.html"],
];
for (const [route, file] of staticPages) {
  router.get(route, (req, res) => {
    res.status(200).sendFile(path.join(__dirname, `../../view/${file}`));
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
  router.get(`/news/${slug}`, (req, res) => {
    res
      .status(200)
      .sendFile(path.join(__dirname, `../../view/news/${slug}.html`));
  });
  router.get(`/news/${slug}.html`, (req, res) => res.redirect(301, `/news/${slug}`));
});

export default router;
