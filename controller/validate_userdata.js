// Erlaubte Geschlechtswerte (fest, nicht aus DB)
const ERLAUBTE_GESCHLECHTER = new Set(["", "female", "male", "other"]);

const NAME_MUSTER = /^[a-zA-ZäöüÄÖÜß\s\-']{1,50}$/;
const EMAIL_MUSTER = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONNUMMER_MUSTER = /^[0-9\s\-/]{1,20}$/;
const DATUM_MUSTER = /^\d{4}-\d{2}-\d{2}$/;
const PASSWORT_MUSTER = /^(?=.*[A-Z])(?=.*[!@#$%^&*()\-]).{8,}$/;

/**
 * Prüft Benutzerdaten auf Vollständigkeit und Format.
 * @param {Object} data - Die zu prüfenden Felder
 * @param {boolean} passwortPflicht - true beim Signup, false beim Profilupdate
 * @param {{ laendercodes: Set, vorwahlen: Set }|null} erlaubteWerte - aus DB geladene Whitelist
 * @returns {{ ok: boolean, meldung?: string }}
 */
function validateUserData(data, passwortPflicht, erlaubteWerte) {
    const { firstName, lastName, email, phonePrefix, phoneNumber,
            birthDate, gender, countryCode, password, confirmPassword } = data;

    if (!firstName || !lastName || !email || !countryCode) {
        return { ok: false, meldung: "Bitte alle Pflichtfelder ausfüllen." };
    }
    if (!NAME_MUSTER.test(firstName)) {
        return { ok: false, meldung: "Vorname enthält ungültige Zeichen oder ist zu lang (max. 50)." };
    }
    if (!NAME_MUSTER.test(lastName)) {
        return { ok: false, meldung: "Nachname enthält ungültige Zeichen oder ist zu lang (max. 50)." };
    }
    if (email.length > 254 || !EMAIL_MUSTER.test(email)) {
        return { ok: false, meldung: "Bitte eine gültige E-Mail-Adresse eingeben." };
    }

    if (erlaubteWerte) {
        if (!erlaubteWerte.laendercodes.has(countryCode)) {
            return { ok: false, meldung: "Ungültiger Ländercode." };
        }
        if (phonePrefix && !erlaubteWerte.vorwahlen.has(phonePrefix)) {
            return { ok: false, meldung: "Ungültige Telefonvorwahl." };
        }
    }

    if (gender !== undefined && !ERLAUBTE_GESCHLECHTER.has(gender)) {
        return { ok: false, meldung: "Ungültiger Wert für Geschlecht." };
    }
    if (phoneNumber && !TELEFONNUMMER_MUSTER.test(phoneNumber)) {
        return { ok: false, meldung: "Telefonnummer enthält ungültige Zeichen (max. 20 Ziffern)." };
    }
    if (birthDate && !DATUM_MUSTER.test(birthDate)) {
        return { ok: false, meldung: "Ungültiges Datumsformat für Geburtsdatum." };
    }

    if (passwortPflicht && !password) {
        return { ok: false, meldung: "Bitte alle Pflichtfelder ausfüllen." };
    }
    if (password) {
        if (!PASSWORT_MUSTER.test(password)) {
            return { ok: false, meldung: "Passwort erfüllt die Anforderungen nicht." };
        }
        if (password !== confirmPassword) {
            return { ok: false, meldung: "Passwörter stimmen nicht überein." };
        }
    }

    return { ok: true };
}
