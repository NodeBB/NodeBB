'use strict';

const util = require('util');

module.exports = function (theModule, ignoreKeys) {
	ignoreKeys = ignoreKeys || [];
	function isCallbackedFunction(func) {
		if (typeof func !== 'function') {
			return false;
		}
		const str = func.toString().split('\n')[0];
		return str.includes('callback)');
	}

	function isAsyncFunction(fn) {
		return fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
	}

	function promisifyRecursive(module) {
		if (!module) {
			return;
		}

		const keys = Object.keys(module);
		keys.forEach((key) => {
			if (ignoreKeys.includes(key)) {
				return;
			}
			if (isAsyncFunction(module[key])) {
				module[key] = wrapCallback(module[key], util.callbackify(module[key]));
			} else if (isCallbackedFunction(module[key])) {
				module[key] = wrapPromise(module[key], util.promisify(module[key]));
			} else if (typeof module[key] === 'object') {
				promisifyRecursive(module[key]);
			}
		});
	}

	function wrapCallback(origFn, callbackFn) {
		return function wrapperCallback(...args) {
			if (args.length && typeof args[args.length - 1] === 'function') {
				const cb = args.pop();
				args.push((err, res) => (res !== undefined ? cb(err, res) : cb(err)));
				return callbackFn(...args);
			}
			return origFn(...args);
		};
	}

	function wrapPromise(origFn, promiseFn) {
		return function wrapperPromise(...args) {
			if (args.length && typeof args[args.length - 1] === 'function') {
				return origFn(...args);
			}

			return promiseFn(...args);
		};
	}

	promisifyRecursive(theModule);
};
