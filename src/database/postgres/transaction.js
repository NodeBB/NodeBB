'use strict';

module.exports = function (db, module) {
	module.transaction = function (perform, callback) {
		db.connect(function (err, client, done) {
			if (err) {
				return callback(err);
			}

			client.query(`BEGIN`, function (err) {
				if (err) {
					done();
					return callback(err);
				}

				var tx = {
					client: client,
					helpers: { postgres: require('./helpers') },
					ensureTx: function (p, c) {
						p(tx, c);
					},
				};
				require('./main')(client, tx);
				require('./hash')(client, tx);
				require('./sets')(client, tx);
				require('./sorted')(client, tx);
				require('./list')(client, tx);

				perform(tx, function (err) {
					var args = Array.prototype.slice.call(arguments, 1);

					client.query(err ? `ROLLBACK` : `COMMIT`, function (err1) {
						done();
						callback.apply(this, [err || err1].concat(args));
					});
				});
			});
		});
	};

	module.ensureTx = function (p, c) {
		return module.transaction(p, c);
	};
};
