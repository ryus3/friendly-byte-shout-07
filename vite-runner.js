const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// محاولات متعددة لتشغيل vite
const attempts = [
  () => {
    const vitePath = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
    if (fs.existsSync(vitePath)) {
      console.log('✅ Running vite from:', vitePath);
      execSync(`node "${vitePath}" ${process.argv.slice(2).join(' ')}`, { stdio: 'inherit' });
      return true;
    }
    return false;
  },
  () => {
    const viteBin = path.join(process.cwd(), 'node_modules', '.bin', 'vite');
    if (fs.existsSync(viteBin)) {
      console.log('✅ Running vite from .bin');
      execSync(`"${viteBin}" ${process.argv.slice(2).join(' ')}`, { stdio: 'inherit' });
      return true;
    }
    return false;
  },
  () => {
    console.log('💡 Using npx as fallback');
    execSync(`npx vite ${process.argv.slice(2).join(' ')}`, { stdio: 'inherit' });
    return true;
  }
];

let success = false;
for (const attempt of attempts) {
  try {
    if (attempt()) {
      success = true;
      break;
    }
  } catch (error) {
    console.log('❌ Attempt failed:', error.message);
  }
}

if (!success) {
  console.error('❌ All vite startup attempts failed');
  process.exit(1);
}