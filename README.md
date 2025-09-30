# WEB3 OAuth API

API tipo OAuth para autenticar usuarios con wallets de web3, con soporte para validaciones en testnet y mainnet.

## Requisitos

- Node.js 18+
- MongoDB
- Redis
- Acceso a nodos RPC de web3 (testnet y mainnet)

## Instalación

1. Clona el repositorio:
   ```bash
   git clone <repositorio>
   cd web3-oauth-api

2. Instala las dependencias:
    ```bash
    npm install

3. Configura las variables de entorno en .env
    PORT=3000
    MONGO_URI=mongodb://mongodb:27017/web3-oauth
    REDIS_URI=redis://redis:6379
    SOLANA_TESTNET_RPC=https://api.testnet.solana.com
    SOLANA_MAINNET_RPC=https://api.mainnet-beta.solana.com
    JWT_SECRET=tu-secreto-jwt-aqui

4. Inicia el servidor:
    npm start
   
Uso con Docker

1. Construye y ejecuta los contenedores:

2. Accede a la API en http://localhost:3000.

Endpoints
POST /api/register: Registrar un desarrollador y obtener apiKey y apiSecret.
POST /api/authenticate: Autenticar un usuario con su wallet de web3.
POST /api/refresh: Refrescar un access token.
POST /api/verify: Verificar un access token.
POST /api/revoke: Revocar un refresh token.