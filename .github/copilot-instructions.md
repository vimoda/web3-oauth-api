# Web3 OAuth API - AI Development Guide

## Architecture Overview

This is a Web3 OAuth-style API that enables authentication using Solana wallet signatures, with token-gated access levels based on SPL token holdings. The system validates user eligibility across testnet and mainnet networks.

### Core Components

- **Express API** (`src/index.js`): Rate-limited REST API with CORS and Swagger docs at `/api-docs`
- **Authentication Flow** (`src/routes/auth.js`): HMAC-signed requests with wallet signature verification
- **Developer Management** (`src/models/Developer.js`): API key/secret pairs with configurable access levels
- **Token Validation**: Real-time SPL token balance checking via Solana RPC connections
- **SDK** (`src/sdk/solana-oauth.js`): Client-side library for browser wallet integration

## Critical Patterns

### HMAC Request Authentication
All API requests require three headers:
- `X-API-Key`: Developer's API key
- `X-Nonce`: Timestamp-based unique identifier
- `X-Signature`: HMAC-SHA256 of `JSON.stringify(body) + nonce` using API secret

```javascript
// Pattern used in authenticateRequest middleware and SDK
const payload = JSON.stringify(req.body) + nonce;
const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('base64');
```

### Access Level Logic
Each developer defines `accessLevels` with:
- `levelName`: Custom tier name
- `network`: Either 'testnet' or 'mainnet'
- `tokenRequirements`: Array of `{tokenMintAddress, minAmount}` objects

The system finds the highest access level where ALL token requirements are met.

### Dual Network Architecture
Separate Solana RPC connections for testnet/mainnet with automatic failover:
```javascript
const connections = {
  testnet: new Connection(process.env.SOLANA_TESTNET_RPC),
  mainnet: new Connection(process.env.SOLANA_MAINNET_RPC)
};
```

## Development Workflows

### Local Development
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Docker Stack
```bash
docker-compose up  # Includes MongoDB and Redis (currently commented out)
```

### Environment Variables Required
- `SOLANA_TESTNET_RPC` / `SOLANA_MAINNET_RPC`: RPC endpoints
- `JWT_SECRET`: For access token signing
- `MONGO_URI` / `REDIS_URI`: Database connections (when uncommented)

## Key Implementation Details

### Wallet Signature Verification
Uses TweetNaCl for Ed25519 signature validation:
```javascript
const isValid = nacl.sign.detached.verify(
  Buffer.from(message),
  Buffer.from(signature, 'base64'), 
  new PublicKey(publicKey).toBuffer()
);
```

### Token Balance Caching
Redis caching pattern for expensive RPC calls:
```javascript
const cacheKey = `balance:${publicKey}:${tokenMintAddress}:${network}`;
// 60-second TTL on balance data
```

### Client Integration
The SDK (`src/sdk/solana-oauth.js`) handles:
- Phantom wallet connection via `window.solana`
- Message signing for authentication
- HMAC signature generation for API requests
- Token refresh and verification flows

## Development Notes

- **Database Models**: Currently commented out but schemas exist for `Developer` and `RefreshToken`
- **Rate Limiting**: 100 requests per 15 minutes per API key
- **JWT Tokens**: 1-hour expiry with refresh token mechanism
- **Error Handling**: Consistent JSON error responses with specific error messages
- **CORS**: Configured for cross-origin requests (`origin: true`)

## Client Example Structure
The `client-example/` directory contains a React app demonstrating SDK usage:
- Connects to Phantom wallet
- Displays access level and token balances with network indicators
- Implements refresh and logout functionality

## Testing Considerations
When implementing tests:
- Mock Solana RPC connections for both networks
- Test HMAC signature generation/validation
- Verify access level logic with various token combinations
- Test rate limiting behavior
- Mock wallet interactions for client-side tests