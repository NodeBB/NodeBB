'use strict';

module.exports = function (db, dbNamespace, module) {
	module.transaction = function (perform, callback) {
		if (dbNamespace.active && dbNamespace.get('db')) {
			var client = dbNamespace.get('db');
			return client.query(`SAVEPOINT nodebb_subtx`, function (err) {
				if (err) {
					return callback(err);
				}

				perform(module, function (err) {
					var args = Array.prototype.slice.call(arguments, 1);

					client.query(err ? `ROLLBACK TO SAVEPOINT nodebb_subtx` : `RELEASE SAVEPOINT nodebb_subtx`, function (err1) {
						callback.apply(this, [err || err1].concat(args));
					});
				});
			});
		}

		db.connect(function (err, client, done) {
			if (err) {
				return callback(err);
			}

			dbNamespace.run(function () {
				dbNamespace.set('db', client);

				client.query(`BEGIN`, function (err) {
					if (err) {
						done();
						dbNamespace.set('db', null);
						return callback(err);
					}

					perform(module, function (err) {
						var args = Array.prototype.slice.call(arguments, 1);

						client.query(err ? `ROLLBACK` : `COMMIT`, function (err1) {
							done();
							dbNamespace.set('db', null);
							callback.apply(this, [err || err1].concat(args));
						});
					});
				});
			});
		});
	};
};
