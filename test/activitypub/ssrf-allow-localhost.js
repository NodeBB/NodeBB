'use strict';

// Preload for sendWorker test workers: allows the worker process to send to
// localhost (SSRF bypass) so tests can use a local HTTP server.
require(require('path').join(__dirname, '..', '..', 'src', 'ssrf')).allowList.add('127.0.0.1');
