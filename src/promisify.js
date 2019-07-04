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
	function promisifyRecursive(module) {
		if (!module) {
			return;
		}
		var keys = Object.keys(module);
		keys.forEach(function (key) {
			if (ignoreKeys.includes(key)) {
				return;
			}
			if (isCallbackedFunction(module[key])) {
				module[key] = util.promisify(module[key]);
			} else if (typeof module[key] === 'object') {
				promisifyRecursive(module[key]);
			}
		});
	}
	const asyncModule = _.cloneDeep(theModule);
	promisifyRecursive(asyncModule);
	return asyncModule;
};
