// see https://gist.github.com/jfromaniello/4087861#gistcomment-1447029
// XMLHttpRequest to override.

var npm2Path = '../../node_modules/socket.io-client/node_modules/engine.io-client/node_modules/xmlhttprequest-ssl';
var npm3Path = '../../node_modules/xmlhttprequest-ssl';
var filePath;
var winston = require('winston');

// Make initial call to require so module is cached.
try {
	require(npm2Path);
	filePath = require.resolve(npm2Path);
} catch (err) {
	if (err) {
		winston.info('Couldn\'t find ' + npm2Path);
	}
	try {
		require(npm3Path);
		filePath = require.resolve(npm3Path);
	} catch (err) {
		if (err) {
			winston.info('Couldn\'t find ' + npm3Path);
		}
	}
}

winston.info('xmlhttprequest-ssl path: ' + filePath);
// Get cached version.
var cachedXhr = require.cache[filePath];
var stdXhr = cachedXhr.exports;

// Callbacks exposes an object that callback functions can be added to.
var callbacks = {};

var newXhr = function () {
	stdXhr.apply(this, arguments);
	for (var method in callbacks) {
		if (typeof callbacks[method] == 'function') {
			callbacks[method].apply(this, arguments);
		}
	}
};

newXhr.XMLHttpRequest = newXhr;

cachedXhr.exports = newXhr;
module.exports = newXhr;
module.exports.callbacks = callbacks;