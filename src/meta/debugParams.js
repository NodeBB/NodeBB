'use strict';

module.exports = function (execArgv) {
	execArgv = execArgv || process.execArgv;
	var debugArg = execArgv.find(function (arg) {
		return /^--(debug|inspect)/.test(arg);
	});
	if (global.v8debug || debugArg) {
		debugArg = debugArg ? debugArg.split('=') : ['--debug', 5859];
		var num = parseInt(debugArg[1], 10) + 1;

		return { execArgv: [debugArg[0] + '=' + num, '--nolazy'] };
	}

	return { execArgv: [] };
};
