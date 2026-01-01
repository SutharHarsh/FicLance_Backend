const request = require('supertest');
const app = require('../../src/app');
const { User } = require('../../src/models');

describe('Subscription Integration Tests', () => {
  let accessToken;
  let userId;

  beforeEach(async () => {
    // Register and login a user
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test User',
        email: 'sub@example.com',
        password: 'Password123',
      });

    userId = registerRes.body.data._id;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'sub@example.com',
        password: 'Password123',
      });

    accessToken = loginRes.body.data.accessToken;
  });

  describe('GET /api/v1/subscriptions/status', () => {
    it('should return subscription status for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/subscriptions/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('plan');
      expect(res.body.data.plan).toBe('free');
      expect(res.body.data).toHaveProperty('limits');
      expect(res.body.data.limits.maxProjects).toBe(5);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/subscriptions/status')
        .expect(401);
    });
  });

  describe('POST /api/v1/subscriptions/create-checkout-session', () => {
    it('should reject free plan', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/create-checkout-session')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ plan: 'free' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject invalid plan', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/create-checkout-session')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ plan: 'invalid' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    // Note: Actual Stripe checkout requires valid API keys
    // In test environment without Stripe configured, this will fail gracefully
  });

  describe('GET /api/v1/limits/check', () => {
    it('should return user limits and usage', async () => {
      const res = await request(app)
        .get('/api/v1/limits/check')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('plan');
      expect(res.body.data).toHaveProperty('limits');
      expect(res.body.data).toHaveProperty('usage');
      expect(res.body.data).toHaveProperty('capabilities');

      expect(res.body.data.plan.name).toBe('free');
      expect(res.body.data.limits.maxProjects).toBe(5);
      expect(res.body.data.capabilities.canCreateProject).toBe(true);
    });
  });

  describe('Plan Enforcement', () => {
    it('should allow free user to create up to 5 simulations', async () => {
      // Create 5 simulations (free plan limit)
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/v1/simulations')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            projectName: `Test Project ${i}`,
            projectDescription: 'Test description',
          })
          .expect(202);

        expect(res.body.success).toBe(true);
      }
    });

    it('should block free user from creating 6th simulation', async () => {
      // Create 5 simulations first
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/simulations')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            projectName: `Test Project ${i}`,
            projectDescription: 'Test description',
          });
      }

      // 6th should fail
      const res = await request(app)
        .post('/api/v1/simulations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          projectName: 'Test Project 6',
          projectDescription: 'Test description',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('plan limit');
    });

    it('should block free user from making portfolio public', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ portfolioPublic: true })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('does not support public portfolios');
    });
  });

  describe('Subscription Upgrade', () => {
    it('should allow more projects after upgrade to premium', async () => {
      // Manually upgrade user to premium (simulating successful payment)
      await User.findByIdAndUpdate(userId, {
        'subscription.plan': 'premium',
        'subscription.status': 'active',
      });

      // Should now be able to create more simulations
      const res = await request(app)
        .post('/api/v1/simulations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          projectName: 'Premium Project',
          projectDescription: 'Test description',
        })
        .expect(202);

      expect(res.body.success).toBe(true);
    });

    it('should allow making portfolio public after upgrade', async () => {
      // Upgrade to premium
      await User.findByIdAndUpdate(userId, {
        'subscription.plan': 'premium',
        'subscription.status': 'active',
      });

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ portfolioPublic: true })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
