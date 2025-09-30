const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authenticateRequestTest = require('./middleware/authenticateRequestTest');
const nacl = require('tweetnacl');
const { PublicKey } = require('@solana/web3.js');
const jwt = require('jsonwebtoken');

const createTestServer = () => {
  const app = express();

  // Configuración de middleware
  app.use(cors({ origin: true }));
  app.use(express.json());

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100, // 100 solicitudes por apiKey
      keyGenerator: (req) => req.headers['x-api-key'] || 'unknown',
    })
  );

  // Ruta de prueba para verificar autenticación HMAC
  app.post('/api/test-auth', authenticateRequestTest, (req, res) => {
    res.json({ 
      success: true, 
      message: 'Autenticación exitosa',
      developer: req.developer.email,
      data: req.body
    });
  });

  // Ruta de autenticación de wallet con validación real
  app.post('/api/authenticate', authenticateRequestTest, async (req, res) => {
    const { publicKey, signature, message } = req.body;
    const developer = req.developer;
    
    if (!publicKey || !signature || !message) {
      return res.status(400).json({ error: 'Faltan datos de wallet' });
    }

    // Validar firma de wallet real
    
    try {
      // Convertir signature de array a Uint8Array si es necesario
      let signatureBytes;
      if (Array.isArray(signature)) {
        signatureBytes = new Uint8Array(signature);
      } else if (typeof signature === 'string') {
        signatureBytes = Buffer.from(signature, 'base64');
      } else {
        signatureBytes = signature;
      }

      const messageBytes = new TextEncoder().encode(message);
      const publicKeyBytes = new PublicKey(publicKey).toBytes();
      
      const isValidSignature = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      );

      if (!isValidSignature) {
        return res.status(401).json({ error: 'Firma de wallet inválida' });
      }

      // Determinar nivel de acceso basado en configuración del desarrollador
      let highestLevel = null;
      const tokenBalances = {};
      
      // Para testing, simular validación de tokens
      for (const level of developer.accessLevels) {
        if (level.tokenRequirements.length === 0) {
          // Nivel básico sin requisitos
          highestLevel = level;
        } else {
          // Para requisitos de tokens, simular que los tiene
          let meetsRequirements = true;
          for (const req of level.tokenRequirements) {
            // Simular balance suficiente para testing
            tokenBalances[`${req.tokenMintAddress}:${level.network}`] = req.minAmount + 1;
          }
          if (meetsRequirements) {
            highestLevel = level;
          }
        }
      }

      const levelName = highestLevel ? highestLevel.levelName : 'none';
      
      // Generar JWT real
      const accessToken = jwt.sign(
        { publicKey, level: levelName, tokenBalances },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '1h' }
      );

      res.json({
        success: true,
        accessToken,
        refreshToken: 'test-refresh-token-' + Date.now(),
        level: levelName,
        tokenBalances,
        expiresIn: 3600,
        publicKey
      });
      
    } catch (error) {
      console.error('Error validando firma:', error);
      res.status(500).json({ error: 'Error interno validando firma de wallet' });
    }
  });

  // Ruta de salud
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  return app;
};

module.exports = createTestServer;