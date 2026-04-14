document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Backend nach der aktuellen Session fragen
    const response = await fetch("/api/check-session");
    const data = await response.json();

    const headerRight = document.querySelector(".header-right");

    if (headerRight && data.loggedIn && data.user) {
      const user = data.user;
      let displayText;

      //Logik für was im Header angezeigt werden soll
      if (user.role === "jury") {
        displayText = user.country || "Jury";
      } else if (user.role === "viewer") {
        displayText = user.firstName || "Viewer";
      } else {
        displayText = "User";
      }

      headerRight.innerHTML = `
                <span style="color: white; font-size: 1.1rem; font-weight: bold; font-family: sans-serif; margin-right: 15px;">
                    Logged In As ${displayText}
                </span>
                <button class="login-btn" onclick="logoutUser()">Logout</button>`;
    }
  } catch (error) {
    console.error("Fehler beim Prüfen der Session:", error);
  }
});

// Sichere Logout-Funktion
async function logoutUser() {
  try {
    // Dem Backend sagen: Zerstöre die Session!
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  } catch (error) {
    console.error("Logout fehlgeschlagen", error);
  }
}
