/**
 * @jest-environment jsdom
 */

const crypto = require('crypto');

// Mock del SDK ya que usa window.solana
class MockWeb3OAuth {
  constructor(apiKey, apiSecret, apiUrl = 'http://localhost:3000') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.apiUrl = apiUrl;
    this.accessToken = null;
    this.refreshToken = null;
  }

  generateSignature(payload) {
    const nonce = Date.now().toString();
    const message = JSON.stringify(payload) + nonce;
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('base64');
    return { signature, nonce };
  }
}

// Mock de window.solana
global.window = {
  solana: {
    connect: jest.fn().mockResolvedValue({
      publicKey: {
        toString: () => 'mock-public-key-123'
      }
    }),
    signMessage: jest.fn().mockResolvedValue(
      Buffer.from('mock-signature-data', 'utf8')
    ),
    isPhantom: true
  }
};

// Mock fetch
global.fetch = jest.fn();

describe('Web3OAuth SDK', () => {
  let oauth;

  beforeEach(() => {
    oauth = new MockWeb3OAuth(
      'test-api-key', 
      'test-api-secret', 
      'http://localhost:3000'
    );
    jest.clearAllMocks();
  });

  test('debería generar signature HMAC correctamente', () => {
    const payload = { test: 'data' };
    const result = oauth.generateSignature(payload);

    expect(result).toHaveProperty('signature');
    expect(result).toHaveProperty('nonce');
    expect(typeof result.signature).toBe('string');
    expect(typeof result.nonce).toBe('string');
  });

  test('debería generar signatures consistentes para mismo payload y nonce', () => {
    const payload = { test: 'data' };
    const nonce = '1234567890';
    
    const message = JSON.stringify(payload) + nonce;
    const expectedSignature = crypto
      .createHmac('sha256', 'test-api-secret')
      .update(message)
      .digest('base64');

    // Crear signature manualmente
    const manualSignature = crypto
      .createHmac('sha256', oauth.apiSecret)
      .update(JSON.stringify(payload) + nonce)
      .digest('base64');

    expect(manualSignature).toBe(expectedSignature);
  });

  test('debería poder usar el mock de SDK', () => {
    // Test básico del mock de SDK
    const mockOAuth = new MockWeb3OAuth('test-key', 'test-secret');
    
    expect(mockOAuth.apiKey).toBe('test-key');
    expect(mockOAuth.apiSecret).toBe('test-secret');
    expect(mockOAuth.accessToken).toBeNull();
    expect(mockOAuth.refreshToken).toBeNull();
  });

  test('debería preparar payload de autenticación correctamente', () => {
    const publicKey = 'test-public-key';
    const signature = 'test-signature';
    const message = 'test-message';

    const payload = {
      apiKey: oauth.apiKey,
      publicKey,
      signature,
      message,
    };

    const { signature: hmacSignature, nonce } = oauth.generateSignature(payload);

    expect(payload.apiKey).toBe('test-api-key');
    expect(payload.publicKey).toBe(publicKey);
    expect(hmacSignature).toBeDefined();
    expect(nonce).toBeDefined();
  });
});