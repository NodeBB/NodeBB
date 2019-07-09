'use strict';

var util = require('util');
var _ = require('lodash');

module.exports = function (theModule, ignoreKeys) {
	ignoreKeys = ignoreKeys || [];
	function isCallbackedFunction(func) {
		if (typeof func !== 'function') {
			return false;
		}
		var str = func.toString().split('\n')[0];
		return str.includes('callback)');
	}

	function isAsyncFunction(fn) {
		return fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
	}

	var parts = [];
	function promisifyRecursive(module, key) {
		if (!module) {
			return;
		}
		if (key) {
			parts.push(key);
		}
		var keys = Object.keys(module);
		keys.forEach(function (key) {
			if (ignoreKeys.includes(key)) {
				return;
			}
			if (isAsyncFunction(module[key])) {
				module[key] = wrapIt(module[key], util.callbackify(module[key]));
			} else if (isCallbackedFunction(module[key])) {
				module[key] = wrapTwo(module[key], util.promisify(module[key]));
			} else if (typeof module[key] === 'object') {
				promisifyRecursive(module[key], key);
			}

			// add this back once all modules are converted to async/await
			// if (typeof module[key] === 'function') {
			// 	module[key] = require('util').deprecate(module[key], '.async.' + (parts.concat([key]).join('.')) + ' usage is deprecated use .' + key + ' directly!');
			// }
		});
		parts.pop();
	}

	function wrapTwo(origFn, promiseFn) {
		return function wrapper2(...args) {
			if (arguments.length && typeof arguments[arguments.length - 1] === 'function') {
				return origFn.apply(null, args);
			}

			return promiseFn.apply(null, arguments);
		};
	}

	function wrapIt(origFn, callbackFn) {
		return async function wrapper(...args) {
			if (arguments.length && typeof arguments[arguments.length - 1] === 'function') {
				const cb = args.pop();
				args.push(function (err, res) {
					if (err) {
						return cb(err);
					}

					// fixes callbackified functions used in async.waterfall
					if (res !== undefined) {
						return cb(err, res);
					}
					return cb(err);
				});
				return callbackFn.apply(null, args);
			}
			return origFn.apply(null, arguments);
		};
	}

	promisifyRecursive(theModule, '');
	return _.cloneDeep(theModule);
};
