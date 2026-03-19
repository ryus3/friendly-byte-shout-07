const { createServer } = require('vite');

async function startServer() {
  try {
    const server = await createServer({
      configFile: './vite.config.js',
      root: '.',
      server: {
        port: 8080,
        host: '0.0.0.0'
      }
    });
    
    await server.listen();
    console.log('✅ Server running at http://localhost:8080');
  } catch (error) {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
}

startServer();