const request = require('supertest');
const app = require('../../src/app');

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('services');
  });
});
