const createTestServer = require('./testServer');

const app = createTestServer();
const PORT = 3001;

app.listen(PORT, () => {

  console.log(`🧪 Servidor de testing corriendo en puerto ${PORT}`);
  console.log(`📋 Endpoints disponibles:`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`   POST http://localhost:${PORT}/api/test-auth`);
  console.log(`   POST http://localhost:${PORT}/api/authenticate`);
  console.log('\n🔑 API Key de prueba: test-api-key-123');
  console.log('🔐 API Secret de prueba: test-api-secret-456');
  console.log('\n💡 Para testear manualmente:');
  console.log('   node tests/manual-test.js o npm run test:manual');
});