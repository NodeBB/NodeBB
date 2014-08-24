var HotSwap = {},
	winston = require('winston'),
	stack;

HotSwap.prepare = function(app) {
	stack = app._router.stack;
};

HotSwap.find = function(id) {
	if (stack) {
		for(var x=0,numEntries=stack.length;x<numEntries;x++) {
			if (stack[x].handle.hotswapId === id) {
				return x;
				break;
			}
		}
	} else {
		winston.error('[hotswap] HotSwap module has not been prepared!');
	}
};

HotSwap.replace = function(id, middleware) {
	var idx = HotSwap.find(id);
	if (idx) {
		delete stack[idx].handle;	// Destroy the old middleware
		stack[idx].handle = middleware;	// Replace with the new one
		winston.info('[hotswap] Middleware with id `' + id + '` replaced successfully');
	} else {
		winston.warn('[hotswap] Could not find middleware in stack with hotswapId `' + id + '`');
	}
};

module.exports = HotSwap;