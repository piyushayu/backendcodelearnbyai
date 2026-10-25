const router = require("express").Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const requireAuth = require("../middleware.js/middle");

// In-memory user store replacing the database
// Each user: { id, email, passwordHash, createdAt }
const users = [];

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const existingUser = users.find((u) => u.email === email);
    if (existingUser) {
      return res.status(409).json({ message: "Email already used" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const user = {
      id,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    res.status(201).json({
      message: "User registered successfully",
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Login: creates the session
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = users.find((u) => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // New sid on login prevents session fixation attacks
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ message: "Session error" });
      req.session.userId = user.id; // stores user id in server-side session
      res.json({
        message: "Login successful",
        id: user.id,
        email: user.email,
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Protected route: who am I?
router.get("/me", requireAuth, (req, res) => {
  const user = users.find((u) => u.id === req.session.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Return user details without the sensitive passwordHash
  res.json({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  });
});

// Logout: destroys the session
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Session destroy failed" });
    }
    res.clearCookie("sid");
    res.json({ ok: true, message: "Logged out successfully" });
  });
});

module.exports = router;
module.exports.users = users;

// To run your session authentication server:

// bash
// npm run session
// The server will start on http://localhost:5001 with endpoints:

// POST /api/auth/register
// POST /api/auth/login
// GET /api/auth/me
// POST /api/auth/logout