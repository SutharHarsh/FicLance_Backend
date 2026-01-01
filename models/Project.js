const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, minlength: 3, maxlength: 200 },
    shortDescription: { type: String, maxlength: 500 },
    longDescription: { type: String, maxlength: 5000 },
    requiredSkills: { type: [String], required: true },
    expertiseLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
    },
    durationEstimateDays: {
      type: String,
      required: true,
      trim: true,
    },

    tags: [String],
    complexityScore: { type: Number, min: 1, max: 10 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
