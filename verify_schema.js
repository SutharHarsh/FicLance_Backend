require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function test() {
    try {
        console.log("Connecting to DB (Nested Payload Test)...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected.");

        const user = await User.findOne({ deleted: false });
        if (!user) { process.exit(1); }
        console.log(`Found user: ${user.email}`);

        // Mimic the frontend/controller payload exactly
        // The controller receives req.body.profile and assigns it to allowedUpdates.profile

        // We construct a FULL profile object
        const existingProfile = user.profile ? user.profile.toObject() : {};

        const nestedUpdate = {
            profile: {
                ...existingProfile, // Spread existing
                portfolio: {
                    // ...existingProfile.portfolio, // Frontend replaces this!
                    themeId: "executive-professional",
                    isPublic: false,
                    experiences: [{
                        company: "NESTED_TEST_CORP",
                        organization: "NESTED_ORG",
                        startDate: "2024-01",
                        endDate: "Present",
                        currentlyWorking: true,
                        description: "Testing nested object update persistence."
                    }]
                }
            }
        };

        console.log("Saving NESTED payload...");

        // Mimic user.service.js which uses filteredUpdates object
        const userUpdated = await User.findByIdAndUpdate(
            user._id,
            nestedUpdate,
            { new: true, runValidators: true }
        );

        const savedExp = userUpdated.profile.portfolio.experiences;
        console.log("Resulting Experiences:", JSON.stringify(savedExp, null, 2));

        if (savedExp && savedExp.length > 0 && savedExp[0].company === "NESTED_TEST_CORP") {
            console.log("✅ SUCCESS: Nested Payload Saved!");
        } else {
            console.log("❌ FAILURE: Nested Payload failed to save experiences.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

test();
