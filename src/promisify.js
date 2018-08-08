'use strict';

var util = require('util');

module.exports = function (theModule) {
	function isCallbackedFunction(func) {
		if (typeof func !== 'function') {
			return false;
		}
		var str = func.toString().split('\n')[0];
		return str.includes('callback)');
	}
	function promisifyRecursive(parent, module) {
		if (!module) {
			return;
		}
		var keys = Object.keys(module);
		keys.forEach(function (key) {
			if (isCallbackedFunction(module[key])) {
				parent[key] = util.promisify(module[key]);
			} else if (typeof module[key] === 'object') {
				parent[key] = {};
				promisifyRecursive(parent[key], module[key]);
			}
		});
	}
	const async = {};
	promisifyRecursive(async, theModule);
	return async;
};
