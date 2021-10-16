'use strict';

module.exports = function (module) {
	// TODO
	module.transaction = async function (perform) {
		let res;
		const session = module.mongoClient.startSession();
		try {
			res = await session.withTransaction(perform);
		} finally {
			await session.endSession();
		}
		return res;
	};
};
