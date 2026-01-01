const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const mongoose = require("mongoose");
const Project = require("../models/Project");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;


// 🔧 CONFIG
// const MONGO_URI = "mongodb://127.0.0.1:27017/yourDatabaseName";
const CSV_PATH = path.join(__dirname, "../data/projects_master.csv");

// 🧠 Connect DB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Utility: validate expertise
const VALID_LEVELS = ["beginner", "intermediate", "advanced"];

function validateRow(row, index) {
  // name
  if (!row.name || row.name.trim().length < 3 || row.name.trim().length > 200) {
    throw `Row ${index}: Invalid name`;
  }

  // shortDescription (optional but length-limited)
  if (row.shortDescription && row.shortDescription.length > 500) {
    throw `Row ${index}: shortDescription too long`;
  }

  // longDescription (optional but length-limited)
  if (row.longDescription && row.longDescription.length > 5000) {
    throw `Row ${index}: longDescription too long`;
  }

  // expertiseLevel
  if (!row.expertiseLevel) {
    throw `Row ${index}: Missing expertiseLevel`;
  }

  if (!VALID_LEVELS.includes(row.expertiseLevel.trim())) {
    throw `Row ${index}: Invalid expertiseLevel`;
  }

  // durationEstimateDays (NOW STRING-BASED)
  if (
    !row.durationEstimateDays ||
    typeof row.durationEstimateDays !== "string"
  ) {
    throw `Row ${index}: Missing durationEstimateDays`;
  }

  if (row.durationEstimateDays.trim().length < 2) {
    throw `Row ${index}: durationEstimateDays too short`;
  }

  // complexityScore (still numeric)
  const complexity = Number(row.complexityScore);
  if (isNaN(complexity) || complexity < 1 || complexity > 10) {
    throw `Row ${index}: Invalid complexityScore`;
  }

  // requiredSkills
  if (!row.requiredSkills) {
    throw `Row ${index}: requiredSkills missing`;
  }

  if (!row.requiredSkills.includes("|")) {
    throw `Row ${index}: requiredSkills must be pipe-separated`;
  }
}

async function runImport() {
  const projecttemplates = [];
  let rowIndex = 1;

  fs.createReadStream(CSV_PATH)
    .pipe(
      csv({
        mapHeaders: ({ header }) =>
          header.trim().replace(/\s+/g, "").replace(/\r/g, ""),
      })
    )

    .on("data", (row) => {
      try {
        validateRow(row, rowIndex++);

        projecttemplates.push({
          name: row.name.trim(),

          shortDescription: row.shortDescription
            ? row.shortDescription.trim()
            : "",

          longDescription: row.longDescription
            ? row.longDescription.trim()
            : "",

          requiredSkills: row.requiredSkills.split("|").map((s) => s.trim()),

          expertiseLevel: row.expertiseLevel.trim(),

          // ✅ STORED AS STRING (e.g. "6-10 hours")
          durationEstimateDays: row.durationEstimateDays.trim(),

          tags: row.tags ? row.tags.split("|").map((t) => t.trim()) : [],

          complexityScore: Number(row.complexityScore),
        });
      } catch (err) {
        console.error("❌ Validation Error:", err);
        mongoose.disconnect();
        process.exit(1);
      }
    })
    .on("end", async () => {
      try {
        // OPTIONAL (first-time seeding only)
        // await Project.deleteMany({});

        await Project.insertMany(projecttemplates, { ordered: true });
        console.log(`✅ Successfully imported ${projecttemplates.length} projects`);
        mongoose.disconnect();
      } catch (err) {
        console.error("❌ MongoDB Insert Error:", err);
        mongoose.disconnect();
      }
    });
}

runImport();
