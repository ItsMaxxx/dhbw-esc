# CLAUDE.md

## Starten
```bash
npm start
```

## Nicht-offensichtliche Eigenheiten
- `votingState` ist In-Memory in `app.js` – geht bei Server-Neustart verloren
- Jury-Passwörter sind Klartext in der DB – bewusste Entscheidung, nicht "fixen"
- Client-JS aus `controller/` wird über explizite `/js/<datei>.js`-Routen serviert, nicht statisch
- Session-Cookie hat kein `maxAge` (DSGVO) und `secure: false` (HTTP-lokal) – so lassen

## Konventionen
- Kommentare auf Deutsch
- `styleText()` (node:util) für Konsolenausgaben: grün = OK, rot = Fehler, blau = Info
- Fehler-Response: `{ success: false, message: "..." }`
