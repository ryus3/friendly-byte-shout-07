#!/bin/bash
# Make vite executable and run
chmod +x vite 2>/dev/null || true
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    exec ./vite.bat
else
    exec ./vite
fi