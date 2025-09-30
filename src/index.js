


const express = require('express');
// const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
// const swaggerUi = require('swagger-ui-express');
// const swaggerDocument = require('./swagger.json');
const app = express();

// Configuración de middleware
app.use(cors({ origin: true })); // Configura CORS según tus necesidades
app.use(express.json());

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // 100 solicitudes por apiKey
    keyGenerator: (req) => req.headers['x-api-key'] || 'unknown',
  })
);

// Rutas
app.use('/api', authRoutes);

// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/web3-oauth-dev', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Conectado a MongoDB'))
  .catch((err) => console.error('Error al conectar a MongoDB:', err));

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));