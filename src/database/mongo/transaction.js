'use strict';

module.exports = function (module) {
	module.transaction = async function (perform) {
		if (module.mongoClient.topology.description.type === 'Single' || !module.mongoClient.topology.hasSessionSupport()) {
			return await perform();
		}
		const session = module.mongoClient.startSession();
		try {
			return await session.withTransaction(perform);
		} finally {
			await session.endSession();
		}
	};
};
