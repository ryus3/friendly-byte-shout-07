#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting development server...');

// Direct path to vite
const vitePath = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

if (fs.existsSync(vitePath)) {
    console.log('✅ Starting vite server...');
    const child = spawn('node', [vitePath, '--host', '0.0.0.0', '--port', '8080'], {
        stdio: 'inherit',
        cwd: __dirname,
        env: { 
            ...process.env, 
            NODE_ENV: 'development',
            FORCE_COLOR: '1'
        }
    });

    child.on('error', (error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });

    child.on('exit', (code) => {
        process.exit(code || 0);
    });
} else {
    console.error('❌ Vite not found at expected path');
    console.log('💡 Try: npm install vite');
    process.exit(1);
}