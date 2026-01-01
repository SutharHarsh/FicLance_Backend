require("dotenv").config(); // 👈 MUST be line 1
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { errorHandler } = require("./middleware/errorHandler");
const { requestLogger, correlationId } = require("./middleware/logger");
const config = require("./config/env");
const logger = require("./config/logger");

const app = express();

// Trace ID middleware
app.use(correlationId);

// Security middleware
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
          "http://localhost:8080",
          "http://127.0.0.1:8080",
        ],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration - Allow both localhost and 127.0.0.1
const allowedOrigins = [
  config.corsOrigin,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "X-Correlation-ID",
      "X-Refresh-Token",
    ],
    exposedHeaders: ["Set-Cookie", "X-Correlation-ID"],
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// Initialize Passport for OAuth
const passport = require("passport");
const { initializePassport } = require("./config/passport");
initializePassport();
app.use(passport.initialize());

// API routes
const routes = require("./routes");
app.use(config.apiPrefix, routes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FicLance Backend API",
    version: "1.0.0",
    documentation: `${config.apiPrefix}/docs`,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
