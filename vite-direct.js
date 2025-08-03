const path = require('path');
const vitePath = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

try {
  require(vitePath);
} catch (error) {
  console.error('خطأ في تشغيل vite:', error.message);
  process.exit(1);
}