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
			if (isCallbackedFunction(module[key])) {
				module[key] = util.promisify(module[key]);
			} else if (typeof module[key] === 'object') {
				promisifyRecursive(module[key], key);
			}

			if (typeof module[key] === 'function') {
				module[key] = require('util').deprecate(module[key], '.async.' + (parts.concat([key]).join('.')) + ' usage is deprecated use .' + key + ' directly!');
			}
		});
		parts.pop();
	}
	const asyncModule = _.cloneDeep(theModule);
	promisifyRecursive(asyncModule, '');
	return asyncModule;
};
