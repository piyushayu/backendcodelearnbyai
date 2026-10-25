const router = require("express").Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware.js/middle");

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || "default_access_token_secret_12345";
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || "default_refresh_token_secret_67890";

// In-memory data stores (No database)
// users: stores registered accounts [{ id, email, passwordHash, createdAt }]
const users = [];

// refreshTokens: stores active valid refresh tokens for revocation & rotation
let refreshTokens = [];

// Helper functions for token generation
const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email },
    ACCESS_SECRET,
    { expiresIn: "15m" } // Short-lived: 15 minutes
  );
};

const generateRefreshToken = (user) => {
  const tokenId = crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random().toString();
  return jwt.sign(
    { userId: user.id, jti: tokenId },
    REFRESH_SECRET,
    { expiresIn: "7d" } // Long-lived: 7 days
  );
};

// 1. REGISTER
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
    const newUser = {
      id,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    res.status(201).json({
      message: "User registered successfully",
      id: newUser.id,
      email: newUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 2. LOGIN (Issues Access Token + Refresh Token)
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

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to in-memory store
    refreshTokens.push(refreshToken);

    // Set refreshToken as an HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken, // Also returned in body for easy Postman testing
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 3. REFRESH TOKEN (Refresh Token Rotation)
router.post("/refresh", (req, res) => {
  // Read token from cookie or request body (Postman friendly)
  const token = (req.cookies && req.cookies.refreshToken) || req.body.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "Refresh token required in cookie or body" });
  }

  // Check if refresh token is currently active in our store
  if (!refreshTokens.includes(token)) {
    return res.status(403).json({ message: "Refresh token is invalid or has been revoked" });
  }

  jwt.verify(token, REFRESH_SECRET, (err, decoded) => {
    if (err) {
      // Remove invalid token from store
      refreshTokens = refreshTokens.filter((t) => t !== token);
      return res.status(403).json({ message: "Refresh token expired or invalid" });
    }

    const user = users.find((u) => u.id === decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User no longer exists" });
    }

    // Refresh Token Rotation: Revoke used token and issue a fresh pair
    refreshTokens = refreshTokens.filter((t) => t !== token);

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    refreshTokens.push(newRefreshToken);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Tokens rotated successfully",
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  });
});

// 4. PROTECTED ROUTE (Requires valid Access Token)
router.get("/me", verifyToken, (req, res) => {
  const user = users.find((u) => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    tokenPayload: req.user, // Shows decoded token claims (userId, email, exp, iat)
  });
});

// 5. LOGOUT (Revokes Refresh Token)
router.post("/logout", (req, res) => {
  const token = (req.cookies && req.cookies.refreshToken) || req.body.refreshToken;

  if (token) {
    // Remove the refresh token from memory
    refreshTokens = refreshTokens.filter((t) => t !== token);
  }

  res.clearCookie("refreshToken");
  res.json({ ok: true, message: "Logged out and refresh token revoked successfully" });
});

// 6. DEBUG ROUTE (View in-memory store state)
router.get("/debug-store", (req, res) => {
  res.json({
    usersCount: users.length,
    users: users.map((u) => ({ id: u.id, email: u.email, createdAt: u.createdAt })),
    activeRefreshTokensCount: refreshTokens.length,
  });
});

module.exports = router;
module.exports.users = users;
module.exports.refreshTokens = refreshTokens;
