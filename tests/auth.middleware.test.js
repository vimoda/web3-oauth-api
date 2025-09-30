const request = require('supertest');
const crypto = require('crypto');
const createTestServer = require('./testServer');
const MockDeveloper = require('./mocks/Developer');

describe('HMAC Authentication Middleware', () => {
  let testApp;

  beforeEach(async () => {
    testApp = createTestServer();
    
    // El desarrollador de prueba ya se crea en setup.js
  });

  test('debería autenticar correctamente con HMAC válido', async () => {
    const body = { test: 'data' };
    const nonce = Date.now().toString();
    const payload = JSON.stringify(body) + nonce;
    const signature = crypto
      .createHmac('sha256', global.TEST_CONFIG.API_SECRET)
      .update(payload)
      .digest('base64');

    const response = await request(testApp)
      .post('/api/test-auth')
      .set('X-API-Key', global.TEST_CONFIG.API_KEY)
      .set('X-Nonce', nonce)
      .set('X-Signature', signature)
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.developer).toBe('test@example.com');
  });

  test('debería rechazar petición sin headers requeridos', async () => {
    const response = await request(testApp)
      .post('/api/test-auth')
      .send({ test: 'data' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Faltan apiKey, nonce o signature');
  });

  test('debería rechazar firma HMAC inválida', async () => {
    const body = { test: 'data' };
    const nonce = Date.now().toString();
    const wrongSignature = 'invalid-signature';

    const response = await request(testApp)
      .post('/api/test-auth')
      .set('X-API-Key', global.TEST_CONFIG.API_KEY)
      .set('X-Nonce', nonce)
      .set('X-Signature', wrongSignature)
      .send(body);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Firma inválida');
  });

  test('debería rechazar API key inexistente', async () => {
    const body = { test: 'data' };
    const nonce = Date.now().toString();
    const payload = JSON.stringify(body) + nonce;
    const signature = crypto
      .createHmac('sha256', global.TEST_CONFIG.API_SECRET)
      .update(payload)
      .digest('base64');

    const response = await request(testApp)
      .post('/api/test-auth')
      .set('X-API-Key', 'nonexistent-key')
      .set('X-Nonce', nonce)
      .set('X-Signature', signature)
      .send(body);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Clave API inválida');
  });
});