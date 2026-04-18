// Bidirektionale Maps für Auto-Auswahl (landcode ↔ vorwahl)
let landcodeZuVorwahl = new Map();
let vorwahlZuLandcode = new Map();
let erlaubteWerte = null;

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Profil und Länderliste parallel laden
        const [profileRes, laenderRes] = await Promise.all([
            fetch("/api/user/profile"),
            fetch("/api/countries"),
        ]);
        const profileData = await profileRes.json();
        const laender = await laenderRes.json();

        if (!profileData.success) {
            window.location.href = "/login";
            return;
        }

        // Dropdowns befüllen
        const countrySelect = document.getElementById("countryCode");
        const prefixSelect = document.getElementById("phonePrefix");
        const laendercodes = new Set();
        const vorwahlen = new Set();

        for (const c of laender) {
            laendercodes.add(c.landcode);
            countrySelect.insertAdjacentHTML(
                "beforeend",
                `<option value="${c.landcode}">${c.country} (${c.landcode})</option>`
            );
            if (c.vorwahl) {
                vorwahlen.add(c.vorwahl);
                landcodeZuVorwahl.set(c.landcode, c.vorwahl);
                vorwahlZuLandcode.set(c.vorwahl, c.landcode);
                prefixSelect.insertAdjacentHTML(
                    "beforeend",
                    `<option value="${c.vorwahl}">${c.vorwahl} (${c.landcode})</option>`
                );
            }
        }

        erlaubteWerte = { laendercodes, vorwahlen };

        // Auto-Auswahl: Landcode → Vorwahl
        countrySelect.addEventListener("change", () => {
            prefixSelect.value = landcodeZuVorwahl.get(countrySelect.value) || "";
        });

        // Auto-Auswahl: Vorwahl → Landcode
        prefixSelect.addEventListener("change", () => {
            countrySelect.value = vorwahlZuLandcode.get(prefixSelect.value) || "";
        });

        // Profil-Felder befüllen (nach Dropdown-Befüllung, damit Werte gesetzt werden können)
        const p = profileData.profile;
        document.getElementById("firstName").value = p.firstName || "";
        document.getElementById("lastName").value = p.lastName || "";
        document.getElementById("email").value = p.email || "";
        document.getElementById("phonePrefix").value = p.phonePrefix || "";
        document.getElementById("phoneNumber").value = p.phoneNumber || "";
        document.getElementById("birthDate").value = p.birthDate || "";
        document.getElementById("gender").value = p.gender || "";
        document.getElementById("countryCode").value = p.countryCode || "";

    } catch (err) {
        console.error("Fehler beim Laden des Profils:", err);
    }
});

document.getElementById("deleteAccountBtn").addEventListener("click", async () => {
    if (!confirm("Möchtest du wirklich deinen Account und alle deine Daten unwiderruflich löschen?")) return;

    try {
        const res = await fetch("/api/user/delete", { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            window.location.href = "/";
        } else {
            alert(data.message || "Fehler beim Löschen.");
        }
    } catch (err) {
        console.error("Fehler beim Löschen des Accounts:", err);
    }
});

document.getElementById("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("profile-error-message");
    errorEl.className = "error-msg hidden";

    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phonePrefix = document.getElementById("phonePrefix").value;
    const phoneNumber = document.getElementById("phoneNumber").value.trim();
    const birthDate = document.getElementById("birthDate").value;
    const gender = document.getElementById("gender").value;
    const countryCode = document.getElementById("countryCode").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    const pruefung = validateUserData(
        { firstName, lastName, email, phonePrefix, phoneNumber, birthDate, gender, countryCode, password, confirmPassword },
        false,
        erlaubteWerte
    );
    if (!pruefung.ok) {
        errorEl.textContent = pruefung.meldung;
        errorEl.classList.remove("hidden");
        return;
    }

    const payload = { firstName, lastName, email, phonePrefix, phoneNumber, birthDate, gender, countryCode };
    if (password) {
        payload.password = password;
        payload.confirmPassword = confirmPassword;
    }

    try {
        const res = await fetch("/api/user/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (data.success) {
            errorEl.style.color = "#4dff91";
            errorEl.textContent = "Profil erfolgreich gespeichert.";
            errorEl.classList.remove("hidden");
            document.getElementById("password").value = "";
            document.getElementById("confirmPassword").value = "";
        } else {
            errorEl.style.color = "";
            errorEl.textContent = data.message || "Fehler beim Speichern.";
            errorEl.classList.remove("hidden");
        }
    } catch (err) {
        console.error("Fehler beim Aktualisieren:", err);
    }
});
