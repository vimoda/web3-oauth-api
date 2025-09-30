const crypto = require('crypto');
const Developer = require('../models/Developer');
// const redis = require('redis');

// const client = redis.createClient({
//   url: process.env.REDIS_URI || 'redis://redis:6379',
// });

// client.connect().catch((err) => console.error('Error al conectar a Redis:', err));

const authenticateRequest = async (req, res, next) => {
  const { 'x-api-key': apiKey, 'x-nonce': nonce, 'x-signature': signature } = req.headers;
  if (!apiKey || !nonce || !signature) {
    return res.status(401).json({ error: 'Faltan apiKey, nonce o signature' });
  }

  // // Verificar si el nonce ya fue usado
  // const isNonceUsed = await client.get(`nonce:${nonce}`);
  // if (isNonceUsed) {
  //   return res.status(401).json({ error: 'Nonce ya usado' });
  // }

  // Buscar el desarrollador
  const developer = await Developer.findOne({ apiKey });
  if (!developer) {
    return res.status(401).json({ error: 'Clave API inválida' });
  }

  // Generar la firma esperada
  const payload = JSON.stringify(req.body) + nonce;
  const expectedSignature = crypto
    .createHmac('sha256', developer.apiSecret)
    .update(payload)
    .digest('base64');

  // Verificar la firma
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  // Marcar el nonce como usado (TTL de 24 horas)
  // await client.setEx(`nonce:${nonce}`, 24 * 60 * 60, 'used');

  req.developer = developer;
  next();
};

module.exports = authenticateRequest;