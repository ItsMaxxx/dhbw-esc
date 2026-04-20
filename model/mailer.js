// Model/mailer.js
import nodemailer from "nodemailer";
import { styleText } from "node:util";

import dotenv from "dotenv";
dotenv.config({ override: false, debug: false, quiet: true, encoding: "utf8" });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL, // Email
    pass: process.env.GMAIL_APP_PASSWORD, // App-Passwort
  },
});

// HTML-Sonderzeichen escapen um Injection in E-Mail-Templates zu verhindern
const escapeHtml = (str) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const sendVerificationEmail = async (userEmail, token, firstName) => {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/api/verify?token=${token}`;
  const safeFirstName = escapeHtml(firstName);

  const mailOptions = {
    from: `"DHBW-ESC Voting" <${process.env.GMAIL_EMAIL}>`,
    to: userEmail,
    subject: "Bitte bestätige deine E-Mail-Adresse",
    html: `
            <h2>Hallo ${safeFirstName},</h2>
            <p>Willkommen beim DHBW-ESC Voting-Portal!</p>
            <p>Bitte klicke auf den folgenden Link, um deine E-Mail-Adresse zu bestätigen und dein Konto zu aktivieren:</p>
            <a href="${verifyUrl}" style="padding: 10px 15px; background-color: #6a4cff; color: white; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">E-Mail bestätigen</a>
            <p style="margin-top: 20px;">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:</p>
            <p>${verifyUrl}</p>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(
      styleText(
        "green",
        `Verifizierungs-E-Mail erfolgreich an ${userEmail} gesendet.`,
      ),
    );
    return true;
  } catch (error) {
    console.error(
      styleText(
        "red",
        `Fehler beim E-Mail-Versand an ${userEmail}: ${error.message}`,
      ),
    );
    return false;
  }
};

export const sendPasswordResetEmail = async (userEmail, token, firstName) => {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const safeFirstName = escapeHtml(firstName || "");

  const mailOptions = {
    from: `"DHBW-ESC Voting" <${process.env.GMAIL_EMAIL}>`,
    to: userEmail,
    subject: "Passwort zurücksetzen",
    html: `
            <h2>Hallo ${safeFirstName},</h2>
            <p>Es wurde angefragt, dein Passwort zurückzusetzen.</p>
            <p>Klicke auf den folgenden Link, um ein neues Passwort zu vergeben. Der Link ist eine Stunde lang gültig:</p>
            <a href="${resetUrl}" style="padding: 10px 15px; background-color: #6a4cff; color: white; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Passwort zurücksetzen</a>
            <p style="margin-top: 20px;">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:</p>
            <p>${resetUrl}</p>
            <p style="margin-top: 20px; color: #888; font-size: 0.9em;">Du hast keine Änderung angefordert? Dann ignoriere diese E-Mail einfach – dein Passwort bleibt unverändert.</p>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(
      styleText(
        "green",
        `Passwort-Reset-E-Mail erfolgreich an ${userEmail} gesendet.`,
      ),
    );
    return true;
  } catch (error) {
    console.error(
      styleText(
        "red",
        `Fehler beim Reset-Mail-Versand an ${userEmail}: ${error.message}`,
      ),
    );
    return false;
  }
};
