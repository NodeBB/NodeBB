'use strict';

import { fork } from 'child_process';

let debugArg: any = (process as any).execArgv.find(arg => /^--(debug|inspect)/.test(arg));
const debugging = !!debugArg;

debugArg = debugArg ? debugArg.replace('-brk', '').split('=') : ['--debug', 5859];
let lastAddress = parseInt(debugArg[1], 10);

/**
 * child-(process as any).fork, but safe for use in debuggers
 * @param {string} modulePath
 * @param {string[]} [args]
 * @param {any} [options]
 */
function debugFork(modulePath, args?, options?) {
	let execArgv = [] as any[];
	if ((global as any).v8debug || debugging) {
		lastAddress += 1;

		execArgv = [`${debugArg[0]}=${lastAddress}`, '--nolazy'];
	}

	if (!Array.isArray(args)) {
		options = args;
		args = [];
	}

	options = options || {};
	options = { ...options, execArgv: execArgv };

	return fork(modulePath, args, options);
}
debugFork.debugging = debugging;

export default debugFork;
