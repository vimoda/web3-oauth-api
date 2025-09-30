const express = require('express');
const { getTokenMetadata, PROGRAM_ID: METADATA_PROGRAM_ID } = require('@solana/spl-token-metadata');
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

  // Cache de balances y decimales - Configurable con 1 hora por defecto
  const BALANCE_CACHE_TTL_MS = process.env.BALANCE_CACHE_TTL_HOURS ? 
    parseInt(process.env.BALANCE_CACHE_TTL_HOURS) * 60 * 60 * 1000 : 
    60 * 60 * 1000; // 1 hora por defecto
    
  const balanceCache = new Map();
  const tokenDecimalsCache = new Map();
  
  console.log(`⏱️ Cache de balances configurado con TTL: ${BALANCE_CACHE_TTL_MS / 1000 / 60} minutos`);

  const sanitizeAccessLevels = (rawAccessLevels, fallbackAccessLevels = []) => {
    if (!Array.isArray(rawAccessLevels)) {
      return fallbackAccessLevels;
    }

    const allowedNetworks = new Set(['mainnet', 'testnet']);

    const sanitized = rawAccessLevels
      .map((level, index) => {
        if (!level || typeof level !== 'object') {
          return null;
        }

        const network = typeof level.network === 'string' ? level.network.toLowerCase().trim() : null;
        if (!network || !allowedNetworks.has(network)) {
          console.warn(`⚠️ Nivel personalizado ${index} ignorado: red inválida (${level.network})`);
          return null;
        }

        const levelName = level.levelName ? String(level.levelName).trim() : 'custom';
        const rawRequirements = Array.isArray(level.tokenRequirements) ? level.tokenRequirements : [];

        const tokenRequirements = rawRequirements
          .map((req, reqIndex) => {
            if (!req || typeof req !== 'object') {
              return null;
            }

            const tokenMintAddress = req.tokenMintAddress ? String(req.tokenMintAddress).trim() : '';
            if (!tokenMintAddress) {
              console.warn(`⚠️ Requisito de token ${reqIndex} ignorado: tokenMintAddress vacío`);
              return null;
            }

            const minAmountNumber = Number(req.minAmount);
            const minAmount = Number.isFinite(minAmountNumber) ? minAmountNumber : 0;

            return {
              tokenMintAddress,
              minAmount,
            };
          })
          .filter(Boolean);

        return {
          levelName,
          network,
          tokenRequirements,
        };
      })
      .filter(Boolean);

    if (!sanitized.length) {
      return fallbackAccessLevels;
    }

    console.log(`⚙️ Usando niveles de acceso proporcionados en request (${sanitized.length})`);
    return sanitized;
  };

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
  // Obtener metadatos de un token SPL (nombre y símbolo)
  const getTokenNameAndSymbol = async (connection, mintAddress) => {
    try {
      const metadata = await getTokenMetadata(connection, new PublicKey(mintAddress));
      return {
        name: metadata?.name || '',
        symbol: metadata?.symbol || '',
      };
    } catch (e) {
      return { name: '', symbol: '' };
    }
  };
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

  // Función para validar balances de tokens con caché inteligente
  const validateTokenBalances = async (publicKey, accessLevels, connections) => {
    let highestLevel = null;
    const tokenBalances = {};
    
    console.log(`🔍 Validando balances para wallet: ${publicKey}`);
    
    for (const level of accessLevels) {
      let meetsRequirements = true;
      const connection = connections[level.network];
      
      if (!connection) {
        console.warn(`❌ No hay conexión para la red: ${level.network}`);
        meetsRequirements = false;
        continue;
      }

      // Si no hay requisitos de tokens, es nivel básico
      if (level.tokenRequirements.length === 0) {
        console.log(`✅ Nivel ${level.levelName}: Sin requisitos de tokens`);
        if (!highestLevel || accessLevels.indexOf(level) > accessLevels.indexOf(highestLevel)) {
          highestLevel = level;
        }
        continue;
      }

      // Validar cada requisito de token
      for (const req of level.tokenRequirements) {
        const cacheKey = `balance:${publicKey}:${req.tokenMintAddress}:${level.network}`;
        let balance = getCachedBalance(cacheKey);
        
        if (balance === null) {
          console.log(`💰 Consultando balance real para token ${req.tokenMintAddress} en ${level.network}`);
          
          const decimals = await getTokenDecimals(connection, req.tokenMintAddress, level.network);
          
          try {
            const tokenAccount = await getAssociatedTokenAddress(
              new PublicKey(req.tokenMintAddress),
              new PublicKey(publicKey)
            );

            const accountInfo = await getAccount(connection, tokenAccount);
            const rawAmount = accountInfo?.amount ? Number(accountInfo.amount) : 0;
            balance = rawAmount / (10 ** decimals);
            
            console.log(`📊 Balance obtenido: ${balance} tokens (${rawAmount} raw, ${decimals} decimales)`);
          } catch (error) {
            console.log(`⚠️ No se encontró cuenta de token: ${error.message}`);
            balance = 0;
          }

          // Guardar en caché
          setCachedBalance(cacheKey, balance);
        } else {
          console.log(`🎫 Usando balance desde caché: ${balance} tokens`);
        }

        tokenBalances[`${req.tokenMintAddress}:${level.network}`] = balance;
        
        if (balance < req.minAmount) {
          console.log(`❌ Nivel ${level.levelName}: Balance ${balance} < requerido ${req.minAmount}`);
          meetsRequirements = false;
        } else {
          console.log(`✅ Nivel ${level.levelName}: Balance ${balance} >= requerido ${req.minAmount}`);
        }
      }

      if (meetsRequirements && (!highestLevel || accessLevels.indexOf(level) > accessLevels.indexOf(highestLevel))) {
        highestLevel = level;
        console.log(`🎯 Nuevo nivel más alto alcanzado: ${level.levelName}`);
      }
    }

    const levelName = highestLevel ? highestLevel.levelName : 'none';
    console.log(`🏆 Nivel final asignado: ${levelName}`);
    
    return { levelName, tokenBalances };
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
    console.log('publicKey ', publicKey);
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

      // Validar balances de tokens con caché inteligente
      console.log(`🔐 Iniciando validación de acceso para ${publicKey}`);
      const accessLevels = sanitizeAccessLevels(req.body.accessLevels, developer.accessLevels);
      const { levelName, tokenBalances } = await validateTokenBalances(publicKey, accessLevels, connections);

      if (!levelName || levelName === 'none') {
        return res.status(403).json({
          success: false,
          error: 'No tienes acceso a ningún nivel',
          level: 'none',
          tokenBalances,
          accessLevels,
          publicKey
        });
      }

      // Generar JWT real
      const accessToken = jwt.sign(
        { publicKey, level: levelName, tokenBalances },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign(
        { publicKey, level: levelName },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        accessToken,
        refreshToken,
        level: levelName,
        tokenBalances,
        accessLevels,
        expiresIn: 3600,
        publicKey
      });
      
    } catch (error) {
      console.error('Error validando firma:', error);
      res.status(500).json({ error: 'Error interno validando firma de wallet' });
    }
  });

  // Ruta para verificar token de acceso real
  app.get('/api/verify-token', async (req, res) => {
    console.log('Verificando token de acceso');
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta token de acceso' });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret');
      res.json({ valid: true, decoded });
    } catch (error) {
      res.status(401).json({ valid: false, error: 'Token inválido o expirado' });
    }
  });

  // Ruta para refrescar token con revalidación de balances
  app.post('/api/refresh', authenticateRequestTest, async (req, res) => {
    const { refreshToken } = req.body;
    const developer = req.developer;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Falta refresh token' });
    } 
    
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'test-jwt-secret');
      
      if (!decoded || !decoded.publicKey) {
        return res.status(401).json({ error: 'Refresh token inválido' });
      }

      console.log(`🔄 Refrescando token para wallet: ${decoded.publicKey}`);
      
      // RE-VALIDAR balances actuales (pueden haber cambiado desde el último authenticate)
      const accessLevels = sanitizeAccessLevels(req.body.accessLevels, developer.accessLevels);
      const { levelName, tokenBalances } = await validateTokenBalances(decoded.publicKey, accessLevels, connections);

      if (!levelName || levelName === 'none') {
        return res.status(403).json({
          success: false,
          error: 'No tienes acceso a ningún nivel',
          level: 'none',
          tokenBalances,
          accessLevels,
          publicKey: decoded.publicKey
        });
      }

      const newAccessToken = jwt.sign(
        { publicKey: decoded.publicKey, level: levelName, tokenBalances },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '1h' }
      );

      const newRefreshToken = jwt.sign(
        { publicKey: decoded.publicKey, level: levelName },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '7d' }
      );

      console.log(`✅ Token refrescado. Nivel actual: ${levelName}`);

      res.json({ 
        accessToken: newAccessToken, 
        refreshToken: newRefreshToken, 
        level: levelName,
        tokenBalances,
        accessLevels,
        expiresIn: 3600, 
        refreshTokenExpiresIn: 604800, 
        publicKey: decoded.publicKey
      });
    } catch (error) {
      console.error('Error en refresh:', error);
      res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }
  });

  // Ruta para revocar refresh token (real)
  app.post('/api/revoke', authenticateRequestTest, (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken || !refreshToken.startsWith('test-refresh-token-')) {
      return res.status(400).json({ error: 'Refresh token inválido' });
    }
    // En un sistema real, aquí se invalidaría el refresh token en la base de datos
    res.json({ success: true, message: 'Refresh token revocado' });
  }); 

  // Ruta para limpiar caché (útil para testing)
  app.post('/api/clear-cache', authenticateRequestTest, (req, res) => {
    const cacheSize = balanceCache.size;
    balanceCache.clear();
    console.log(`🧹 Cache limpiado: ${cacheSize} entradas eliminadas`);
    res.json({ 
      success: true, 
      message: `Cache limpiado: ${cacheSize} entradas eliminadas`,
      cacheTTL: `${BALANCE_CACHE_TTL_MS / 1000 / 60} minutos`
    });
  });

  // Ruta para ver estadísticas del caché
  app.get('/api/cache-stats', authenticateRequestTest, (req, res) => {
    const stats = {
      balanceCacheSize: balanceCache.size,
      tokenDecimalsCacheSize: tokenDecimalsCache.size,
      cacheTTLMinutes: BALANCE_CACHE_TTL_MS / 1000 / 60,
      cacheEntries: []
    };

    // Mostrar algunas entradas del caché (sin datos sensibles)
    for (const [key, value] of balanceCache.entries()) {
      const age = Date.now() - value.timestamp;
      const remainingTime = Math.max(0, BALANCE_CACHE_TTL_MS - age);
      stats.cacheEntries.push({
        key: key.replace(/:[A-Za-z0-9]{32,}:/g, ':***:'), // Ocultar direcciones de wallet
        balance: value.value,
        ageMinutes: Math.floor(age / 1000 / 60),
        remainingMinutes: Math.floor(remainingTime / 1000 / 60)
      });
    }

    res.json(stats);
  });

  // Ruta de salud
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  return app;
};

module.exports = createTestServer;