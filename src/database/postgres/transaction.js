'use strict';

module.exports = function (db, dbNamespace, module) {
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

		const client = await db.connect();
		await dbNamespace.run();
		dbNamespace.set('db', client);
		try {
			await client.query(`BEGIN`);
			await perform(module);
			await client.query('COMMIT');
			dbNamespace.set('db', null);
		} catch (err) {
			await client.query('ROLLBACK');
			dbNamespace.set('db', null);
			throw err;
		}
	};
};
