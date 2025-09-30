const crypto = require('crypto');
const axios = require('axios');

class TestRunner {
  constructor() {
    this.baseURL = 'http://localhost:3001'; // Puerto diferente para servidor de test
    this.apiKey = 'test-api-key-123';
    this.apiSecret = 'test-api-secret-456';
  }

  generateHMACSignature(body, nonce) {
    const payload = JSON.stringify(body) + nonce;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('base64');
  }

  async testHMACAuth() {
    console.log('🧪 Probando autenticación HMAC...');
    
    const body = { test: 'data' };
    const nonce = Date.now().toString();
    const signature = this.generateHMACSignature(body, nonce);

    try {
      const response = await axios.post(`${this.baseURL}/api/test-auth`, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-Nonce': nonce,
          'X-Signature': signature,
        }
      });
      
      console.log('✅ HMAC Auth exitoso:', response.data);
    } catch (error) {
      console.log('❌ Error HMAC Auth:', error.response?.data || error.message);
    }
  }

  async testInvalidSignature() {
    console.log('🧪 Probando firma inválida...');
    
    const body = { test: 'data' };
    const nonce = Date.now().toString();
    const invalidSignature = 'firma-invalida';

    try {
      const response = await axios.post(`${this.baseURL}/api/test-auth`, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-Nonce': nonce,
          'X-Signature': invalidSignature,
        }
      });
      
      console.log('⚠️ Respuesta inesperada:', response.data);
    } catch (error) {
      console.log('✅ Error esperado:', error.response?.data || error.message);
    }
  }

  async testRateLimit() {
    console.log('🧪 Probando rate limiting...');
    
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(this.makeTestRequest(i));
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`✅ Exitosas: ${successful}, ❌ Fallidas: ${failed}`);
  }

  async makeTestRequest(index) {
    const body = { test: `data-${index}` };
    const nonce = (Date.now() + index).toString();
    const signature = this.generateHMACSignature(body, nonce);

    return axios.post(`${this.baseURL}/api/test-auth`, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Nonce': nonce,
        'X-Signature': signature,
      }
    });
  }

  async runAllTests() {
    console.log('🚀 Iniciando tests manuales...\n');
    
    await this.testHMACAuth();
    console.log('');
    
    await this.testInvalidSignature();
    console.log('');
    
    await this.testRateLimit();
    console.log('');
    
    console.log('✨ Tests manuales completados');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch(console.error);
}

module.exports = TestRunner;