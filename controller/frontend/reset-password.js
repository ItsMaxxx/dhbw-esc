// Token aus der URL lesen (z.B. /reset-password?token=abc123)
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");

const form = document.getElementById("resetPasswordForm");
const errorMsg = document.getElementById("reset-error-message");
const infoMsg = document.getElementById("reset-info-message");

// Ohne Token macht die Seite keinen Sinn → sofort erklären und das Formular sperren
if (!token) {
  errorMsg.textContent = "Kein Reset-Token gefunden. Bitte nutze den Link aus der E-Mail.";
  errorMsg.classList.remove("hidden");
  form.querySelector("button[type=submit]").disabled = true;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorMsg.classList.add("hidden");
  infoMsg.classList.add("hidden");

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  try {
    const response = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      infoMsg.textContent = "Passwort erfolgreich geändert. Du wirst zum Login weitergeleitet …";
      infoMsg.classList.remove("hidden");
      setTimeout(() => (window.location.href = "/login"), 2000);
    } else {
      errorMsg.textContent = data.message || "Passwort konnte nicht zurückgesetzt werden.";
      errorMsg.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Reset Password Fetch Error:", error);
    errorMsg.textContent = "Verbindungsfehler zum Backend.";
    errorMsg.classList.remove("hidden");
  }
});
