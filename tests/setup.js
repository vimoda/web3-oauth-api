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

// Variables globales para tests
global.TEST_CONFIG = {
  JWT_SECRET: 'test-jwt-secret',
  API_KEY: 'test-api-key-123',
  API_SECRET: 'test-api-secret-456',
  PUBLIC_KEY: '11111111111111111111111111111112',
};