
const mongoose = require('mongoose');
const limitsService = require('../services/limits.service');
const config = require('../config/env');

async function check() {
    try {
        await mongoose.connect(config.mongoUri);
        console.log('Connected to DB');

        const userId = "695249b37511fd9961f51960";
        console.log(`Checking limits for user: ${userId}`);

        const result = await limitsService.canCreateProject(userId);
        console.log('Result:', JSON.stringify(result, null, 2));

        const simulations = await mongoose.model('Simulation').find({ userId });
        console.log('\n--- ALL Simulations Detail ---');
        simulations.forEach(sim => {
            const comp = sim.meta?.completionPercentage || 0;
            console.log(`ID: ${sim._id.toString().slice(-4)} | State: ${sim.state.padEnd(20)} | Comp: ${String(comp).padStart(3)}% | CreatedAt: ${sim.createdAt.toISOString()}`);
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

check();
