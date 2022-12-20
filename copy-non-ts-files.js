'use strict';

const fs = require('fs-extra');

fs.copy('config.json', 'build');
fs.copy('src/views', 'build/src/views');
fs.copy('install', 'build/install');
