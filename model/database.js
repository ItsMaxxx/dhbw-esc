import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { styleText } from "node:util";

//Verzeichnispfade der E-Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "esc-database.db");

// Verbindung zur Datenbank herstellen
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(styleText("red","Fehler bei der Verbindung zur SQLite-Datenbank: " + err.message));
  } else {
    console.log(styleText("green","Stabile SQLite-Verbindung zur existierenden esc-database.db hergestellt!"));
  }
});


// Query für: Jury-Login
export const getJuryUser = (email, password) => {
    return new Promise((resolve, reject) => {
        console.log(styleText("blue", `DB-Abfrage für Jury-Login gestartet: E-Mail = ${email}`));

        const query = `SELECT country FROM jury_login_data WHERE jury_mail = ? AND password = ?`;

        db.get(query, [email, password], (err, row) => {
            if (err) {
                console.error(styleText("red", "DB-Fehler beim Login-Select: " + err.message));
                reject(err);
            } else {
                if (row) {
                    console.log(styleText("green", `Match in DB gefunden! Land: ${row.country}`));
                } else {
                    console.log(styleText("red", `Keine Übereinstimmung in DB für: ${email}`));
                }
                resolve(row);
            }
        });
    });
};

// Query für: Viewer-Login
export const getViewerUser = (email, password) => {
    return new Promise((resolve, reject) => {
        console.log(styleText("blue", `DB-Abfrage für Viewer-Login gestartet: ${email}`));

        const query = `SELECT id, first_name, last_name, email, country_code FROM viewer_users WHERE email = ? AND password = ?`;

        db.get(query, [email, password], (err, row) => {
            if (err) {
                console.error(styleText("red", "DB-Fehler beim Viewer-Login-Select: " + err.message));
                reject(err);
            } else {
                if (row) {
                    console.log(styleText("green",`Viewer-Match in DB gefunden! ID=${row.id}, E-Mail=${row.email}, Land=${row.country_code}`));
                } else {
                    console.log(styleText("red",`Kein Viewer-Match in DB für: ${email}`));
                }
                resolve(row); // row oder undefined
            }
        });
    });
};

// Query für: Viewer-Login (Suche nach E-Mail und Passwort-Hash)
export const getViewerByEmailForLogin = (email) => {
    return new Promise((resolve, reject) => {
        console.log(styleText("blue", `DB-Abfrage für Viewer-Login (Suche nach Hash): ${email}`));
        const query = `SELECT id, first_name, last_name, email, country_code, password, is_verified FROM viewer_users WHERE email = ?`;
        db.get(query, [email], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Query für: Neuer Viewer-User anlegen
export const createViewerUser = (userData, hashedPassword, verifyToken) => {
    return new Promise((resolve, reject) => {
        // is_verified fix auf 0
        const query = `
            INSERT INTO viewer_users
            (first_name, last_name, email, phone_prefix, phone_number, birth_date, gender, country_code, password, is_over_18, accepted_terms, is_verified, verify_token)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `;
        const params = [
            userData.firstName, userData.lastName, userData.email, userData.phonePrefix, userData.phoneNumber,
            userData.birthDate, userData.gender, userData.countryCode,
            hashedPassword, // Gehashtes Passwort
            userData.isOver18 ? 1 : 0, userData.acceptedTerms ? 1 : 0,
            verifyToken     // Der E-Mail Token
        ];

        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
};

// NEU: User über Token suchen
export const getViewerByToken = (token) => {
    return new Promise((resolve, reject) => {
        const query = `SELECT id, email FROM viewer_users WHERE verify_token = ?`;
        db.get(query, [token], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// NEU: Account aktivieren
export const verifyViewerAccount = (userId) => {
    return new Promise((resolve, reject) => {
        const query = `UPDATE viewer_users SET is_verified = 1, verify_token = NULL WHERE id = ?`;
        db.run(query, [userId], function(err) {
            if (err) reject(err);
            else resolve(true);
        });
    });
};
