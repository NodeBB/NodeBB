
'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');
	module.sortedSetIntersectCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return 0;
		}
		const tempSetName = `temp_${Date.now()}`;
		const multi = module.client.multi();
		multi.zInterStore(tempSetName, keys);
		multi.zCard(tempSetName);
		multi.del(tempSetName);
		const results = await helpers.execBatch(multi);
		return results[1] || 0;
	};

	module.getSortedSetIntersect = async function (params) {
		params.reverse = false;
		return await getSortedSetRevIntersect(params);
	};

	module.getSortedSetRevIntersect = async function (params) {
		params.reverse = true;
		return await getSortedSetRevIntersect(params);
	};

	async function getSortedSetRevIntersect(params) {
		let { sets } = params;
		const start = params.hasOwnProperty('start') ? params.start : 0;
		const stop = params.hasOwnProperty('stop') ? params.stop : -1;
		const weights = params.weights || [];

		const tempSetName = `temp_${Date.now()}`;

		const interParams = {};
		if (weights.length) {
			sets = sets.map((set, index) => ({ key: set, weight: weights[index] }));
		}

		if (params.aggregate) {
			interParams['AGGREGATE'] = params.aggregate.toUpperCase();
		}

		const rangeCmd = params.withScores ? 'zRangeWithScores' : 'zRange';

		const multi = module.client.multi();
		multi.zInterStore(tempSetName, sets, interParams);
		multi[rangeCmd](tempSetName, start, stop, { REV: params.reverse});
		multi.del(tempSetName);
		let results = await helpers.execBatch(multi);

		if (!params.withScores) {
			return results ? results[1] : null;
		}
		results = results[1] || [];
		return results;
	}
};
