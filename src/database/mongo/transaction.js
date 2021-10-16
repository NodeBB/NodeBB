'use strict';

module.exports = function (module) {
	// TODO
	module.transaction = async function (perform) {
		const session = module.client.startSession();
		try {
			return await session.withTransaction(perform);
		} finally {
			await session.endSession();
		}
	};
};
