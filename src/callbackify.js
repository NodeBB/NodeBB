'use strict';

var util = require('util');

module.exports = function (theModule, ignoreKeys) {
	ignoreKeys = ignoreKeys || [];
	if (!ignoreKeys.includes('async')) {
		ignoreKeys.push('async');
	}
	function isAsyncFunction(fn) {
		return fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
	}

	function callbackifyRecursive(module) {
		if (!module) {
			return;
		}
		var keys = Object.keys(module);
		keys.forEach(function (key) {
			if (ignoreKeys.includes(key)) {
				return;
			}

			if (isAsyncFunction(module[key])) {
				module[key] = wrapIt(module[key], util.callbackify(module[key]));
			} else if (typeof module[key] === 'object') {
				callbackifyRecursive(module[key], module[key]);
			}
		});
	}
	function wrapIt(origFn, callbackFn) {
		return async function wrapper() {
			if (arguments.length && typeof arguments[arguments.length - 1] === 'function') {
				return callbackFn.apply(null, arguments);
			}
			return origFn.apply(null, arguments);
		};
	}

	callbackifyRecursive(theModule);
};
