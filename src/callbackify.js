'use strict';

var util = require('util');
var _ = require('lodash');

module.exports = function (theModule, ignoreKeys) {
	ignoreKeys = ignoreKeys || [];

	function isAsyncFunction(fn) {
		return fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
	}

	function callbackifyRecursive(module, origModule) {
		if (!module || !origModule) {
			return;
		}
		var keys = Object.keys(module);
		keys.forEach(function (key) {
			if (ignoreKeys.includes(key)) {
				return;
			}

			if (isAsyncFunction(module[key])) {
				module[key] = util.callbackify(module[key]);
				origModule[key] = wrapIt(origModule[key], module[key]);
			} else if (typeof module[key] === 'object') {
				callbackifyRecursive(module[key], origModule[key]);
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

	const newModule = _.cloneDeep(theModule);
	callbackifyRecursive(newModule, theModule);
	return newModule;
};
