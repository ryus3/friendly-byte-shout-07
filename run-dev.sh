#!/bin/bash
# Fix for vite not found error
export PATH="./node_modules/.bin:$PATH"
./node_modules/.bin/vite --host :: --port 8080 --cors