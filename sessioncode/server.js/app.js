const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const express = require("express");
const session = require("express-session");

const app = express();

app.use(express.json());

// app.set("trust proxy", 1);      // uncomment in production behind a proxy

app.use(session({
  name: "sid",                              // cookie name
  secret: process.env.SESSION_SECRET || "default_session_secret_change_me", // signs the cookie
  resave: false,                            // don't re-save unchanged sessions
  saveUninitialized: false,                 // no session until login

// store: MongoStore.create({
//     mongoUrl: process.env.MONGO_URI,
//     ttl: 60 * 60 * 24 * 7,                  // auto-expire in 7 days
//   }),

  cookie: {
    httpOnly: true,                         // JS can't read it (XSS protection)
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "lax",                        // CSRF mitigation
    maxAge: 1000 * 60 * 60 * 24 * 7,        // 1 week
  },
}));

// Route registration
app.use("/api/auth", require("../authroute.js/route"));

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ message: "Session authentication server running" });
});

const PORT = process.env.SESSION_PORT || 5001;

app.listen(PORT, () => console.log(`Session Auth Server running on http://localhost:${PORT}`));