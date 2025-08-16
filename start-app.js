#!/usr/bin/env node

// Copy the fixed package.json and start the server
const fs = require('fs');

// Apply the fix
if (fs.existsSync('./package-fix.json')) {
  const fixedPackage = fs.readFileSync('./package-fix.json', 'utf8');
  fs.writeFileSync('./package.json', fixedPackage);
  console.log('✅ Applied package.json fix');
}

// Start the dev server using the working script
require('./dev-server.js');