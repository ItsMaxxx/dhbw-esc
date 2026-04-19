import bcrypt from "bcrypt";
import crypto from "crypto";
import { styleText } from "node:util";

import { getJuryUser, getViewerByEmailForLogin, createViewerUser, getViewerByToken, verifyViewerAccount, getViewerById, updateViewerUser, deleteViewerUser, getAllCountries, countryCodeExists, vorwahlExists, setResetToken, getViewerByResetToken, updatePasswordAndClearResetToken } from "./database.js";

export { getAllCountries };
import { sendVerificationEmail, sendPasswordResetEmail } from "./mailer.js";

export const authenticateUser = async (role, email, password) => {
    try {
        if (role === "jury") {
            // Jury bleibt vorerst Klartext
            const user = await getJuryUser(email, password);
            if (user) {
                const isAdmin = user.country === "Admin";
                return { success: true, role: isAdmin ? "admin" : "jury", country: user.country };
            }
            return { success: false, message: "E-Mail oder Passwort falsch" };

        } else if (role === "viewer") {
            // 1. User anhand der E-Mail aus der DB holen
            const viewer = await getViewerByEmailForLogin(email);
            if (!viewer) return { success: false, message: "E-Mail oder Passwort falsch" };

            // 2. Prüfen, ob die E-Mail verifiziert ist
            if (viewer.is_verified === 0) {
                return { success: false, message: "Bitte bestätige zuerst deine E-Mail-Adresse! Prüfe deinen Posteingang." };
            }

            // 3. Passwort mit dem DB-Hash vergleichen
            const passwordMatch = await bcrypt.compare(password, viewer.password);

            if (passwordMatch) {
                console.log(styleText("green", `Viewer-Login erfolgreich: ${viewer.email}`));
                return {
                    success: true, role: "viewer", id: viewer.id, country: viewer.country_code,
                    firstName: viewer.first_name, lastName: viewer.last_name
                };
            } else {
                console.log(styleText("red", `Viewer-Login fehlgeschlagen (falsches Passwort) für: ${email}`));
                return { success: false, message: "E-Mail oder Passwort falsch" };
            }
        }
        return { success: false, message: "Ungültige Rolle ausgewählt" };
    } catch (error) {
        console.error(styleText("red", "Fehler im voteModel: " + error.message));
        return { success: false, message: "Interner Serverfehler bei der Anmeldung" };
    }
};

// Registrierungs-Logik
export const registerViewerUser = async (userData) => {
    try {
        const existing = await getViewerByEmailForLogin(userData.email);
        if (existing) {
            console.log(styleText("red", `Registrierung abgelehnt: E-Mail bereits registriert (${userData.email})`));
            return { success: false, message: "Diese E-Mail ist bereits registriert." };
        }

        // 1. Passwort sicher verschlüsseln (10 Salt-Runden)
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // 2. Zufälligen 32-Byte Token für den Link generieren
        const verifyToken = crypto.randomBytes(32).toString("hex");

        // 3. User speichern (mit Hash und Token)
        const newId = await createViewerUser(userData, hashedPassword, verifyToken);
        console.log(styleText("green", `Viewer-Account erstellt (Unverifiziert). ID: ${newId}`));

        // 4. E-Mail versenden
        await sendVerificationEmail(userData.email, verifyToken, userData.firstName);

        return { success: true, message: "Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse!" };
    } catch (error) {
        console.error(styleText("red", "Fehler bei registerViewerUser: " + error.message));
        return { success: false, message: "Interner Fehler bei der Registrierung." };
    }
};

// Profil-Abfrage
export const getViewerProfile = async (id) => {
    try {
        const row = await getViewerById(id);
        if (!row) return null;
        return {
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            phonePrefix: row.phone_prefix,
            phoneNumber: row.phone_number,
            birthDate: row.birth_date,
            gender: row.gender,
            countryCode: row.country_code,
        };
    } catch (error) {
        console.error(styleText("red", "Fehler bei getViewerProfile: " + error.message));
        return null;
    }
};

// Profil-Update
export const updateViewerProfile = async (id, data) => {
    try {
        // E-Mail-Kollision prüfen: nicht erlaubt, wenn neue Mail bereits einem anderen User gehört
        const existing = await getViewerByEmailForLogin(data.email);
        if (existing && existing.id !== id) {
            return { success: false, message: "Diese E-Mail ist bereits registriert." };
        }

        let hashedPassword = null;
        if (data.password) {
            hashedPassword = await bcrypt.hash(data.password, 10);
        }
        await updateViewerUser(id, data, hashedPassword);
        return { success: true };
    } catch (error) {
        console.error(styleText("red", "Fehler bei updateViewerProfile: " + error.message));
        return { success: false, message: "Interner Fehler beim Aktualisieren." };
    }
};

// Account löschen
export const deleteViewerAccount = async (id) => {
    try {
        await deleteViewerUser(id);
        return { success: true };
    } catch (error) {
        console.error(styleText("red", "Fehler bei deleteViewerAccount: " + error.message));
        return { success: false, message: "Interner Fehler beim Löschen." };
    }
};

// Serverseitige Validierung (Pflichtfelder, Format, DB-Whitelists)
export const validateUserDataDB = async (data, requirePassword = false) => {
    const { firstName, lastName, email, phonePrefix, phoneNumber,
            birthDate, gender, countryCode, password, confirmPassword } = data;

    if (!firstName || !lastName || !email || !countryCode) {
        return { valid: false, message: "Bitte alle Pflichtfelder ausfüllen." };
    }

    const NAME_PATTERN = /^[a-zA-ZäöüÄÖÜß\s\-']{1,50}$/;
    if (!NAME_PATTERN.test(firstName)) {
        return { valid: false, message: "Vorname enthält ungültige Zeichen oder ist zu lang (max. 50)." };
    }
    if (!NAME_PATTERN.test(lastName)) {
        return { valid: false, message: "Nachname enthält ungültige Zeichen oder ist zu lang (max. 50)." };
    }

    const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
        return { valid: false, message: "Bitte eine gültige E-Mail-Adresse eingeben." };
    }

    const landcodeOk = await countryCodeExists(countryCode);
    if (!landcodeOk) {
        return { valid: false, message: "Ungültiger Ländercode." };
    }

    const ALLOWED_GENDERS = new Set(["", "female", "male", "other"]);
    if (gender !== undefined && !ALLOWED_GENDERS.has(gender)) {
        return { valid: false, message: "Ungültiger Wert für Geschlecht." };
    }

    if (phonePrefix) {
        const vorwahlOk = await vorwahlExists(phonePrefix);
        if (!vorwahlOk) {
            return { valid: false, message: "Ungültige Telefonvorwahl." };
        }
    }

    if (phoneNumber && !/^[0-9\s\-/]{1,20}$/.test(phoneNumber)) {
        return { valid: false, message: "Telefonnummer enthält ungültige Zeichen (max. 20 Ziffern)." };
    }

    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        return { valid: false, message: "Ungültiges Datumsformat für Geburtsdatum." };
    }

    if (requirePassword && !password) {
        return { valid: false, message: "Bitte alle Pflichtfelder ausfüllen." };
    }
    if (password) {
        if (!/^(?=.*[A-Z])(?=.*[!@#$%^&*()\-]).{8,}$/.test(password)) {
            return { valid: false, message: "Passwort erfüllt die Anforderungen nicht." };
        }
        if (password !== confirmPassword) {
            return { valid: false, message: "Passwörter stimmen nicht überein." };
        }
    }

    return { valid: true };
};

// Passwort-Reset anfordern: Token generieren, in DB speichern, Mail versenden.
// WICHTIG: Aus Sicherheitsgründen wird dem Aufrufer NIE verraten, ob die E-Mail existiert.
export const requestPasswordReset = async (email) => {
    try {
        const viewer = await getViewerByEmailForLogin(email);
        // Nur verifizierte Viewer bekommen einen Reset (nicht verifizierte haben kein nutzbares Konto)
        if (!viewer || viewer.is_verified !== 1) {
            console.log(styleText("blue", `Reset-Request für unbekannte/unverifizierte E-Mail: ${email}`));
            return { success: true };
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const expiry = Date.now() + 60 * 60 * 1000; // 1 Stunde gültig

        await setResetToken(email, resetToken, expiry);
        await sendPasswordResetEmail(email, resetToken, viewer.first_name);

        console.log(styleText("green", `Passwort-Reset-Mail für ${email} ausgelöst.`));
        return { success: true };
    } catch (error) {
        console.error(styleText("red", "Fehler bei requestPasswordReset: " + error.message));
        // Auch bei internem Fehler: gleiche Antwort (Enumeration-Schutz)
        return { success: true };
    }
};

// Passwort-Reset durchführen: Token prüfen, neues Passwort hashen und speichern.
export const resetPasswordWithToken = async (token, password, confirmPassword) => {
    try {
        if (!token || typeof token !== "string") {
            return { success: false, message: "Ungültiger Reset-Link." };
        }
        if (!password || password !== confirmPassword) {
            return { success: false, message: "Passwörter stimmen nicht überein." };
        }
        if (!/^(?=.*[A-Z])(?=.*[!@#$%^&*()\-]).{8,}$/.test(password)) {
            return { success: false, message: "Passwort erfüllt die Anforderungen nicht." };
        }

        const row = await getViewerByResetToken(token);
        if (!row) {
            return { success: false, message: "Ungültiger oder bereits verwendeter Reset-Link." };
        }
        if (!row.reset_token_expiry || row.reset_token_expiry < Date.now()) {
            return { success: false, message: "Der Reset-Link ist abgelaufen. Bitte fordere einen neuen an." };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await updatePasswordAndClearResetToken(row.id, hashedPassword);

        console.log(styleText("green", `Passwort für ${row.email} erfolgreich zurückgesetzt.`));
        return { success: true };
    } catch (error) {
        console.error(styleText("red", "Fehler bei resetPasswordWithToken: " + error.message));
        return { success: false, message: "Interner Fehler beim Zurücksetzen des Passworts." };
    }
};

// Token-Verifizierungs-Logik
export const verifyUserToken = async (token) => {
    try {
        const user = await getViewerByToken(token);
        if (!user) return { success: false };

        await verifyViewerAccount(user.id);
        console.log(styleText("green", `Account von ${user.email} erfolgreich verifiziert!`));
        return { success: true };
    } catch (error) {
        console.error(styleText("red", "Fehler bei der Verifizierung: " + error.message));
        return { success: false };
    }
};
