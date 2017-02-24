'use strict';

var HotSwap = {};
var winston = require('winston');
var stack;

HotSwap.prepare = function (app) {
	stack = app._router.stack;
};

HotSwap.find = function (id) {
	if (stack) {
		for (var x = 0, numEntries = stack.length; x < numEntries; x += 1) {
			if (stack[x].handle.hotswapId === id) {
				return x;
			}
		}
	} else {
		winston.error('[hotswap] HotSwap module has not been prepared!');
	}
};

HotSwap.replace = function (id, router) {
	var idx = HotSwap.find(id);
	if (idx) {
		delete stack[idx].handle;	// Destroy the old router
		stack[idx].handle = router;	// Replace with the new one
		winston.verbose('[hotswap] Router with id `' + id + '` replaced successfully');
	} else {
		winston.warn('[hotswap] Could not find router in stack with hotswapId `' + id + '`');
	}
};

module.exports = HotSwap;
