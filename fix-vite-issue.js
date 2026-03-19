#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 إصلاح مشكلة vite not found...\n');

// التحقق من وجود node_modules
const nodeModulesPath = path.join(process.cwd(), 'node_modules');
const vitePath = path.join(nodeModulesPath, '.bin', 'vite');

if (!fs.existsSync(nodeModulesPath)) {
    console.log('❌ node_modules غير موجود');
} else if (!fs.existsSync(vitePath)) {
    console.log('❌ vite غير مثبت في node_modules');
} else {
    console.log('✅ vite موجود ولكن يوجد مشكلة في التشغيل');
}

try {
    console.log('\n🗑️ حذف الملفات القديمة...');
    
    // حذف node_modules
    if (fs.existsSync(nodeModulesPath)) {
        execSync('rm -rf node_modules', { stdio: 'inherit' });
    }
    
    // حذف lock files
    ['package-lock.json', 'yarn.lock'].forEach(file => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`✅ تم حذف ${file}`);
        }
    });
    
    console.log('\n📦 إعادة تثبيت التبعيات...');
    execSync('npm install', { stdio: 'inherit' });
    
    console.log('\n✅ التحقق من vite...');
    try {
        execSync('npx vite --version', { stdio: 'inherit' });
        console.log('\n🚀 تم إصلاح المشكلة بنجاح!');
        console.log('يمكنك الآن تشغيل: npm run dev');
    } catch (error) {
        console.log('\n❌ لا يزال vite غير متاح');
        console.log('جرب: npm install vite@latest --save-dev');
    }
    
} catch (error) {
    console.error('❌ خطأ في الإصلاح:', error.message);
    console.log('\nحاول تشغيل الأوامر يدوياً:');
    console.log('1. rm -rf node_modules');
    console.log('2. rm package-lock.json');
    console.log('3. npm install');
}