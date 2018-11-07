'use strict';

// this forces `require.main.require` to always be relative to this directory
// this allows plugins to use `require.main.require` to reference NodeBB modules
// without worrying about multiple parent modules
if (require.main !== module) {
	require.main.require = function (path) {
		return require(path);
	};
}
