
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// this file is required by app.js and allows plugins to use `nodebb.require('./src/user')`
// to import nbb core modules, replaces the deprecated `require.main.require`
globalThis.nodebb = {
	require: function (modulePath) {
		return require(modulePath);
	},
};