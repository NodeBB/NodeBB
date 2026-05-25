
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// this file is required by app.js and allows plugins to use `nbbRequire('./src/user')`
// to import nbb core modules
globalThis.nbbRequire = function (modulePath) {
	return require(modulePath);
};