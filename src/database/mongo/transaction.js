'use strict';

module.exports = function (db, module) {
	// TODO
	module.transaction = function (perform, callback) {
		perform(db, callback);
	};
};
