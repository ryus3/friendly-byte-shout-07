const { spawn } = require('child_process');
const path = require('path');

const viteBin = path.resolve(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
const args = process.argv.slice(2);

const child = spawn('node', [viteBin].concat(args), {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('close', (code) => {
  process.exit(code);
});