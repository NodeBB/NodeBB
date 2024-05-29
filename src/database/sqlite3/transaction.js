'use strict';

module.exports = function (module) {
	module.transaction = function (perform) {
		let res;
		const db = module.db;

		try {
			db.exec('BEGIN');
			res = perform(db);
			db.exec('COMMIT');
		} catch (err) {
			console.error(err);
			db.exec('ROLLBACK');
			throw err;
		}
		return res;
	};
};
