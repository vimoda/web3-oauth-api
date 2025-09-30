// SDK Web3OAuth para navegador - sin crypto de Node.js
import CryptoJS from 'crypto-js';

class Web3OAuth {
  constructor(apiKey, apiSecret, apiUrl = 'http://localhost:3001') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.apiUrl = apiUrl;
    this.accessToken = null;
    this.refreshToken = null;
  }

  generateSignature(payload) {
    const nonce = Date.now().toString();
    const message = JSON.stringify(payload) + nonce;
    // Usar crypto-js en lugar de crypto de Node.js
    const signature = CryptoJS.HmacSHA256(message, this.apiSecret).toString(CryptoJS.enc.Base64);
    return { signature, nonce };
  }

  async connectWallet() {
    const { solana } = window;
    if (!solana) {
      throw new Error('Phantom wallet no encontrada. Por favor instala Phantom wallet.');
    }
    
    try {
      const response = await solana.connect();
      return response.publicKey.toString();
    } catch (error) {
      throw new Error(`Error conectando wallet: ${error.message}`);
    }
  }

  async authenticate(publicKey) {
    const message = `Autenticación para ${this.apiKey} en ${new Date().toISOString()}`;
    
    try {
      // Firmar mensaje con la wallet
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await window.solana.signMessage(encodedMessage, 'utf8');

      const payload = {
        apiKey: this.apiKey,
        publicKey,
        signature: Array.from(signature.signature),
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
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      return data;
    } catch (error) {
      throw new Error(`Error en autenticación: ${error.message}`);
    }
  }

  async refresh() {
    if (!this.refreshToken) {
      throw new Error('No hay refresh token disponible');
    }

    const payload = {
      apiKey: this.apiKey,
      refreshToken: this.refreshToken,
    };
    const { signature: hmacSignature, nonce } = this.generateSignature(payload);

    try {
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
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      this.accessToken = data.accessToken;
      return data;
    } catch (error) {
      throw new Error(`Error refrescando token: ${error.message}`);
    }
  }

  async verifyToken() {
    if (!this.accessToken) {
      throw new Error('No hay access token disponible');
    }

    const payload = { accessToken: this.accessToken };
    const { signature: hmacSignature, nonce } = this.generateSignature(payload);

    try {
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      throw new Error(`Error verificando token: ${error.message}`);
    }
  }

  async revoke() {
    if (!this.refreshToken) {
      throw new Error('No hay refresh token para revocar');
    }

    const payload = { refreshToken: this.refreshToken };
    const { signature: hmacSignature, nonce } = this.generateSignature(payload);

    try {
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
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      this.accessToken = null;
      this.refreshToken = null;
      return data;
    } catch (error) {
      throw new Error(`Error revocando token: ${error.message}`);
    }
  }
}

export default Web3OAuth;