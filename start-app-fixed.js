const { exec } = require('child_process');

console.log('🔧 Starting application with proper Vite setup...');

// Kill any existing processes
exec('killall node', () => {
  console.log('🧹 Cleaned up existing processes');
  
  // Start the Vite server
  const startCommand = 'npx vite --host 0.0.0.0 --port 8080';
  console.log('🚀 Executing:', startCommand);
  
  const child = exec(startCommand, { stdio: 'inherit' });
  
  child.stdout.on('data', (data) => {
    console.log(data.toString());
  });
  
  child.stderr.on('data', (data) => {
    console.error(data.toString());
  });
  
  child.on('close', (code) => {
    console.log(`Process exited with code ${code}`);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down...');
    child.kill();
    process.exit();
  });
});