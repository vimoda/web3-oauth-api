const crypto = require('crypto');

class Web3OAuth {
  constructor(apiKey, apiSecret, apiUrl = 'https://tu-api.com') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.apiUrl = apiUrl;
    this.accessToken = null;
    this.refreshToken = null;
  }

  generateSignature(payload) {
    const nonce = Date.now().toString();
    const message = JSON.stringify(payload) + nonce;
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('base64');
    return { signature, nonce };
  }

  async connectWallet() {
    const { solana } = window;
    if (!solana) throw new Error('Wallet no encontrada');
    const response = await solana.connect();
    return response.publicKey.toString();
  }

  async authenticate(publicKey) {
    const message = `Autenticación para ${this.apiKey} en ${new Date().toISOString()}`;
    const signature = await window.solana.signMessage(Buffer.from(message), 'utf8');

    const payload = {
      apiKey: this.apiKey,
      publicKey,
      signature: Buffer.from(signature).toString('base64'),
      message,
    };
    const { signature: hmacSignature, nonce } = this.generateSignature(payload);

    const response = await fetch(`${this.apiUrl}/api/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Nonce': nonce,
        'X-Signature': hmacSignature,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    return data;
  }

  async refresh() {
    if (!this.refreshToken) throw new Error('No hay refresh token disponible');

    const payload = {
      apiKey: this.apiKey,
      refreshToken: this.refreshToken,
    };
    const { signature: hmacSignature, nonce } = this.generateSignature(payload);

    const response = await fetch(`${this.apiUrl}/api/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Nonce': nonce,
        'X-Signature': hmacSignature,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    return data;
  }

  async verifyToken() {
    if (!this.accessToken) throw new Error('No hay access token disponible');

    const payload = { accessToken: this.accessToken };
    const { signature: hmacSignature, nonce } = this.generateSignature(payload);

    const response = await fetch(`${this.apiUrl}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Nonce': nonce,
        'X-Signature': hmacSignature,
      },
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  async revoke() {
    if (!this.refreshToken) throw new Error('No hay refresh token disponible');

    const payload = {
      apiKey: this.apiKey,
      refreshToken: this.refreshToken,
    };
    const { signature: hmacSignature, nonce } = this.generateSignature(payload);

    const response = await fetch(`${this.apiUrl}/api/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Nonce': nonce,
        'X-Signature': hmacSignature,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    this.accessToken = null;
    this.refreshToken = null;
    return data;
  }
}

// Exportar para Node.js y navegador
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Web3OAuth;
} else {
  window.Web3OAuth = Web3OAuth;
}