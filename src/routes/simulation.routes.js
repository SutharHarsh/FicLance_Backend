const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulation.controller');
const messageController = require('../controllers/message.controller');
const feedbackController = require('../controllers/feedback.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  createSimulationSchema,
  updateSimulationStateSchema,
  addParticipantSchema,
} = require('../validation/simulation.validation');
const {
  createMessageSchema,
  editMessageSchema,
} = require('../validation/message.validation');

// All simulation routes require authentication
router.use(authenticate);

router.post(
  '/',
  validate(createSimulationSchema),
  simulationController.createSimulation
);

router.get('/', simulationController.listUserSimulations);

router.get('/:id', simulationController.getSimulation);

router.post('/:id/start', simulationController.startSimulation);

router.patch(
  '/:id/state',
  validate(updateSimulationStateSchema),
  simulationController.updateSimulationState
);

router.post(
  '/:id/participants',
  validate(addParticipantSchema),
  simulationController.addParticipant
);

router.delete('/:id', simulationController.archiveSimulation);

// Message routes under simulation
router.get('/:simulationId/messages', messageController.listMessages);

router.post(
  '/:simulationId/messages',
  validate(createMessageSchema),
  messageController.createMessage
);

router.patch(
  '/:simulationId/messages/:messageId',
  validate(editMessageSchema),
  messageController.editMessage
);

// Feedback routes under simulation
router.get('/:simulationId/feedback', feedbackController.getSimulationFeedback);

module.exports = router;
