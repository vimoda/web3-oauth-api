// Mock de desarrolladores para testing sin base de datos
const developers = new Map();

class MockDeveloper {
  constructor(data) {
    Object.assign(this, data);
  }

  static async create(data) {
    const developer = new MockDeveloper(data);
    developers.set(data.apiKey, developer);
    return developer;
  }

  static async findOne(query) {
    if (query.apiKey) {
      return developers.get(query.apiKey) || null;
    }
    return null;
  }

  static async deleteMany() {
    developers.clear();
  }

  async save() {
    developers.set(this.apiKey, this);
    return this;
  }
}

// Inicializar con un desarrollador de prueba
MockDeveloper.create({
  email: 'test@example.com',
  appName: 'Test App',
  apiKey: 'test-api-key-123',
  apiSecret: 'test-api-secret-456',
  accessLevels: [
    {
      levelName: 'basic',
      network: 'mainnet',
      tokenRequirements: []
    },
    {
      levelName: 'premium',
      network: 'mainnet',
      tokenRequirements: [
        {
          tokenMintAddress: 'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v', // jupSOL
          minAmount: 0.00000001
        },
        // {
        //   tokenMintAddress: 'So11111111111111111111111111111111111111112', // SOL
        //   minAmount: 0.3
        // }
      ]
    }
  ]
});

module.exports = MockDeveloper;