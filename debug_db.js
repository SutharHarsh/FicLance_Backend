const mongoose = require("mongoose");
const config = require("./src/config/env");

async function verifyQuery() {
  try {
    await mongoose.connect(config.mongoUri, { dbName: config.mongoDb });
    console.log("Connected to DB");

    // Test parameters
    const difficultyParam = "Intermediate";
    const skills = ["React"];

    const conditions = [];

    // Difficulty
    const difficultyRegex = new RegExp(`^${difficultyParam}$`, "i");
    conditions.push({
      $or: [
        { expertiseLevel: { $regex: difficultyRegex } },
        { difficulty: { $regex: difficultyRegex } },
      ],
    });

    // Skills
    const skillRegexes = skills.map((skill) => new RegExp(`^${skill}$`, "i"));
    conditions.push({
      $or: [
        { requiredSkills: { $in: skillRegexes } },
        { technologies: { $in: skillRegexes } },
      ],
    });

    const query = { $and: conditions };

    console.log("Test Query (Additive):", JSON.stringify(query, null, 2));

    const templates = await mongoose.connection.db
      .collection("projecttemplates")
      .find(query)
      .toArray();
    console.log(`Found ${templates.length} templates`);

    const found = templates.some(
      (t) => (t.title || t.name) === "E-commerce Product Page"
    );
    console.log(
      found
        ? "SUCCESS: E-commerce Product Page found with additive filters!"
        : "FAILURE: Not found."
    );

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

verifyQuery();
