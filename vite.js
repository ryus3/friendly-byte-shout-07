#!/usr/bin/env node
// Emergency override for Lovable
process.argv[1] = require('path').join(__dirname, 'start-dev-final.js');
require('./start-dev-final.js');