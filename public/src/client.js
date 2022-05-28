'use strict';

require('./app');

// scripts-client.js contains javascript files
// from plugins that add files to "scripts" block in plugin.json
// eslint-disable-next-line import/no-unresolved
require('../scripts-client');

app.onDomReady();
