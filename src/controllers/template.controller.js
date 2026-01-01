const { ProjectTemplate } = require("../models");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * List project templates
 * GET /templates
 */
async function listTemplates(req, res, next) {
  try {
    const { expertise, skills, search, limit, difficulty, duration } =
      req.query;

    // Build query - don't filter by isActive since your DB documents don't have it
    const conditions = [];

    // 1. Difficulty / Expertise Filter
    const difficultyParam = difficulty || expertise;
    if (difficultyParam && difficultyParam !== "All") {
      const difficultyRegex = new RegExp(`^${difficultyParam}$`, "i");
      conditions.push({
        $or: [
          { expertiseLevel: { $regex: difficultyRegex } },
          { difficulty: { $regex: difficultyRegex } },
        ],
      });
    }

    // 2. Duration filter
    if (duration && duration !== "Any duration") {
      const numericDays = parseInt(duration.replace(/[^0-9]/g, ""));
      const durationConditions = [];

      // Numeric check for durationEstimateDays
      if (!isNaN(numericDays)) {
        durationConditions.push({
          durationEstimateDays: { $lte: numericDays },
        });
      }

      // String check for 'duration' field (e.g. "3-5 hours", "1 week")
      durationConditions.push({
        duration: { $regex: new RegExp(duration, "i") },
      });

      conditions.push({ $or: durationConditions });
    }

    // 3. Skills / Technologies filter
    if (skills) {
      const skillList = Array.isArray(skills)
        ? skills
        : skills.split(",").map((s) => s.trim());

      const skillRegexes = skillList.map(
        (skill) => new RegExp(`^${skill}$`, "i")
      );

      conditions.push({
        $or: [
          { requiredSkills: { $in: skillRegexes } },
          { technologies: { $in: skillRegexes } },
        ],
      });
    }

    // 4. Search filter
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      conditions.push({
        $or: [
          { name: searchRegex },
          { title: searchRegex },
          { shortDescription: searchRegex },
          { description: searchRegex },
        ],
      });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};

    console.log("[Templates] Query:", JSON.stringify(query, null, 2));

    const templates = await ProjectTemplate.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 50)
      .select("-__v")
      .lean();

    console.log(`[Templates] Found ${templates.length} templates`);

    return res.json(successResponse(templates));
  } catch (error) {
    next(error);
  }
}

/**
 * Get template by ID
 * GET /templates/:id
 */
async function getTemplate(req, res, next) {
  try {
    const { id } = req.params;

    const template = await ProjectTemplate.findById(id);

    if (!template) {
      return res.status(404).json(errorResponse("Template not found"));
    }

    return res.json(successResponse(template));
  } catch (error) {
    next(error);
  }
}

/**
 * Create template (Admin)
 */
async function createTemplate(req, res, next) {
  try {
    const template = await ProjectTemplate.create(req.body);
    return res.status(201).json(successResponse(template, "Template created"));
  } catch (error) {
    next(error);
  }
}

/**
 * Update template (Admin)
 */
async function updateTemplate(req, res, next) {
  try {
    const { id } = req.params;
    const template = await ProjectTemplate.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!template)
      return res.status(404).json(errorResponse("Template not found"));
    return res.json(successResponse(template, "Template updated"));
  } catch (error) {
    next(error);
  }
}

/**
 * Delete template (Admin)
 */
async function deleteTemplate(req, res, next) {
  try {
    const { id } = req.params;
    const template = await ProjectTemplate.findByIdAndDelete(id);
    if (!template)
      return res.status(404).json(errorResponse("Template not found"));
    return res.json(successResponse(null, "Template deleted"));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};
