'use strict';

module.exports = function (module) {
	module.transaction = async function (perform, txClient) {
		// If we're already in a transaction, just execute the function.
		// Kysely handles nested transactions as savepoints automatically.
		if (txClient) {
			return await perform(txClient);
		}

		if (!module.db) {
			throw new Error('Database not initialized');
		}

		// No JS-level retry: the SQLite worker dialect serialises every write
		// through a single FIFO mutex on the parent thread, so internal
		// SQLITE_BUSY is unreachable. External-process contention is handled
		// by `PRAGMA busy_timeout = 30000` (30 s of in-engine retries).
		// Postgres / MySQL handle their own concurrency control.
		return await module.db.transaction().execute(async trx => await perform(trx));
	};
};
