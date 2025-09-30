const express = require('express');
const { Connection, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount, getMint } = require('@solana/spl-token');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nacl = require('tweetnacl');
const authenticateRequest = require('../middleware/authenticateRequest');
// const Developer = require('../models/Developer');
// const RefreshToken = require('../models/RefreshToken');
// const redis = require('redis');

const router = express.Router();

// Conexiones a Solana
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

// // Registro de desarrolladores
// router.post('/register', async (req, res) => {
//   const { email, appName, accessLevels } = req.body;

//   if (!Array.isArray(accessLevels) || !accessLevels.every(level =>
//     level.levelName &&
//     ['testnet', 'mainnet'].includes(level.network) &&
//     Array.isArray(level.tokenRequirements) &&
//     level.tokenRequirements.every(req => req.tokenMintAddress && req.minAmount >= 0)
//   )) {
//     return res.status(400).json({ error: 'Formato de accessLevels inválido o red no válida' });
//   }

//   const apiKey = require('crypto').randomBytes(16).toString('hex');
//   const apiSecret = require('crypto').randomBytes(32).toString('hex');
//   const developer = new Developer({ email, appName, apiKey, apiSecret, accessLevels });
//   await developer.save();
//   res.json({ apiKey, apiSecret });
// });

// Autenticación de usuarios
router.post('/authenticate', authenticateRequest, async (req, res) => {
  const { publicKey, signature, message } = req.body;
  const developer = req.developer;

  // Verificar firma
  const isValidSignature = nacl.sign.detached.verify(
    Buffer.from(message),
    Buffer.from(signature, 'base64'),
    new PublicKey(publicKey).toBuffer()
  );
  if (!isValidSignature) return res.status(401).json({ error: 'Firma inválida' });

  // Verificar niveles de acceso
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

  const levelName = highestLevel ? highestLevel.levelName : developer.accessLevels.find(l => l.tokenRequirements.length === 0)?.levelName || 'none';

  // Generar access token
  const accessToken = jwt.sign(
    { publicKey, level: levelName, tokenBalances },
    process.env.JWT_SECRET || 'tu-secreto',
    { expiresIn: '1h' }
  );

  // Generar refresh token
  // const refreshToken = uuidv4();
  // const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  // await RefreshToken.create({
  //   token: refreshToken,
  //   publicKey,
  //   apiKey: developer.apiKey,
  //   expiresAt,
  // });

  res.json({ accessToken: accessToken, refreshToken: {}, level: levelName, tokenBalances, expiresIn: 3600 });
});

// // Refrescar token
// router.post('/refresh', authenticateRequest, async (req, res) => {
//   const { refreshToken } = req.body;
//   const { apiKey } = req.headers;
//   const developer = req.developer;

//   const tokenRecord = await RefreshToken.findOne({ token: refreshToken, apiKey });
//   if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
//     return res.status(401).json({ error: 'Refresh token inválido o expirado' });
//   }

//   let highestLevel = null;
//   const tokenBalances = {};
//   for (const level of developer.accessLevels) {
//     let meetsRequirements = true;
//     const balances = {};

//     const connection = connections[level.network];
//     if (!connection) {
//       meetsRequirements = false;
//       continue;
//     }

//     for (const req of level.tokenRequirements) {
//       const cacheKey = `balance:${tokenRecord.publicKey}:${req.tokenMintAddress}:${level.network}`;
//       let balance = await client.get(cacheKey);

//       if (!balance) {
//         const tokenAccount = await getAssociatedTokenAddress(
//           new PublicKey(req.tokenMintAddress),
//           new PublicKey(tokenRecord.publicKey)
//         );
//         try {
//           const accountInfo = await getAccount(connection, tokenAccount);
//           balance = Number(accountInfo.amount);
//           await client.setEx(cacheKey, 60, balance.toString());
//         } catch (error) {
//           balance = 0;
//         }
//       } else {
//         balance = Number(balance);
//       }

//       balances[req.tokenMintAddress] = balance;
//       tokenBalances[`${req.tokenMintAddress}:${level.network}`] = balance;
//       if (balance < req.minAmount) {
//         meetsRequirements = false;
//       }
//     }

//     if (meetsRequirements && (!highestLevel || developer.accessLevels.indexOf(level) > developer.accessLevels.indexOf(highestLevel))) {
//       highestLevel = level;
//     }
//   }

//   const levelName = highestLevel ? highestLevel.levelName : developer.accessLevels.find(l => l.tokenRequirements.length === 0)?.levelName || 'none';

//   const accessToken = jwt.sign(
//     { publicKey: tokenRecord.publicKey, level: levelName, tokenBalances },
//     process.env.JWT_SECRET || 'tu-secreto',
//     { expiresIn: '1h' }
//   );

//   const newRefreshToken = uuidv4();
//   const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
//   await RefreshToken.create({
//     token: newRefreshToken,
//     publicKey: tokenRecord.publicKey,
//     apiKey,
//     expiresAt,
//   });
//   await RefreshToken.updateOne({ token: refreshToken }, { revoked: true });

//   res.json({ accessToken, refreshToken: newRefreshToken, level: levelName, tokenBalances, expiresIn: 3600 });
// });

// // Verificar token
// router.post('/verify', authenticateRequest, (req, res) => {
//   const { accessToken } = req.body;
//   try {
//     const decoded = jwt.verify(accessToken, process.env.JWT_SECRET || 'tu-secreto');
//     res.json({ valid: true, publicKey: decoded.publicKey, level: decoded.level, tokenBalances: decoded.tokenBalances });
//   } catch (error) {
//     res.json({ valid: false, error: 'Token inválido' });
//   }
// });

// // Revocar refresh token
// router.post('/revoke', authenticateRequest, async (req, res) => {
//   const { refreshToken } = req.body;
//   const { apiKey } = req.headers;
//   const tokenRecord = await RefreshToken.findOne({ token: refreshToken, apiKey });
//   if (!tokenRecord) return res.status(404).json({ error: 'Refresh token no encontrado' });

//   await RefreshToken.updateOne({ token: refreshToken }, { revoked: true });
//   res.json({ message: 'Refresh token revocado' });
// });

module.exports = router;