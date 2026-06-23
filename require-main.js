'use strict';

// this forces `require.main.require` to always be relative to this directory
// this allows plugins to use `require.main.require` to reference NodeBB modules
// without worrying about multiple parent modules
if (require.main !== module) {
	require.main.require = function (path) {
		if (process.env.NODE_ENV === 'development') {
			const e = (new Error().stack).split('\n')[2].trim();
			if (e.includes('nodebb-')) { // only warn nodebb-plugin/theme etc.
				const chalk = require('chalk').default;
				const warningText = chalk.red(`Warning`);
				console.warn(`${warningText}: require.main.require is going to be deprecated. Please use nodebb.require("${path}") instead.\n${e}\n`);
			}
		}
		return require(path);
	};
}
