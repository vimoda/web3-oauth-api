// Setup sin MongoDB - usando mocks en memoria
const MockDeveloper = require('./mocks/Developer');

beforeAll(async () => {
  // Configuración inicial para tests sin base de datos
  console.log('🚀 Iniciando tests sin base de datos...');
});

afterAll(async () => {
  // Limpiar después de todos los tests
  console.log('✅ Tests completados');
});

afterEach(async () => {
  // Limpiar mocks después de cada test
  await MockDeveloper.deleteMany();
  
  // Recrear desarrollador de prueba por defecto
  await MockDeveloper.create({
    email: 'test@example.com',
    appName: 'Test App',
    apiKey: global.TEST_CONFIG.API_KEY,
    apiSecret: global.TEST_CONFIG.API_SECRET,
    accessLevels: [
      {
        levelName: 'basic',
        network: 'testnet',
        tokenRequirements: []
      }
    ]
  });
});

// Mock para evitar conexiones reales a Solana durante tests
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getAccountInfo: jest.fn(),
    getTokenAccountsByOwner: jest.fn(),
  })),
  PublicKey: jest.fn().mockImplementation((key) => ({
    toString: () => key,
    toBuffer: () => Buffer.from(key, 'base64'),
  })),
}));

jest.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: jest.fn().mockResolvedValue('mocked-token-address'),
  getAccount: jest.fn().mockResolvedValue({ amount: BigInt(1000) }),
  getMint: jest.fn().mockResolvedValue({ decimals: 9 }),
}));

// Variables globales para tests
global.TEST_CONFIG = {
  JWT_SECRET: 'test-jwt-secret',
  API_KEY: 'test-api-key-123',
  API_SECRET: 'test-api-secret-456',
  PUBLIC_KEY: '11111111111111111111111111111112',
};