const { PoolConnection } = require('mysql2/promise');

'use strict';

/**
 * 
 * @param {import ('../../../types/database').MySQLDatabase} module 
 */
module.exports = function (module) {
	module.transaction = async function (perform, txClient) {
		let res;
		if (txClient) {
			await txClient.query(`SAVEPOINT nodebb_subtx`);
			try {
				res = await perform(txClient);
			} catch (err) {
				await txClient.query(`ROLLBACK TO SAVEPOINT nodebb_subtx`);
				throw err;
			}
			await txClient.query(`RELEASE SAVEPOINT nodebb_subtx`);
			return res;
		}

		const poolConnection = await module.pool.getConnection();

		try {
			await poolConnection.query('BEGIN');
			res = await perform(poolConnection);
			await poolConnection.query('COMMIT');
		} catch (err) {
			await poolConnection.query('ROLLBACK');
			throw err;
		} finally {
			poolConnection.release();
		}
		return res;
	};
};
