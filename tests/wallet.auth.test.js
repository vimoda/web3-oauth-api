const request = require('supertest');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const { Keypair } = require('@solana/web3.js');
const createTestServer = require('./testServer');
const MockDeveloper = require('./mocks/Developer');

// Helper para generar HMAC signature
const generateHMACSignature = (body, nonce, apiSecret) => {
  const payload = JSON.stringify(body) + nonce;
  return crypto
    .createHmac('sha256', apiSecret)
    .update(payload)
    .digest('base64');
};

describe('Wallet Authentication', () => {
  let testApp;

  beforeEach(async () => {
    testApp = createTestServer();
  });

  test('debería simular autenticación de wallet', async () => {
    const message = `Autenticación para ${global.TEST_CONFIG.API_KEY} en ${new Date().toISOString()}`;
    
    // Generar un par de claves Solana válido para testing
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toString();
    
    // Firmar el mensaje con la clave privada
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    
    const body = {
      apiKey: global.TEST_CONFIG.API_KEY,
      publicKey: publicKey,
      signature: Array.from(signature),
      message
    };

    const nonce = Date.now().toString();
    const hmacSignature = generateHMACSignature(body, nonce, global.TEST_CONFIG.API_SECRET);

    const response = await request(testApp)
      .post('/api/authenticate')
      .set('X-API-Key', global.TEST_CONFIG.API_KEY)
      .set('X-Nonce', nonce)
      .set('X-Signature', hmacSignature)
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.level).toBeDefined();
    expect(response.body.tokenBalances).toBeDefined();
  }, 30000); // Increased timeout to 30 seconds for Solana RPC calls

  test('debería rechazar datos de wallet incompletos', async () => {
    const body = {
      apiKey: global.TEST_CONFIG.API_KEY,
      // Faltan publicKey, signature, message
    };

    const nonce = Date.now().toString();
    const hmacSignature = generateHMACSignature(body, nonce, global.TEST_CONFIG.API_SECRET);

    const response = await request(testApp)
      .post('/api/authenticate')
      .set('X-API-Key', global.TEST_CONFIG.API_KEY)
      .set('X-Nonce', nonce)
      .set('X-Signature', hmacSignature)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Faltan datos de wallet');
  });
});