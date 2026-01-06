require("dotenv").config(); // MUST be first

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { errorHandler } = require("./middleware/errorHandler");
const { requestLogger, correlationId } = require("./middleware/logger");
const config = require("./config/env");

const app = express();

/* ======================================================
   1️⃣ Correlation ID
====================================================== */
app.use(correlationId);

/* ======================================================
   2️⃣ Helmet (CSP FIXED)
====================================================== */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "http://localhost:3000",
          "https://fic-lance-frontend-e189.vercel.app",
          "https://ficlance-backend.onrender.com",
        ],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

/* ======================================================
   3️⃣ SINGLE, CORRECT CORS CONFIG (THIS IS THE KEY)
   - Production origin MUST match Vercel URL exactly
   - credentials: true required for cookies
   - PATCH/PUT allowed
====================================================== */
const allowedOrigins = [
  "https://fic-lance-frontend-e189.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // mobile apps / curl
    const isAllowed =
      allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
    if (isAllowed) return callback(null, true);
    console.warn("❌ CORS blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

/* ======================================================
   6️⃣ Logging
====================================================== */
app.use(requestLogger);

/* ======================================================
   7️⃣ Passport
====================================================== */
const passport = require("passport");
const { initializePassport } = require("./config/passport");
initializePassport();
app.use(passport.initialize());

/* ======================================================
   8️⃣ Routes (API PREFIX)
====================================================== */
const routes = require("./routes");
app.use(config.apiPrefix, routes);

/* ======================================================
   9️⃣ Root
====================================================== */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FicLance Backend API",
    version: "1.0.0",
  });
});

/* ======================================================
   🔟 404
====================================================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

/* ======================================================
   11️⃣ Global Error
====================================================== */
app.use(errorHandler);

module.exports = app;
