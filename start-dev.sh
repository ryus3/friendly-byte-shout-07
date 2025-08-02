#!/bin/bash
# Workaround script to start development server
export PATH="./node_modules/.bin:$PATH"
npx vite --host :: --port 8080 --cors