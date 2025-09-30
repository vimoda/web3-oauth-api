# Web3 OAuth API - AI Development Guide

## Architecture Overview

This is a Web3 OAuth-style API that enables authentication using Solana wallet signatures, with token-gated access levels based on SPL token holdings. The system validates user eligibility across testnet and mainnet networks.

### Core Components

- **Express API** (`src/index.js`): Rate-limited REST API with CORS, MongoDB connection configured but most DB operations commented out
- **Authentication Flow** (`src/routes/auth.js`): HMAC-signed requests with wallet signature verification (only `/authenticate` endpoint active)
- **Developer Management** (`src/models/Developer.js`): Mongoose schema for API key/secret pairs with configurable access levels 
- **Token Validation**: Real-time SPL token balance checking via Solana RPC connections with Redis caching (commented out)
- **Dual SDK Implementation**: 
  - Node.js version (`src/sdk/web3-oauth.js`) using Node crypto
  - Browser version (`client-example/src/solana-oauth.js`) using CryptoJS

## Critical Patterns

### HMAC Request Authentication
All API requests require three headers (enforced by `src/middleware/authenticateRequest.js`):
- `X-API-Key`: Developer's API key
- `X-Nonce`: Timestamp-based unique identifier  
- `X-Signature`: HMAC-SHA256 of `JSON.stringify(body) + nonce` using API secret

```javascript
// Pattern used in authenticateRequest middleware and both SDKs
const payload = JSON.stringify(req.body) + nonce;
const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('base64');
```

### Access Level Logic (Currently Inactive)
Each developer defines `accessLevels` with:
- `levelName`: Custom tier name
- `network`: Either 'testnet' or 'mainnet' 
- `tokenRequirements`: Array of `{tokenMintAddress, minAmount}` objects

The system finds the highest access level where ALL token requirements are met by checking SPL token balances.

### Dual Network Architecture
Separate Solana RPC connections for testnet/mainnet:
```javascript
const connections = {
  testnet: new Connection(process.env.SOLANA_TESTNET_RPC),
  mainnet: new Connection(process.env.SOLANA_MAINNET_RPC)
};
```

## Development Workflows

### Local Development
```bash
npm run dev        # Uses nodemon for auto-restart
npm test           # Run Jest test suite  
npm run test:watch # Run tests in watch mode
npm run test:server # Start test server for manual testing
```

### Testing Architecture
Uses **in-memory mocks** instead of real databases:
- `tests/setup.js`: Global test configuration with Solana RPC mocks
- `tests/mocks/Developer.js`: In-memory Map-based Developer model replacement
- Tests run without MongoDB/Redis dependencies

### Docker Stack (Partial)
```bash
docker-compose up  # API only - MongoDB and Redis services commented out in docker-compose.yml
```

### Environment Variables Required
- `SOLANA_TESTNET_RPC` / `SOLANA_MAINNET_RPC`: RPC endpoints (defaults provided)
- `JWT_SECRET`: For access token signing (defaults to 'tu-secreto')
- `MONGO_URI`: MongoDB connection (defaults to localhost, but most DB operations commented out)

## Current Implementation State

### Active Components
- HMAC authentication middleware (`src/middleware/authenticateRequest.js`)  
- Wallet signature verification in `/authenticate` endpoint
- Rate limiting (100 requests/15min per API key)
- Dual SDK implementations (Node.js + browser)

### Commented Out (Infrastructure in Transition)
- Most database operations in `src/routes/auth.js` (registration, refresh, verify, revoke endpoints)
- Redis caching for token balances
- MongoDB/Redis services in docker-compose.yml
- Swagger documentation setup

### Wallet Signature Verification Pattern
Uses TweetNaCl for Ed25519 signature validation:
```javascript
const isValid = nacl.sign.detached.verify(
  Buffer.from(message),
  Buffer.from(signature, 'base64'), 
  new PublicKey(publicKey).toBuffer()
);
```

### SDK Browser vs Node.js Differences  
- **Node.js** (`src/sdk/web3-oauth.js`): Uses native `crypto` module
- **Browser** (`client-example/src/solana-oauth.js`): Uses `crypto-js` library for HMAC

## Client Example Structure
The `client-example/` directory demonstrates real-world SDK usage:
- **Static HTML + vanilla JS**: `test-client.html` for quick testing
- **React components**: `src/App.js` with Phantom wallet integration
- **Network indicators**: Shows testnet/mainnet token balances separately  
- **Error boundaries**: Handles wallet connection failures gracefully

## Project-Specific Testing Patterns
- **No database dependencies**: All tests use `tests/mocks/Developer.js` Map-based storage
- **Solana RPC mocking**: Automatic mocks in `tests/setup.js` prevent real network calls
- **HMAC signature testing**: Critical for request authentication validation
- **Global test config**: `global.TEST_CONFIG` provides consistent API keys across tests

## Critical Debugging Notes
- **Missing mongoose import**: `src/index.js` has commented require but active mongoose.connect()  
- **Rate limiting by API key**: Uses `req.headers['x-api-key']` as identifier
- **CORS**: Configured with `origin: true` (allows all origins)
- **Default JWT secret**: 'tu-secreto' if JWT_SECRET not set
- **Token balance caching**: Redis operations commented out but caching logic remains in code