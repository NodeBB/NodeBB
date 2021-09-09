'use strict';

module.exports = function (module) {
	// TODO
	module.transaction = function (perform, callback) {
		perform(module.client, callback);
	};
};
