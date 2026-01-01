// Central export for all models
const User = require("./User");
const AuthSession = require("./AuthSession");
const ProjectTemplate = require("./ProjectTemplate");
const Simulation = require("./Simulation");
const Message = require("./Message");
const Portfolio = require("./Portfolio");
const File = require("./File");
const Job = require("./Job");
const Feedback = require("./Feedback");
const Badge = require("./Badge");

module.exports = {
  User,
  AuthSession,
  ProjectTemplate,
  Simulation,
  Message,
  Portfolio,
  File,
  Job,
  Feedback,
  Badge,
};
