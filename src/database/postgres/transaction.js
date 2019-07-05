'use strict';

module.exports = function (db, dbNamespace, module) {
	const util = require('util');
	module.transaction = async function (perform) {
		if (dbNamespace.active && dbNamespace.get('db')) {
			const client = dbNamespace.get('db');
			await client.query(`SAVEPOINT nodebb_subtx`);
			try {
				await perform(module);
			} catch (err) {
				await client.query(`ROLLBACK TO SAVEPOINT nodebb_subtx`);
				throw err;
			}
			return await client.query(`RELEASE SAVEPOINT nodebb_subtx`);
		}
		const testFn = util.promisify(test);
		await testFn(perform);
		// const client = await db.connect();
		// await dbNamespace.run(function () {
		// 	dbNamespace.set('db', client);
		// });

		// try {
		// 	await client.query(`BEGIN`);
		// 	await perform(module);
		// 	await client.query('COMMIT');
		// 	dbNamespace.set('db', null);
		// } catch (err) {
		// 	await client.query('ROLLBACK');
		// 	dbNamespace.set('db', null);
		// 	throw err;
		// }
	};

	function test(perform, callback) {
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
	}
};
