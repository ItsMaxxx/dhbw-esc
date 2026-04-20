"use strict";

import { styleText } from "node:util";

// Loggt die Client-Informationen (IP, OS, Browser) in der Konsole
export function logClientInfo(req) {
  let clientIp = req.ip || req.socket.remoteAddress;
  clientIp = clientIp.replace("::ffff:", ""); // Liest die IP-Adresse des Clients
  const rawUserAgent = req.headers["user-agent"];
  const shortDevice = getShortDeviceInfo(rawUserAgent); //Liest den Gerätetyp ("OS: Windows mit Chrome")
  const route = req.originalUrl; // Liest die aufgerufene URL aus ("/voting")

  console.log(
    `${styleText("blue", "Aufruf")} ➔ IP: ${clientIp} ➔ OS: ${shortDevice} ${styleText("blue", "für")} "${route}"`,
  );
}

// Liefert den Gerätetyp zurück ("OS: Windows mit Chrome")
function getShortDeviceInfo(uaString) {
  if (!uaString) return "Unbekannt";
  let browser = "Unbekannter Browser";
  let os = "Unbekanntes OS";

  if (uaString.includes("OPR/") || uaString.includes("Opera"))
    browser = "Opera";
  else if (uaString.includes("Edg/")) browser = "Edge";
  else if (uaString.includes("Chrome/")) browser = "Chrome";
  else if (uaString.includes("Firefox/")) browser = "Firefox";
  else if (uaString.includes("Safari/")) browser = "Safari";

  if (uaString.includes("Windows")) os = "Windows";
  else if (uaString.includes("Mac OS")) os = "macOS";
  else if (uaString.includes("Android")) os = "Android";
  else if (uaString.includes("iPhone") || uaString.includes("iPad")) os = "iOS";
  else if (uaString.includes("Linux")) os = "Linux";

  return `${os} mit ${browser}`;
}
