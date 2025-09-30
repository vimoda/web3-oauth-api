const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authenticateRequestTest = require('./middleware/authenticateRequestTest');
const nacl = require('tweetnacl');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount, getMint } = require('@solana/spl-token');
const jwt = require('jsonwebtoken');

const createTestServer = () => {
  const app = express();

  // Conexiones a Solana (igual que en src/routes/auth.js)
  const connections = {
    testnet: new Connection(process.env.SOLANA_TESTNET_RPC || 'https://api.testnet.solana.com', {
      commitment: 'confirmed',
      httpHeaders: { 'Retry-After': 500 },
    }),
    mainnet: new Connection(process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com', {
      commitment: 'confirmed',
      httpHeaders: { 'Retry-After': 500 },
    }),
  };

  // Cache de balances y decimales (igual que en src/routes/auth.js)
  const BALANCE_CACHE_TTL_MS = 60 * 1000;
  const balanceCache = new Map();
  const tokenDecimalsCache = new Map();

  const getCachedBalance = (cacheKey) => {
    const cached = balanceCache.get(cacheKey);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > BALANCE_CACHE_TTL_MS) {
      balanceCache.delete(cacheKey);
      return null;
    }
    return cached.value;
  };

  const setCachedBalance = (cacheKey, value) => {
    balanceCache.set(cacheKey, { value, timestamp: Date.now() });
  };

  const getTokenDecimals = async (connection, mintAddress, network) => {
    const cacheKey = `${network}:${mintAddress}`;
    if (tokenDecimalsCache.has(cacheKey)) {
      return tokenDecimalsCache.get(cacheKey);
    }

    try {
      const mintInfo = await getMint(connection, new PublicKey(mintAddress));
      const decimals = Number(mintInfo?.decimals ?? 0);
      tokenDecimalsCache.set(cacheKey, decimals);
      return decimals;
    } catch (error) {
      console.warn(`No se pudo obtener decimales para el mint ${mintAddress} en ${network}`, error?.message || error);
      tokenDecimalsCache.set(cacheKey, 0);
      return 0;
    }
  };

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
      // Ahora usa validación REAL de balances en Solana
      let highestLevel = null;
      const tokenBalances = {};
      
      for (const level of developer.accessLevels) {
        let meetsRequirements = true;
        const balances = {};

        const connection = connections[level.network];
        if (!connection) {
          meetsRequirements = false;
          continue;
        }

        // Si no hay requisitos de tokens, es nivel básico
        if (level.tokenRequirements.length === 0) {
          highestLevel = level;
          continue;
        }

        // Validar cada requisito de token consultando Solana
        for (const req of level.tokenRequirements) {
          const cacheKey = `balance:${publicKey}:${req.tokenMintAddress}:${level.network}`;
          const decimals = await getTokenDecimals(connection, req.tokenMintAddress, level.network);
          let balance = getCachedBalance(cacheKey);

          if (balance === null) {
            try {
              const tokenAccount = await getAssociatedTokenAddress(
                new PublicKey(req.tokenMintAddress),
                new PublicKey(publicKey)
              );
              const accountInfo = await getAccount(connection, tokenAccount);
              const rawAmount = accountInfo?.amount ? Number(accountInfo.amount) : 0;
              balance = rawAmount / 10 ** decimals;
            } catch (error) {
              console.log(`No se encontró cuenta de token para ${req.tokenMintAddress} en ${level.network}:`, error.message);
              balance = 0;
            }

            setCachedBalance(cacheKey, balance);
          }

          balances[req.tokenMintAddress] = balance;
          tokenBalances[`${req.tokenMintAddress}:${level.network}`] = balance;
          
          if (balance < req.minAmount) {
            meetsRequirements = false;
          }
        }

        if (meetsRequirements && (!highestLevel || developer.accessLevels.indexOf(level) > developer.accessLevels.indexOf(highestLevel))) {
          highestLevel = level;
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