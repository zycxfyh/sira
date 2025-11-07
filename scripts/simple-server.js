const http = require('http');

// 创建简单的HTTP服务器用于性能测试
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Performance test endpoint',
      }),
    );
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Performance test server running on http://localhost:${PORT}`);
  console.log(`📊 Health check endpoint: http://localhost:${PORT}/health`);
});
