#!/bin/bash

echo "Installing vite..."
npm install vite@latest --save-dev

echo "Making sure npx is available..."
npm install -g npm@latest

echo "Done. Trying to start vite..."
npx vite --host :: --port 8080