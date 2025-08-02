#!/bin/bash
# Development server script
export NODE_ENV=development
node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 8080 --cors