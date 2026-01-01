const mongoose = require('mongoose');
const config = require('../src/config/env');
const { ProjectTemplate, User } = require('../src/models');
const logger = require('../src/config/logger');
const bcrypt = require('bcrypt');

const sampleTemplates = [
  {
    name: 'E-commerce Platform',
    shortDescription: 'Build a full-featured e-commerce platform with product catalog, cart, and checkout',
    longDescription: 'Create a complete e-commerce solution with user authentication, product management, shopping cart functionality, and secure payment processing. Includes admin panel for inventory management.',
    requiredSkills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Stripe'],
    expertiseLevel: 'advanced',
    durationEstimateDays: 90,
    tags: ['e-commerce', 'full-stack', 'payments'],
    complexityScore: 8,
  },
  {
    name: 'Task Management App',
    shortDescription: 'Create a modern task management application with real-time collaboration',
    longDescription: 'Build a Trello-like board with drag-and-drop functionality, real-time updates, team collaboration features, and project analytics.',
    requiredSkills: ['JavaScript', 'React', 'Node.js', 'Socket.io'],
    expertiseLevel: 'intermediate',
    durationEstimateDays: 45,
    tags: ['productivity', 'real-time', 'collaboration'],
    complexityScore: 6,
  },
  {
    name: 'Blog Platform',
    shortDescription: 'Build a modern blog platform with CMS features',
    longDescription: 'Create a content management system for blogs with markdown editor, SEO optimization, comment system, and analytics dashboard.',
    requiredSkills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
    expertiseLevel: 'beginner',
    durationEstimateDays: 30,
    tags: ['content', 'cms', 'blog'],
    complexityScore: 4,
  },
  {
    name: 'Real-time Chat Application',
    shortDescription: 'Develop a scalable real-time messaging platform',
    longDescription: 'Build a modern chat application with WebSocket support, group chats, file sharing, emoji reactions, and end-to-end encryption.',
    requiredSkills: ['JavaScript', 'Socket.io', 'React', 'Redis'],
    expertiseLevel: 'intermediate',
    durationEstimateDays: 60,
    tags: ['real-time', 'messaging', 'websockets'],
    complexityScore: 7,
  },
];

async function seedTemplates() {
  try {
    await mongoose.connect(config.mongoUri, {
      dbName: config.mongoDb,
    });

    logger.info('Connected to database');

    // Create admin user if ADMIN_USER_IDS not set
    let adminUser;
    if (!process.env.ADMIN_USER_IDS) {
      const adminPassword = 'Admin123!'; // Change this in production!
      
      adminUser = await User.findOne({ email: 'admin@ficlance.com' });
      
      if (!adminUser) {
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        adminUser = await User.create({
          name: 'Admin User',
          email: 'admin@ficlance.com',
          passwordHash,
          providers: [{
            provider: 'local',
            providerId: 'admin@ficlance.com',
          }],
        });

        logger.info(`Admin user created: ${adminUser._id}`);
        logger.info(`Admin email: admin@ficlance.com`);
        logger.info(`Admin password: ${adminPassword} (CHANGE THIS!)`);
        logger.info(`Add this to .env: ADMIN_USER_IDS=${adminUser._id}`);
      }
    }

    // Seed templates
    for (const templateData of sampleTemplates) {
      const existing = await ProjectTemplate.findOne({ name: templateData.name });
      
      if (!existing) {
        const template = await ProjectTemplate.create({
          ...templateData,
          createdBy: adminUser?._id || new mongoose.Types.ObjectId(),
          isActive: true,
        });

        logger.info(`Created template: ${template.name}`);
      } else {
        logger.info(`Template already exists: ${templateData.name}`);
      }
    }

    logger.info('Seeding completed');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedTemplates();
