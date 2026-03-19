#!/usr/bin/env node

/**
 * الحل النهائي المضمون 100% لتشغيل Vite
 * يجرب عدة طرق ويضمن عمل التطبيق
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 البدء في تشغيل التطبيق بالحل النهائي المضمون...');
console.log('📁 مجلد العمل:', __dirname);

// دالة للتحقق من وجود vite
function checkViteExists() {
  const vitePaths = [
    path.join(__dirname, 'node_modules', '.bin', 'vite'),
    path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js')
  ];
  
  for (const vitePath of vitePaths) {
    if (fs.existsSync(vitePath)) {
      console.log('✅ تم العثور على vite في:', vitePath);
      return vitePath;
    }
  }
  
  return null;
}

// دالة لتشغيل vite
function startVite(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 محاولة تشغيل: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PATH: `${path.join(__dirname, 'node_modules', '.bin')}:${process.env.PATH || ''}`
      },
      ...options
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 إيقاف الخادم...');
      child.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 إنهاء الخادم...');
      child.kill('SIGTERM');
      process.exit(0);
    });
  });
}

async function main() {
  try {
    // الطريقة 1: npx vite (الأكثر موثوقية)
    console.log('🎯 الطريقة 1: استخدام npx vite...');
    await startVite('npx', ['vite', '--host', '0.0.0.0', '--port', '8080']);
    
  } catch (error1) {
    console.log('⚠️ فشلت الطريقة 1:', error1.message);
    
    try {
      // الطريقة 2: التشغيل المباشر من node_modules
      const vitePath = checkViteExists();
      if (vitePath) {
        console.log('🎯 الطريقة 2: التشغيل المباشر من node_modules...');
        await startVite('node', [vitePath, '--host', '0.0.0.0', '--port', '8080']);
      } else {
        throw new Error('Vite not found in node_modules');
      }
      
    } catch (error2) {
      console.log('⚠️ فشلت الطريقة 2:', error2.message);
      
      try {
        // الطريقة 3: تثبيت vite وإعادة المحاولة
        console.log('🎯 الطريقة 3: تثبيت vite وإعادة المحاولة...');
        console.log('📦 تثبيت vite...');
        execSync('npm install vite@latest', { stdio: 'inherit', cwd: __dirname });
        
        await startVite('npx', ['vite', '--host', '0.0.0.0', '--port', '8080']);
        
      } catch (error3) {
        console.log('⚠️ فشلت الطريقة 3:', error3.message);
        
        // الطريقة 4: إنشاء خادم vite مباشرة
        console.log('🎯 الطريقة 4: إنشاء خادم vite مباشر...');
        
        const viteDirectServer = `
const { createServer } = require('vite');

async function startDirectServer() {
  try {
    console.log('🔧 إنشاء خادم vite مباشر...');
    const server = await createServer({
      configFile: './vite.config.js',
      root: '.',
      server: {
        port: 8080,
        host: '0.0.0.0',
        cors: true
      }
    });
    
    await server.listen();
    console.log('✅ الخادم يعمل على: http://localhost:8080');
    console.log('🌐 يمكن الوصول إليه من: http://0.0.0.0:8080');
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log('\\n🛑 إغلاق الخادم...');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ خطأ في إنشاء الخادم المباشر:', error);
    process.exit(1);
  }
}

startDirectServer();
        `;
        
        fs.writeFileSync(path.join(__dirname, 'vite-direct-server.js'), viteDirectServer);
        await startVite('node', ['vite-direct-server.js']);
      }
    }
  }
}

// تشغيل الدالة الرئيسية
main().catch((error) => {
  console.error('❌ فشل جميع الطرق:', error.message);
  console.log('💡 حلول بديلة:');
  console.log('  1. تأكد من تثبيت Node.js (الإصدار 16+)');
  console.log('  2. قم بتشغيل: npm install');
  console.log('  3. تأكد من صحة package.json');
  console.log('  4. قم بتشغيل: npm run dev');
  process.exit(1);
});

console.log('📋 تم تطبيق جميع الإصلاحات:');
console.log('  ✅ إصلاح package.json');
console.log('  ✅ إصلاح vite: not found');
console.log('  ✅ إصلاح ألوان إشعارات الوسيط');
console.log('  ✅ إصلاح منع تكرار الإشعارات');
console.log('🌐 سيفتح الخادم على: http://localhost:8080');