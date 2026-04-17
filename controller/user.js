document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch("/api/user/profile");
        const data = await res.json();

        if (!data.success) {
            window.location.href = "/login";
            return;
        }

        const p = data.profile;
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

    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password && password !== confirmPassword) {
        errorEl.textContent = "Passwörter stimmen nicht überein.";
        errorEl.classList.remove("hidden");
        return;
    }

    if (password) {
        const passwordPattern = /^(?=.*[A-Z])(?=.*[!@#$%^&*()\-]).{8,}$/;
        if (!passwordPattern.test(password)) {
            errorEl.textContent = "Passwort erfüllt die Anforderungen nicht.";
            errorEl.classList.remove("hidden");
            return;
        }
    }

    const payload = {
        firstName: document.getElementById("firstName").value,
        lastName: document.getElementById("lastName").value,
        email: document.getElementById("email").value,
        phonePrefix: document.getElementById("phonePrefix").value,
        phoneNumber: document.getElementById("phoneNumber").value,
        birthDate: document.getElementById("birthDate").value,
        gender: document.getElementById("gender").value,
        countryCode: document.getElementById("countryCode").value,
    };
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
