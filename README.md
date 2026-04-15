# DHBW Eurovision Cat Contest – Voting Portal

Ein vollständiges Abstimmungsportal für den DHBW-internen Eurovision Cat Contest (ESC-Parodie). Viewer können sich registrieren und abstimmen, Jury-Mitglieder haben einen separaten Login, und ein Admin steuert den gesamten Ablauf in Echtzeit.

---

## Inhaltsverzeichnis

- [Funktionsübersicht](#funktionsübersicht)
- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
- [Umgebungsvariablen (.env)](#umgebungsvariablen-env)
- [Starten der Anwendung](#starten-der-anwendung)
- [Docker-Deployment](#docker-deployment)
- [Projektstruktur](#projektstruktur)
- [Voting-Ablauf](#voting-ablauf)
- [Routen & API](#routen--api)
- [Verwendete Technologien](#verwendete-technologien)

---

## Funktionsübersicht

| Feature | Beschreibung |
|---------|-------------|
| **Viewer-Registrierung** | Selbstregistrierung mit E-Mail-Verifizierung und bcrypt-Passwort-Hashing |
| **Rollen-Login** | Getrennte Logins für Viewer, Jury und Admin |
| **Viewer-Voting** | Freie Verteilung von bis zu 20 Punkten auf beliebig viele Sänger (kein eigenes Land) |
| **Jury-Voting** | Klassisches ESC-Schema: einmalige Vergabe von 1–8, 10 und 12 Punkten |
| **Admin-Steuerung** | Voting starten, Ergebnisse freigeben, Status zurücksetzen, alle Votes löschen |
| **Echtzeit-Updates** | Server-Sent Events (SSE) – alle Clients werden sofort über Statusänderungen informiert |
| **Ergebnisberechnung** | Viewer-Rohstimmen werden pro Herkunftsland in ESC-Punkte (12/10/8/…/1) umgerechnet und mit den Jury-Punkten summiert |

---

## Voraussetzungen

| Software | Mindestversion | Windows (winget) | macOS (Homebrew) |
|----------|---------------|-----------------|-----------------|
| **Node.js** | 18.x oder höher | `winget install OpenJS.NodeJS` | `brew install node` |
| **npm** | wird mit Node.js mitgeliefert | – | – |
| **Git** | beliebig | `winget install Git.Git` | `brew install git` |

Außerdem wird ein **Gmail-Konto** mit aktivierter **2-Faktor-Authentifizierung** benötigt, um E-Mail-Verifizierungen versenden zu können (siehe [Umgebungsvariablen](#umgebungsvariablen-env)).

Für den Docker-Betrieb wird zusätzlich benötigt:

| Software | Windows (winget) | macOS (Homebrew) |
|----------|-----------------|-----------------|
| **Docker** | `winget install Docker.DockerDesktop` | `brew install --cask docker` |

---

## Installation

```bash
# 1. Repository klonen
git clone <repository-url>
cd dhbw-esc

# 2. Abhängigkeiten installieren
npm install

# 3. .env-Datei anlegen (siehe nächsten Abschnitt)
```

---

## Umgebungsvariablen (.env)

Im Projektstamm muss eine Datei namens `.env` angelegt werden. Diese Datei wird **nicht** im Repository versioniert und muss lokal erstellt werden.

Vorlage – Datei `.env` im Projektstamm anlegen:

```env
APP_PORT=<zu_öffnender_Port>
SESSION_SECRET=<langer_zufaelliger_string_min_32_zeichen>
GMAIL_EMAIL=<deine_gmail_adresse@gmail.com>
GMAIL_APP_PASSWORD=<16_zeichen_google_app_passwort>
```

### Beschreibung der Variablen

| Variable | Pflicht | Beschreibung |
|----------|---------|-------------|
| `APP_PORT` | ja | Port, auf dem der Express-Server lauscht (Standard ist `3000`) |
| `SESSION_SECRET` | ja | Geheimer Schlüssel zum Signieren von Sessions. Muss ein langer, zufälliger String sein (mind. 32 Zeichen). |
| `GMAIL_EMAIL` | ja | Gmail-Adresse, von der die Verifizierungs-E-Mails versendet werden. |
| `GMAIL_APP_PASSWORD` | ja | 16-stelliges Google App-Passwort (kein normales Kontopasswort). |

### Gmail App-Passwort erstellen

1. Google-Konto öffnen → **Sicherheit**
2. **2-Faktor-Authentifizierung** aktivieren (falls noch nicht geschehen)
3. Unter Sicherheit → **App-Passwörter** → Neue App hinzufügen
4. Den generierten 16-stelligen Code als `GMAIL_APP_PASSWORD` ohne Leerzeichen eintragen

> **Achtung:** Die `.env`-Datei enthält sensible Zugangsdaten und darf niemals in ein öffentliches Repository eingecheckt werden. Deshalb wird sie von der .gitignore ignoriert.

---

## Starten der Anwendung

```bash
npm start
```

Der Server ist anschließend unter `http://localhost:<APP_PORT>` erreichbar (Standard: `http://localhost:3000`).

Beim Start prüft die Anwendung automatisch, ob alle Umgebungsvariablen gesetzt sind. Fehlt eine Variable, wird der Prozess mit einer Fehlermeldung beendet.

---

## Docker-Deployment

> Wenn Node.js und npm global installiert sind, reicht `npm start` zum Ausführen der Anwendung. Andernfalls kann die App über Docker betrieben werden – einzige Voraussetzung ist dann eine laufende Docker-Installation.

### Image bauen

```bash
docker build -t dhbw-esc .
```

### Container starten

```bash
docker run -p 3000:3000 \
  -e APP_PORT=3000 \
  -e SESSION_SECRET=<langer_zufaelliger_string> \
  -e GMAIL_EMAIL=<deine_gmail@gmail.com> \
  -e GMAIL_APP_PASSWORD=<16_zeichen_app_passwort> \
  dhbw-esc
```

Alternativ kann eine `.env`-Datei übergeben werden:

```bash
docker run -p 3000:3000 --env-file .env dhbw-esc
```

---

## Projektstruktur

```
dhbw-esc/
├── assets/
│   ├── css/                     # Stylesheets (pro Seite + globale Stile)
│   ├── images/
│   │   ├── flags/               # Flaggen-Icons der teilnehmenden Länder
│   │   └── *.png                # Logo und weitere Bilder
│   └── js/                      # Client-seitiges JavaScript (auth, voting, …)
├── controller/
│   └── app.js                   # Express-Server – Routen, Middleware, API-Endpunkte
├── model/
│   ├── authModel.js             # Registrierung, Login, E-Mail-Verifizierung
│   ├── database.js              # Alle SQLite-Datenbankabfragen
│   ├── esc-database.db          # SQLite-Datenbankdatei
│   ├── mailer.js                # E-Mail-Versand via Nodemailer/Gmail
│   └── voteModel.js             # Voting-Logik & Ergebnisberechnung
├── view/
│   ├── dhbw-esc.html            # Startseite
│   ├── login.html               # Login (Viewer & Jury)
│   ├── signup.html              # Registrierung für Viewer
│   ├── voting.html              # Abstimmungsseite (Viewer, Jury & Ergebnisse)
│   └── rechtliches/             # Impressum, Datenschutz, AGB, Cookie-Richtlinie
├── .env                         # Umgebungsvariablen (nicht versioniert)
├── Dockerfile                   # Docker-Konfiguration
└── package.json                 # Abhängigkeiten & Skripte
```

---

## Voting-Ablauf

### Rollen

| Rolle | Zugang | Funktion |
|-------|--------|----------|
| **Viewer** | Selbstregistrierung + E-Mail-Verifizierung | Stimmen frei verteilen |
| **Jury** | Fester Login in der Datenbank | ESC-Punkte vergeben |
| **Admin** | Sonderfall des Jury-Logins (`country = "Admin"`) | Voting steuern |

### Ablauf (chronologisch)

1. **Admin startet das Voting** → `POST /api/admin/start-voting`
   - Alle verbundenen Clients werden per SSE sofort informiert.
   - Die Voting-Oberfläche wird für Viewer und Jury freigeschaltet.

2. **Viewer geben ihre Stimmen ab** → `POST /api/vote/viewer`
   - Bis zu **20 Punkte** können frei auf beliebig viele Sänger verteilt werden.
   - Eine Abstimmung für das eigene Heimatland ist gesperrt.
   - Wiederholte Abgabe überschreibt die vorherige.

3. **Jury vergibt ihre Punkte** → `POST /api/vote/jury`
   - Klassisches ESC-Schema: **1, 2, 3, 4, 5, 6, 7, 8, 10, 12** Punkte.
   - Jeder Punktewert und jeder Sänger darf nur einmal verwendet werden.
   - Wiederholte Abgabe überschreibt die vorherige.

4. **Admin gibt die Ergebnisse frei** → `POST /api/admin/show-results`
   - Ab diesem Moment können alle Nutzer die Rangliste einsehen.

### Ergebnisberechnung

Die Gesamtpunktzahl eines Sängers setzt sich zusammen aus:

- **Jury-Punkte:** direkte Summe aller vergebenen ESC-Punkte aller Jury-Länder.
- **Viewer-Punkte:** Die Rohstimmen werden *pro Herkunftsland* nach Höhe sortiert. Das Land mit den meisten Rohstimmen erhält 12 Punkte, Platz 2 erhält 10, dann 8, 7, 6, 5, 4, 3, 2, 1 – analog zum echten ESC-Telefonvoting.

---

## Routen & API

### Seiten

| Route | Beschreibung |
|-------|-------------|
| `GET /` | Startseite |
| `GET /login` | Login-Seite |
| `GET /signup` | Registrierungsseite |
| `GET /voting` | Abstimmungsseite |
| `GET /impressum` | Impressum |
| `GET /datenschutz` | Datenschutzerklärung |
| `GET /cookie-richtlinie` | Cookie-Richtlinie |
| `GET /agb` | Allgemeine Geschäftsbedingungen |

### Auth-API

| Methode | Route | Beschreibung |
|---------|-------|-------------|
| `GET` | `/api/check-session` | Prüft, ob eine aktive Session vorhanden ist |
| `POST` | `/api/signup` | Neuen Viewer-Account registrieren |
| `GET` | `/api/verify?token=<token>` | E-Mail-Adresse verifizieren und Account freischalten |
| `POST` | `/api/login` | Einloggen (Viewer, Jury oder Admin) |
| `POST` | `/api/logout` | Session beenden und ausloggen |

### Voting-API

| Methode | Route | Beschreibung | Zugriff |
|---------|-------|-------------|---------|
| `GET` | `/api/singers` | Alle Sänger inkl. Länderdaten laden | öffentlich |
| `GET` | `/api/events` | SSE-Stream für Echtzeit-Statusupdates | öffentlich |
| `GET` | `/api/admin/state` | Aktuellen Voting-Status abfragen | öffentlich |
| `POST` | `/api/vote/viewer` | Viewer-Stimmen abgeben | Viewer (eingeloggt) |
| `POST` | `/api/vote/jury` | Jury-Punkte abgeben | Jury (eingeloggt) |
| `GET` | `/api/results` | Ergebnisse abrufen | Admin immer, sonst nur nach Freigabe |

### Admin-API

Alle Admin-Endpunkte erfordern eine aktive Session mit `role = "admin"`.

| Methode | Route | Beschreibung |
|---------|-------|-------------|
| `POST` | `/api/admin/start-voting` | Voting starten (alle Clients per SSE benachrichtigen) |
| `POST` | `/api/admin/show-results` | Ergebnisse für alle freigeben |
| `POST` | `/api/admin/reset-state` | Voting-Status zurücksetzen (`votingOpen` + `resultsVisible` → false) |
| `POST` | `/api/admin/clear-votes` | Alle abgegebenen Stimmen aus der Datenbank löschen |

---

## Verwendete Technologien

| Paket | Zweck |
|-------|-------|
| [Express](https://expressjs.com) | Web-Framework |
| [express-session](https://github.com/expressjs/session) | Session-Management |
| [sqlite3](https://github.com/TryGhost/node-sqlite3) | Datenbank |
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | Passwort-Hashing |
| [nodemailer](https://nodemailer.com) | E-Mail-Versand |
| [dotenv](https://github.com/motdotla/dotenv) | Umgebungsvariablen |
| SSE (native) | Echtzeit-Push vom Server an alle Clients |
