document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // 1. Cookies zugestimmt? (DSGVO-Blockade prüfen)
  const consent = localStorage.getItem("cookie_consent");
  if (consent !== "yes") {
    // Blockiert den Request und zeigt das Popup mit Fehler
    if (typeof window.showCookieBannerWithError === "function") {
      window.showCookieBannerWithError();
    }
    return;
  }

  // 2. Regulärer Login-Prozess
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.querySelector('input[name="role"]:checked').value;
  const errorMsg = document.getElementById("error-message");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      window.location.href = "/";
    } else {
      errorMsg.textContent = data.message || "Login fehlgeschlagen.";
      errorMsg.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Login Fetch Error:", error);
    errorMsg.textContent = "Verbindungsfehler zum Backend.";
    errorMsg.classList.remove("hidden");
  }
});

// Passwort-vergessen: Toggle für das Zusatz-Formular
document.getElementById("forgot-password-toggle").addEventListener("click", () => {
  const form = document.getElementById("forgotPasswordForm");
  form.classList.toggle("hidden");
});

// Passwort-vergessen: Absenden
document.getElementById("forgotPasswordForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("forgot-email").value.trim();
  const msg = document.getElementById("forgot-message");

  try {
    const response = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    // Backend antwortet aus Enumeration-Gründen immer generisch — wir zeigen die gleiche Message
    if (response.ok) {
      msg.textContent = "Falls ein Konto zu dieser E-Mail existiert, haben wir dir einen Reset-Link geschickt.";
    } else {
      const data = await response.json().catch(() => ({}));
      msg.textContent = data.message || "Anfrage konnte nicht verarbeitet werden.";
    }
    msg.classList.remove("hidden");
  } catch (error) {
    console.error("Forgot Password Fetch Error:", error);
    msg.textContent = "Verbindungsfehler zum Backend.";
    msg.classList.remove("hidden");
  }
});
