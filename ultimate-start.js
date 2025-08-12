#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Lovable Development Server...');

// Create a simple vite wrapper
const viteWrapper = `
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
`;

require('fs').writeFileSync('./vite-server.js', viteWrapper);

// Run the vite server
const child = spawn('node', ['vite-server.js'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

child.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  
  // Fallback to direct vite
  console.log('🔄 Trying direct vite...');
  const fallback = spawn('npx', ['vite', '--port', '8080', '--host', '0.0.0.0'], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  fallback.on('error', () => {
    console.error('❌ All startup methods failed');
    process.exit(1);
  });
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.log('🔄 Retrying with npx vite...');
    const retry = spawn('npx', ['vite', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname
    });
  }
});