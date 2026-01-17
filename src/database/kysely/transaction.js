'use strict';

module.exports = function (module) {
	module.transaction = async function (perform, txClient) {
		// If we're already in a transaction, just execute the function
		// Kysely handles nested transactions as savepoints automatically
		if (txClient) {
			return await perform(txClient);
		}

		if (!module.db) {
			throw new Error('Database not initialized');
		}

		// Start a new transaction
		return await module.db.transaction().execute(async trx => await perform(trx));
	};
};