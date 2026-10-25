const jwt = require("jsonwebtoken");

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || "default_access_token_secret_12345";

/**
 * Middleware to verify JWT Access Token
 * Checks Authorization header (Bearer <token>) or cookies
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No access token provided in Authorization header (Bearer <token>) or cookie.",
    });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    req.user = decoded; // { userId, email, iat, exp }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Access token expired. Please refresh your token using /api/auth/refresh.",
        expired: true,
      });
    }
    return res.status(403).json({
      success: false,
      message: "Invalid access token.",
    });
  }
};

module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.requireAuth = verifyToken;
