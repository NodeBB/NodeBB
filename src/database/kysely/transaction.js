'use strict';

// MySQL InnoDB throws ER_LOCK_DEADLOCK (1213) and ER_LOCK_WAIT_TIMEOUT (1205)
// when concurrent transactions touch overlapping rows in different orders.
// The standard MySQL recipe is to retry the entire transaction on a fresh
// snapshot — see https://dev.mysql.com/doc/refman/5.6/en/innodb-deadlocks-handling.html
// Postgres uses MVCC + serializable retry under the hood and SQLite serialises
// writers through the worker FIFO + PRAGMA busy_timeout, so this only fires on
// MySQL in practice.
const RETRY_ERRNOS = new Set([1213, 1205]);
const MAX_ATTEMPTS = 4;

module.exports = function (module) {
	module.transaction = async function (perform, txClient) {
		// Already in a transaction → no retry, no new tx (Kysely treats this
		// as a savepoint; retrying would re-enter the parent's tx).
		if (txClient) {
			return await perform(txClient);
		}
		if (!module.db) {
			throw new Error('Database not initialized');
		}
		for (let attempt = 0; ; attempt++) {
			try {
				// eslint-disable-next-line no-await-in-loop
				return await module.db.transaction().execute(async trx => await perform(trx));
			} catch (err) {
				if (attempt >= MAX_ATTEMPTS - 1 || !RETRY_ERRNOS.has(err && err.errno)) throw err;
				// Quadratic-ish backoff with jitter: 5/20/45 ms ± 50%.
				const base = 5 * ((attempt + 1) ** 2);
				// eslint-disable-next-line no-await-in-loop
				await new Promise(r => setTimeout(r, base + Math.floor(Math.random() * base)));
			}
		}
	};
};
