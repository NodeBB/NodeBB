'use strict';

var fork = require('child_process').fork;

var debugArg = process.execArgv.find(function (arg) {
	return /^--(debug|inspect)/.test(arg);
});
var debugging = !!debugArg;

debugArg = debugArg ? debugArg.replace('-brk', '').split('=') : ['--debug', 5859];
var lastAddress = parseInt(debugArg[1], 10);

/**
 * child-process.fork, but safe for use in debuggers
 * @param {string} modulePath
 * @param {string[]} [args]
 * @param {any} [options]
 */
function debugFork(modulePath, args, options) {
	var execArgv = [];
	if (global.v8debug || debugging) {
		lastAddress += 1;

		execArgv = [debugArg[0] + '=' + lastAddress, '--nolazy'];
	}

	if (!Array.isArray(args)) {
		options = args;
		args = [];
	}

	options = options || {};
	options = Object.assign({}, options, {
		execArgv: execArgv,
	});

	return fork(modulePath, args, options);
}
debugFork.debugging = debugging;

module.exports = debugFork;
