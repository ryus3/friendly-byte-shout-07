#!/usr/bin/env node

// حل نهائي لمشكلة vite not found
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 تشغيل نظام التطوير...');

// البحث عن vite في مسارات مختلفة
const searchPaths = [
  path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'),
  path.join(__dirname, 'node_modules', '.bin', 'vite')
];

function findVite() {
  for (const vitePath of searchPaths) {
    if (fs.existsSync(vitePath)) {
      console.log('✅ وُجد vite في:', vitePath);
      if (vitePath.endsWith('.js')) {
        return { command: 'node', args: [vitePath] };
      } else {
        return { command: vitePath, args: [] };
      }
    }
  }
  return null;
}

function startVite() {
  const viteConfig = findVite();
  
  if (!viteConfig) {
    console.log('❌ لم يتم العثور على vite، محاولة npx...');
    
    const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });
    
    child.on('error', (error) => {
      console.error('❌ فشل npx أيضاً:', error.message);
      console.log('🔄 محاولة تثبيت vite...');
      
      const installChild = spawn('npm', ['install'], {
        stdio: 'inherit',
        cwd: __dirname
      });
      
      installChild.on('close', (code) => {
        if (code === 0) {
          console.log('✅ تم التثبيت، إعادة المحاولة...');
          setTimeout(() => startVite(), 2000);
        } else {
          console.error('❌ فشل التثبيت');
          process.exit(1);
        }
      });
    });
    return;
  }
  
  const args = [...viteConfig.args, '--host', '0.0.0.0', '--port', '8080'];
  console.log(`🚀 تشغيل: ${viteConfig.command} ${args.join(' ')}`);
  
  const child = spawn(viteConfig.command, args, {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  });
  
  child.on('error', (error) => {
    console.error('❌ خطأ:', error.message);
    console.log('🔄 محاولة npx كبديل...');
    spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '8080'], {
      stdio: 'inherit',
      cwd: __dirname
    });
  });
  
  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ توقف بكود: ${code}`);
    }
  });
}

startVite();