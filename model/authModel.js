import bcrypt from "bcrypt";
import crypto from "crypto";
import { styleText } from "node:util";

import { getJuryUser, getViewerUser, getViewerByEmailForLogin, createViewerUser, getViewerByToken, verifyViewerAccount } from "./database.js";
import { sendVerificationEmail } from "./mailer.js";

export const authenticateUser = async (role, email, password) => {
    try {
        if (role === "jury") {
            // Jury bleibt vorerst Klartext
            const user = await getJuryUser(email, password);
            if (user) return { success: true, role: "jury", country: user.country };
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
                    success: true, role: "viewer", country: viewer.country_code,
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
