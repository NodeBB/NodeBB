'use strict';

const winston = require('winston');

/**
 * @param {import ('../../../types/database').MySQLDatabase} module
 */
module.exports = function (module) {
	// Utility function to sleep for a random duration between 0 and 100 ms
	const sleepRandom = () => {
		const ms = Math.floor(Math.random() * 101); // Random number between 0 and 100
		return { ms, promise: new Promise((resolve) => { setTimeout(resolve, ms); }) };
	};

	module.transaction = async function (perform, txClient, retries = 100) {
		let res;
		if (txClient) {
			const savepointName = `nodebb_subtx_${Math.random().toString(36).slice(2)}`;
			await txClient.query(`SAVEPOINT ${savepointName}`);
			try {
				res = await perform(txClient);
			} catch (err) {
				await txClient.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
				throw err;
			}
			await txClient.query(`RELEASE SAVEPOINT ${savepointName}`);
			return res;
		}

		const poolConnection = await module.pool.getConnection();

		try {
			for (let attempt = 1; attempt <= retries; attempt++) {
				/* eslint-disable no-await-in-loop */
				try {
					await poolConnection.query('BEGIN');
					res = await perform(poolConnection);
					await poolConnection.query('COMMIT');
					break; // Exit loop on success
				} catch (err) {
					await poolConnection.query('ROLLBACK');
					if (attempt < retries) {
						const { ms, promise } = sleepRandom();
						winston.warn(`Deadlock detected, retrying (${attempt}/${retries}) after ${ms}ms`);
						await promise; // Sleep for random 0-100 ms
					} else {
						throw err; // Rethrow if not a deadlock or retries exhausted
					}
				}
			}
		} finally {
			poolConnection.release();
		}
		return res;
	};
};
