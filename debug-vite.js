// Script للتشخيص والتحقق من مشكلة vite
const fs = require('fs');
const path = require('path');

console.log('🔍 تشخيص مشكلة vite...');

// التحقق من وجود node_modules
const nodeModulesPath = path.join(__dirname, 'node_modules');
console.log('📁 node_modules موجود؟', fs.existsSync(nodeModulesPath));

// التحقق من وجود vite في node_modules
const vitePath = path.join(nodeModulesPath, 'vite');
console.log('📦 vite package موجود؟', fs.existsSync(vitePath));

// التحقق من وجود vite binary
const viteBinPath = path.join(nodeModulesPath, '.bin', 'vite');
console.log('🔧 vite binary موجود؟', fs.existsSync(viteBinPath));

// التحقق من محتويات .bin
const binPath = path.join(nodeModulesPath, '.bin');
if (fs.existsSync(binPath)) {
  const binFiles = fs.readdirSync(binPath);
  console.log('📋 محتويات .bin:', binFiles.slice(0, 10)); // أول 10 ملفات
}

// التحقق من package.json
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log('📄 scripts في package.json:', packageJson.scripts);
  console.log('📦 vite في dependencies؟', !!packageJson.dependencies?.vite);
  console.log('🛠️ vite في devDependencies؟', !!packageJson.devDependencies?.vite);
}

// محاولة تشغيل vite مباشرة
const { exec } = require('child_process');
exec('which vite', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ vite غير موجود في PATH');
  } else {
    console.log('✅ vite موجود في:', stdout.trim());
  }
});

// محاولة npm list vite
exec('npm list vite', (error, stdout, stderr) => {
  if (error) {
    console.log('❌ خطأ في npm list vite:', error.message);
  } else {
    console.log('📋 npm list vite:', stdout);
  }
});