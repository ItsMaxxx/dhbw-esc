"use strict";

import session from "express-session";

export default session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: "strict",
    httpOnly: true,
    secure: false,
    // maxAge fehlt absichtlich: Dadurch ist es ein Session-Cookie (löscht sich beim Schließen)
  },
});
