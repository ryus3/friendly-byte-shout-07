const { execSync } = require('child_process');

console.log('🚀 Starting development server...');

try {
  execSync('npx vite --host 0.0.0.0 --port 8080', {
    stdio: 'inherit',
    cwd: __dirname
  });
} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('💡 Try: npm install && node dev-start.js');
}