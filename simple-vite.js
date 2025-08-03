const { execSync } = require('child_process');
try {
  execSync('npx vite', { stdio: 'inherit' });
} catch {
  try {
    execSync('node ./node_modules/vite/bin/vite.js', { stdio: 'inherit' });
  } catch {
    console.error('فشل في تشغيل vite');
    process.exit(1);
  }
}