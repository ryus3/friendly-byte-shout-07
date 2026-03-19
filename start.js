#!/usr/bin/env node

// Startup script that properly applies package-override.json and handles vite
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('🚀 تطبيق الحل الشامل للطلبات الفورية...');
  
  // Read package-override.json and copy it to package.json  
  if (fs.existsSync('./package-override.json')) {
    const override = fs.readFileSync('./package-override.json', 'utf8');
    fs.writeFileSync('./package.json', override);
    console.log('✅ تم تطبيق إعدادات Real-time');
  }
  
  // استخدام start-fixed.js الموثوق
  console.log('🔧 تشغيل start-fixed.js...');
  execSync('node start-fixed.js', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH}`
    }
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('💡 Try manually: npm install && npx vite --host :: --port 8080');
  process.exit(1);
}