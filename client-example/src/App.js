import { useState } from 'react';
import Web3OAuth from './solana-oauth';

function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [level, setLevel] = useState('none');
  const [tokenBalances, setTokenBalances] = useState({});
  // Usar las credenciales de testing y el puerto 3001
  const oauth = new Web3OAuth('test-api-key-123', 'test-api-secret-456', 'http://localhost:3001');

  const handleLogin = async () => {
    try {
      const publicKey = await oauth.connectWallet();
      const { accessToken, refreshToken, level, tokenBalances } = await oauth.authenticate(publicKey);
      setAccessToken(accessToken);
      setLevel(level);
      setTokenBalances(tokenBalances);
    } catch (error) {
      console.error('Error al autenticar:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      const { accessToken, level, tokenBalances } = await oauth.refresh();
      setAccessToken(accessToken);
      setLevel(level);
      setTokenBalances(tokenBalances);
    } catch (error) {
      console.error('Error al refrescar:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await oauth.revoke();
      setAccessToken(null);
      setLevel('none');
      setTokenBalances({});
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔐 Web3 OAuth Client Test</h1>
      <p>Servidor de testing: <code>http://localhost:3001</code></p>
      <p>API Key: <code>test-api-key-123</code></p>
      
      {!accessToken ? (
        <div>
          <h2>Iniciar Sesión</h2>
          <p>Para usar esta demo necesitas tener Phantom Wallet instalado.</p>
          <button 
            onClick={handleLogin}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#512da8',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🔗 Iniciar sesión con Phantom
          </button>
          
          <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
            <h3>💡 Modo Testing</h3>
            <p>Esta aplicación está configurada para usar el servidor de testing local.</p>
            <p>Las firmas de wallet son simuladas para propósitos de demostración.</p>
          </div>
        </div>
      ) : (
        <div>
          <h2>✅ Sesión Activa</h2>
          <div style={{ backgroundColor: '#e8f5e8', padding: '15px', borderRadius: '5px', margin: '10px 0' }}>
            <p><strong>Nivel de acceso:</strong> {level}</p>
            <p><strong>Token de acceso:</strong> {accessToken ? '✅ Activo' : '❌ No disponible'}</p>
          </div>
          
          <h3>💰 Balances de Tokens</h3>
          {Object.keys(tokenBalances).length > 0 ? (
            <ul style={{ backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '5px' }}>
              {Object.entries(tokenBalances).map(([tokenKey, balance]) => (
                <li key={tokenKey}>
                  <code>{tokenKey}</code> 
                  <span style={{ color: '#666' }}> (Red: {tokenKey.split(':')[1] || 'N/A'})</span>: 
                  <strong> {balance}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#666' }}>No hay balances de tokens disponibles</p>
          )}
          
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={handleRefresh}
              style={{
                padding: '8px 16px',
                marginRight: '10px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              🔄 Refrescar Token
            </button>
            <button 
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                backgroundColor: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              🚪 Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;