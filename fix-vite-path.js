#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing vite PATH issue...');

try {
  // Make vite file executable
  const viteFile = path.join(__dirname, 'vite');
  if (fs.existsSync(viteFile)) {
    execSync(`chmod +x "${viteFile}"`);
    console.log('✅ Made vite executable');
  }

  // Create node_modules/.bin directory if it doesn't exist
  const binDir = path.join(__dirname, 'node_modules', '.bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
    console.log('✅ Created .bin directory');
  }

  // Create symlink to vite in node_modules/.bin
  const viteBinPath = path.join(binDir, 'vite');
  if (!fs.existsSync(viteBinPath)) {
    const viteSourcePath = path.join(__dirname, 'vite');
    try {
      fs.symlinkSync(path.relative(binDir, viteSourcePath), viteBinPath);
      console.log('✅ Created vite symlink in .bin');
    } catch (error) {
      // If symlink fails, copy the file instead
      fs.copyFileSync(viteSourcePath, viteBinPath);
      execSync(`chmod +x "${viteBinPath}"`);
      console.log('✅ Copied vite to .bin directory');
    }
  }

  console.log('🎉 Vite PATH fixed successfully!');
  
  // Now try to start the dev server
  console.log('🚀 Starting development server...');
  execSync('npm run dev', { stdio: 'inherit' });

} catch (error) {
  console.error('❌ Error fixing vite:', error.message);
  console.log('💡 Trying direct npx approach...');
  
  try {
    execSync('npx vite --host :: --port 8080', { stdio: 'inherit' });
  } catch (npxError) {
    console.error('❌ NPX also failed:', npxError.message);
    process.exit(1);
  }
}