#!/usr/bin/env node
// Backup vite runner
console.log('🔧 Backup Vite Runner');
require('child_process').execSync('node node_modules/vite/bin/vite.js --host :: --port 8080', { stdio: 'inherit' });