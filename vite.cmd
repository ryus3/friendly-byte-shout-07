#!/bin/bash
export NODE_PATH="./node_modules"
export PATH="./node_modules/.bin:$PATH"
exec ./node_modules/.bin/vite "$@"