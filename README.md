# DHBW Eurovision Cat Contest – Voting Portal

Ein Abstimmungsportal für den DHBW-internen Eurovision Cat Contest (ESC-Parodie). Viewer können sich registrieren und abstimmen, Jury-Mitglieder haben einen separaten Login.

---

## Inhaltsverzeichnis

- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
- [Umgebungsvariablen (.env)](#umgebungsvariablen-env)
- [Starten der Anwendung](#starten-der-anwendung)
- [Docker-Deployment](#docker-deployment)
- [Projektstruktur](#projektstruktur)
- [Routen & API](#routen--api)

---

## Voraussetzungen

Folgende Software muss vor der Installation auf dem System installiert sein:

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
APP_PORT=3000
SESSION_SECRET=<langer_zufaelliger_string_min_32_zeichen>
GMAIL_EMAIL=<deine_gmail_adresse@gmail.com>
GMAIL_APP_PASSWORD=<16_zeichen_google_app_passwort>
```

### Beschreibung der Variablen

| Variable | Pflicht | Beschreibung |
|----------|---------|-------------|
| `APP_PORT` | ja | Port, auf dem der Express-Server lauscht (z. B. `3000`) |
| `SESSION_SECRET` | ja | Geheimer Schlüssel zum Signieren von Sessions. Muss ein langer, zufälliger String sein (mind. 32 Zeichen). |
| `GMAIL_EMAIL` | ja | Gmail-Adresse, von der Verifizierungs-E-Mails versendet werden. |
| `GMAIL_APP_PASSWORD` | ja | 16-stelliges Google App-Passwort (kein normales Kontopasswort). |

### Gmail App-Passwort erstellen

Das Projekt versendet Verifizierungs-E-Mails über Gmail. Dafür wird kein normales Passwort, sondern ein **App-Passwort** benötigt:

1. Google-Konto öffnen → **Sicherheit**
2. **2-Faktor-Authentifizierung** aktivieren (falls noch nicht geschehen)
3. Unter Sicherheit → **App-Passwörter** → Neue App hinzufügen
4. Den generierten 16-stelligen Code als `GMAIL_APP_PASSWORD` eintragen

> **Achtung:** Die `.env`-Datei enthält sensible Zugangsdaten und darf niemals in ein öffentliches Repository eingecheckt werden.

---

## Starten der Anwendung

```bash
npm start
```

Der Server ist anschließend unter `http://localhost:<APP_PORT>` erreichbar (Standard: `http://localhost:3000`).

Beim Start prüft die Anwendung automatisch, ob alle Umgebungsvariablen gesetzt sind. Fehlt eine Variable, wird der Prozess mit einer Fehlermeldung beendet.

---

## Docker-Deployment

>Wenn Node.js und npm global installiert sind, reicht 'npm start' zum Ausführen der Anwendung. Andernfalls kann die App über Docker betrieben werden – einzige Voraussetzung ist dann `winget install Docker.DockerDesktop` (Windows) / `brew install --cask docker` (macOS).

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
├── assets/                  # Statische Frontend-Dateien
│   ├── css/                 # Stylesheets
│   ├── images/              # Bilder & Logos
│   └── js/                  # Client-seitiges JavaScript
├── controller/
│   └── app.js               # Express-Server (Einstiegspunkt)
├── model/
│   ├── authModel.js         # Authentifizierungslogik
│   ├── database.js          # SQLite-Datenbankabfragen
│   ├── esc-database.db      # SQLite-Datenbankdatei
│   ├── mailer.js            # E-Mail-Versand (Nodemailer)
│   └── voteModel.js         # Abstimmungslogik
├── view/                    # HTML-Seiten
│   ├── dhbw-esc.html        # Startseite
│   ├── login.html           # Login
│   ├── signup.html          # Registrierung
│   ├── voting.html          # Abstimmungsseite
│   ├── results.html         # Ergebnisse
│   └── rechtliches/         # Impressum, Datenschutz, AGB, Cookie-Richtlinie
├── .env                     # Umgebungsvariablen (nicht versioniert)
├── Dockerfile               # Docker-Konfiguration
└── package.json             # Abhängigkeiten & Skripte
```

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

### API-Endpunkte

| Methode | Route | Beschreibung |
|---------|-------|-------------|
| `GET` | `/api/check-session` | Prüft, ob eine aktive Session vorhanden ist |
| `POST` | `/api/signup` | Neuen Viewer-Account registrieren |
| `GET` | `/api/verify?token=<token>` | E-Mail-Adresse verifizieren und Account freischalten |
| `POST` | `/api/login` | Einloggen (Viewer oder Jury) |
| `POST` | `/api/logout` | Session beenden und ausloggen |

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
