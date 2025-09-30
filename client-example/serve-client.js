const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Nonce, X-Signature');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    // Servir el archivo HTML de testing
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Archivo no encontrado');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
  } else {
    res.writeHead(404);
    res.end('Página no encontrada');
  }
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`🌐 Cliente web corriendo en http://localhost:${PORT}`);
  console.log(`📱 Abre tu navegador en: http://localhost:${PORT}`);
  console.log(`🔗 Asegúrate de que el servidor de testing esté corriendo en puerto 3001`);
});

module.exports = server;