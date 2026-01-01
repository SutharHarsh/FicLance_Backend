const { Simulation, ProjectTemplate } = require('../../src/models');
const logger = require('../../src/config/logger');

module.exports = {
  name: 'backfill-templateSnapshot',

  async up() {
    logger.info('Backfilling templateSnapshot for existing simulations...');

    const simulations = await Simulation.find({
      projectTemplateId: { $exists: true, $ne: null },
      templateSnapshot: { $exists: false },
    }).populate('projectTemplateId');

    let updated = 0;

    for (const simulation of simulations) {
      if (!simulation.projectTemplateId) continue;

      const template = simulation.projectTemplateId;

      simulation.templateSnapshot = {
        name: template.name,
        shortDescription: template.shortDescription,
        requiredSkills: template.requiredSkills,
        expertiseLevel: template.expertiseLevel,
        durationEstimateDays: template.durationEstimateDays,
        complexityScore: template.complexityScore,
        version: template.version,
      };

      await simulation.save();
      updated++;
    }

    logger.info(`Updated ${updated} simulations with templateSnapshot`);
  },
};
