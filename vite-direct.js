#!/usr/bin/env node
require('child_process').execSync('npx vite --host 0.0.0.0 --port 8080', { stdio: 'inherit' });