const userService = require("../services/user.service");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * List user's sessions
 * GET /sessions
 */
async function listSessions(req, res, next) {
  try {
    const userId = req.user.userId;

    const sessions = await userService.listUserSessions(userId);

    return res.json(successResponse(sessions));
  } catch (error) {
    next(error);
  }
}

/**
 * Revoke a session
 * POST /sessions/revoke
 */
async function revokeSession(req, res, next) {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.body;

    await userService.revokeSession(userId, sessionId);

    return res.json(successResponse(null, "Session revoked"));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listSessions,
  revokeSession,
};
