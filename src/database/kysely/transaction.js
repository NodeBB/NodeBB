'use strict';

module.exports = function (module) {
	module.transaction = async function (perform, txClient) {
		if (txClient) {
			// If we're already in a transaction, just execute the function
			// Kysely handles nested transactions as savepoints automatically
			return await perform(txClient);
		}
		
		// Start a new transaction
		return await module.db.transaction().execute(async (trx) => {
			return await perform(trx);
		});
	};
};