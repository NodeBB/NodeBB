'use strict';

const util = require('util');
const sleep = util.promisify(setTimeout);

module.exports = function (module) {
	const MAX_RETRIES = 5;
	const RETRY_DELAY_MS = 100;

	function isSqliteBusyError(err) {
		if (!err) return false;
		const message = err.message || '';
		const code = err.code || '';
		return (
			message.includes('database is locked') ||
			message.includes('SQLITE_BUSY') ||
			code === 'SQLITE_BUSY' ||
			code === 'SQLITE_LOCKED'
		);
	}

	module.transaction = async function (perform, txClient) {
		// If we're already in a transaction, just execute the function
		// Kysely handles nested transactions as savepoints automatically
		if (txClient) {
			return await perform(txClient);
		}

		if (!module.db) {
			throw new Error('Database not initialized');
		}

		// For SQLite, implement retry logic for busy errors
		const isSqlite = module.dialect === 'sqlite';
		let lastError;

		for (let attempt = 0; attempt < (isSqlite ? MAX_RETRIES : 1); attempt++) {
			try {
				return await module.db.transaction().execute(async trx => await perform(trx));
			} catch (err) {
				lastError = err;
				if (isSqlite && isSqliteBusyError(err) && attempt < MAX_RETRIES - 1) {
					// Exponential backoff with jitter
					const delay = (RETRY_DELAY_MS * Math.pow(2, attempt)) + (Math.random() * 50);
					await sleep(delay);
					continue;
				}
				throw err;
			}
		}

		throw lastError;
	};
};