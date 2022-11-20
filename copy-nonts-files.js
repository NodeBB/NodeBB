const fs = require('fs-extra');

fs.copy('src/views', 'build/src/views');

fs.copy('install/data', 'build/install/data');

fs.copy('install/package.json', 'build/install');
