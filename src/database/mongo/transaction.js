'use strict';

module.exports = function (module) {
	module.transaction = async function (perform) {
		const session = module.mongoClient.startSession();
		try {
			return await session.withTransaction(perform);
		} finally {
			await session.endSession();
		}
	};
};
