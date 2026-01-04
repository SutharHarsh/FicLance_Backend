
const mongoose = require('mongoose');
const config = require('../config/env');
const { User } = require('../models');

async function check() {
    try {
        await mongoose.connect(config.mongoUri);
        console.log('Connected to DB');

        const userId = "695249b37511fd9961f51960";
        const user = await User.findById(userId);

        if (user) {
            console.log('User Found:', user.email);
            console.log('Full Profile:', JSON.stringify(user.profile, null, 2));
        } else {
            console.log('User not found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

check();
