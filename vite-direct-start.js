#!/usr/bin/env node

// Direct Vite startup that bypasses package.json scripts entirely
const { createServer } = require('vite');
const react = require('@vitejs/plugin-react');

async function startServer() {
  try {
    console.log('🚀 Starting Vite development server directly...');
    
    const server = await createServer({
      // Vite config
      plugins: [react()],
      server: {
        host: '0.0.0.0',
        port: 8080,
        strictPort: true,
        cors: true
      },
      resolve: {
        alias: {
          '@': '/src'
        }
      }
    });
    
    await server.listen();
    server.printUrls();
    
    console.log('✅ Development server is running!');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();