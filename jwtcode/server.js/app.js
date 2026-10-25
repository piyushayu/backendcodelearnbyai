const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const express = require("express");
const cookieParser = require("cookie-parser");

const app = express();

app.use(express.json());
app.use(cookieParser());

// Route registration
app.use("/api/auth", require("../authroute.js/route"));

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "JWT Authentication Server Running",
    port: process.env.JWT_PORT || 5002,
    endpoints: {
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      refresh: "POST /api/auth/refresh",
      me: "GET /api/auth/me (Protected - Bearer Token)",
      logout: "POST /api/auth/logout",
      debug: "GET /api/auth/debug-store",
    },
  });
});

const PORT = process.env.JWT_PORT || 5002;

app.listen(PORT, () => {
  console.log(`\n==============================================`);
  console.log(` JWT Auth Server running on http://localhost:${PORT}`);
  console.log(` Endpoints:`);
  console.log(`   POST http://localhost:${PORT}/api/auth/register`);
  console.log(`   POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   POST http://localhost:${PORT}/api/auth/refresh`);
  console.log(`   GET  http://localhost:${PORT}/api/auth/me (Auth header)`);
  console.log(`   POST http://localhost:${PORT}/api/auth/logout`);
  console.log(`==============================================\n`);
});
