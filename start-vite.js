#!/usr/bin/env node

// حل جذري لمشكلة vite
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('🚀 بدء خادم التطوير...');
  
  // البحث عن vite
  const vitePath = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  const fs = require('fs');
  
  if (fs.existsSync(vitePath)) {
    console.log('✅ تم العثور على vite، بدء التشغيل...');
    execSync(`node "${vitePath}" --host :: --port 8080`, { 
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });
  } else {
    console.log('💡 استخدام npx...');
    execSync('npx vite --host :: --port 8080', { 
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });
  }
} catch (error) {
  console.error('❌ خطأ:', error.message);
  process.exit(1);
}