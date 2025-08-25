const { spawn } = require('child_process');

console.log('🚀 Bypassing package.json and starting Vite directly...');

// Start vite with full configuration
const vite = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
  stdio: 'inherit',
  cwd: process.cwd()
});

vite.on('error', (err) => {
  console.error('Error starting Vite:', err);
  process.exit(1);
});

vite.on('exit', (code) => {
  process.exit(code);
});

// Handle cleanup
process.on('SIGINT', () => vite.kill());
process.on('SIGTERM', () => vite.kill());