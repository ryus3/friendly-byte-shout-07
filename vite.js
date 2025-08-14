const { execSync } = require('child_process');
console.log('🚀 Starting Vite...');
try {
  execSync('node node_modules/vite/bin/vite.js --host :: --port 8080', { stdio: 'inherit' });
} catch (error) {
  console.log('⚠️ Fallback to npx...');
  execSync('npx vite --host :: --port 8080', { stdio: 'inherit' });
}