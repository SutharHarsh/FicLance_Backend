const express = require("express");
const router = express.Router();

// Mount all route modules
router.use("/auth", require("./auth.routes"));
router.use("/users", require("./user.routes"));
router.use("/users", require("./users.routes"));
router.use("/sessions", require("./session.routes"));
router.use("/templates", require("./template.routes"));
router.use("/simulations", require("./simulation.routes"));
router.use("/messages", require("./messages.routes"));
router.use("/portfolio", require("./portfolio.routes"));
router.use("/portfolio/share", require("./portfolio-sharing.routes"));
router.use("/files", require("./file.routes"));
router.use("/feedback", require("./feedback.routes"));
router.use("/subscriptions", require("./subscription.routes"));
router.use("/webhooks", require("./webhook.routes"));
router.use("/limits", require("./limits.routes"));
router.use("/support", require("./support.routes"));
router.use("/admin", require("./admin.routes"));
router.use("/health", require("./health.routes"));
router.use("/dashboard", require("./dashboard.routes"));
router.use("/newsletter", require("./newsletter.routes"));

module.exports = router;
