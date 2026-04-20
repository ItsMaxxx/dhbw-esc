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
      if (user.role === "admin") {
        displayText = "Admin";
      } else if (user.role === "jury") {
        displayText = user.country || "Jury";
      } else if (user.role === "viewer") {
        displayText = user.firstName || "Viewer";
      } else {
        displayText = "User";
      }

      headerRight.replaceChildren();

      if (user.role === "viewer") {
        const profileBtn = document.createElement("button");
        profileBtn.className = "login-btn";
        profileBtn.style.marginRight = "10px";
        profileBtn.textContent = `Logged In As ${displayText}`;
        profileBtn.addEventListener("click", () => { window.location.href = "/user"; });
        headerRight.appendChild(profileBtn);
      } else {
        const nameSpan = document.createElement("span");
        nameSpan.style.cssText = "color: white; font-size: 1.1rem; font-weight: bold; font-family: sans-serif; margin-right: 15px;";
        nameSpan.textContent = `Logged In As ${displayText}`;
        headerRight.appendChild(nameSpan);
      }

      const logoutBtn = document.createElement("button");
      logoutBtn.className = "login-btn";
      logoutBtn.textContent = "Logout";
      logoutBtn.addEventListener("click", logoutUser);
      headerRight.appendChild(logoutBtn);
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
    window.location.href = "/";
  } catch (error) {
    console.error("Logout fehlgeschlagen", error);
  }
}
