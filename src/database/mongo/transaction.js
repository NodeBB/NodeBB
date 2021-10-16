'use strict';

module.exports = function (module) {
	// TODO
	module.transaction = async function (perform) {
		if (!perform) {
			return;
		}
		let res;
		const session = module.mongoClient.startSession();
		try {
			session.startTransaction();
			res = await perform(session);
			await session.commitTransaction();
		} catch (err) {
			session.abortTransaction();
			throw err;
		} finally {
			await session.endSession();
		}
		return res;
	};
};
