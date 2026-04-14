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
