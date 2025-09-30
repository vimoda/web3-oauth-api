const crypto = require('crypto');
const MockDeveloper = require('../mocks/Developer');

const authenticateRequestTest = async (req, res, next) => {
  const { 'x-api-key': apiKey, 'x-nonce': nonce, 'x-signature': signature } = req.headers;
  
  if (!apiKey || !nonce || !signature) {
    return res.status(401).json({ error: 'Faltan apiKey, nonce o signature' });
  }

  // Buscar el desarrollador en el mock
  const developer = await MockDeveloper.findOne({ apiKey });
  if (!developer) {
    return res.status(401).json({ error: 'Clave API inválida' });
  }
  console.log(req.body)
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
  // reemplazar el developer.accessLevels con lo que llega de request.body.accessLevels
  developer.accessLevels = req.body.accessLevels || developer.accessLevels;
  console.log(developer);

  // Reemplazar el developer en la request para uso posterior
  req.developer = developer;
  next();
};

module.exports = authenticateRequestTest;